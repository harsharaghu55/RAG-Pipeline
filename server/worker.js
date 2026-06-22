import { Worker } from 'bullmq';
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from '@langchain/core/documents';
import { PDFParse } from 'pdf-parse';
import { readFileSync } from 'node:fs';
import { CharacterTextSplitter } from '@langchain/textsplitters'
import { getVectorStore } from './vectorStore.js'

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
        console.log('job:', job.data);
        const data = JSON.parse(job.data)
        /* 
            path: data.path
            read the pdf from path,
            chunk the pdf,
            call the openai embedding model for every chunk,
            sotre the chunk in quadrants
        */
        const docs = await loadPdfPages(data.path)

        const vectorStore = await getVectorStore()
        await vectorStore.addDocuments(docs);
        console.log(`All docs are added to vector store`);
    },
    {
        concurrency: 100,
        connection: {
            host: 'localhost',
            port: '6379'
        }
    }
);

