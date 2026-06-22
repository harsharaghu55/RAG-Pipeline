import { Worker } from 'bullmq';
import { Document } from '@langchain/core/documents';
import { PDFParse } from 'pdf-parse';
import { readFileSync } from 'node:fs';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { getVectorStore } from './vectorStore.js'

const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;
const UPSERT_BATCH_SIZE = 24;
const MAX_EMBED_TOKENS = 1800;
const MAX_EMBED_CHARS = MAX_EMBED_TOKENS * 4;

function approximateTokens(text) {
    return Math.ceil(text.length / 4);
}

function enforceEmbeddingLimit(docs) {
    const safeDocs = [];

    for (const doc of docs) {
        const content = (doc.pageContent || '').trim();
        if (!content) {
            continue;
        }

        if (approximateTokens(content) <= MAX_EMBED_TOKENS) {
            safeDocs.push(new Document({
                pageContent: content,
                metadata: doc.metadata,
            }));
            continue;
        }

        // Hard-split any remaining oversized chunks (for long unbroken text blocks).
        for (let i = 0; i < content.length; i += MAX_EMBED_CHARS) {
            const slice = content.slice(i, i + MAX_EMBED_CHARS).trim();
            if (!slice) {
                continue;
            }

            safeDocs.push(new Document({
                pageContent: slice,
                metadata: {
                    ...doc.metadata,
                    subChunk: Math.floor(i / MAX_EMBED_CHARS),
                },
            }));
        }
    }

    return safeDocs;
}

async function loadPdfPages(filePath) {
    const parser = new PDFParse({
        data: new Uint8Array(readFileSync(filePath)),
    });
    try {
        const { pages } = await parser.getText();
        return pages.map(
            (page) =>
                new Document({
                    pageContent: page.text,
                    metadata: { source: filePath, page: page.num - 1 },
                })
        );
    } finally {
        await parser.destroy();
    }
}

const worker = new Worker(
    'file-upload-queue',
    async job => {
        const data = typeof job.data === 'string' ? JSON.parse(job.data) : job.data;
        console.log('job started:', {
            id: job.id,
            file: data?.filename,
            path: data?.path,
        });

        await job.updateProgress(1);
        const pageDocs = await loadPdfPages(data.path);
        console.log(`Loaded ${pageDocs.length} pages from PDF`);

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: CHUNK_SIZE,
            chunkOverlap: CHUNK_OVERLAP,
            separators: ['\n\n', '\n', '. ', ' ', ''],
        });
        const splitDocs = await splitter.splitDocuments(pageDocs);
        const docs = enforceEmbeddingLimit(splitDocs);
        console.log(`Created ${docs.length} safe chunks from PDF`);

        const vectorStore = await getVectorStore();
        let completed = 0;

        for (let i = 0; i < docs.length; i += UPSERT_BATCH_SIZE) {
            const batch = docs.slice(i, i + UPSERT_BATCH_SIZE);
            await vectorStore.addDocuments(batch);
            completed += batch.length;

            const progress = Math.min(100, Math.round((completed / docs.length) * 100));
            await job.updateProgress(progress);
            console.log(`Indexed ${completed}/${docs.length} chunks`);
        }

        console.log('All chunks indexed successfully');
        return {
            pages: pageDocs.length,
            chunks: docs.length,
        };
    },
    {
        concurrency: 1,
        lockDuration: 30 * 60 * 1000,
        stalledInterval: 120 * 1000,
        connection: {
            host: 'localhost',
            port: 6379
        }
    }
);

worker.on('completed', (job, result) => {
    console.log(`job ${job.id} completed`, result);
});

worker.on('failed', (job, err) => {
    console.error(`job ${job?.id} failed:`, err?.message || err);
});

