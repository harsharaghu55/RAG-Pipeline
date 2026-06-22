import { OllamaEmbeddings } from "@langchain/ollama";
import { QdrantVectorStore } from "@langchain/qdrant";

const embeddings = new OllamaEmbeddings({
    model: "nomic-embed-text",
});

let vectorStore  = null

export async function getVectorStore() {
    if(vectorStore) {
        return vectorStore
    }

    vectorStore = await QdrantVectorStore.fromExistingCollection(
        embeddings,
        {
            url: 'http://localhost:6333',
            collectionName: 'langchainjs-testing',
        }
    )

    return vectorStore
}