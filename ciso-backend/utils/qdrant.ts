import { QdrantClient } from "@qdrant/js-client-rest";
import { Ollama } from "ollama";

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || "http://localhost:6333",
});

const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || "http://localhost:11434",
});

const COLLECTION_NAME = "acme_policies";

// 🧩 Step 1: Setup Qdrant with automatic vector size matching
export async function setUpQdrant(): Promise<void> {
  const collections = await qdrant.getCollections();
  const exists = collections.collections.find(
    (c) => c.name === COLLECTION_NAME
  );

  const testEmbedding = await embedText("test");
  const embeddingSize = testEmbedding.length;

  if (!exists) {
    console.log(
      `Creating Qdrant collection '${COLLECTION_NAME}' with vector size ${embeddingSize}`
    );
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: { size: embeddingSize, distance: "Cosine" },
    });
  } else {
    const info = await qdrant.getCollection(COLLECTION_NAME);
    const currentSize = (info as any).config?.params?.vectors?.size;
    if (currentSize !== embeddingSize) {
      console.warn(
        `Vector size mismatch (expected ${currentSize}, got ${embeddingSize}). Recreating collection...`
      );
      await qdrant.deleteCollection(COLLECTION_NAME);
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: { size: embeddingSize, distance: "Cosine" },
      });
    }
  }
}

// 🧠 Step 2: Generate embeddings using Ollama
export async function embedText(text: string): Promise<number[]> {
  const result = await ollama.embeddings({
    model: "nomic-embed-text",
    prompt: text,
  });
  return result.embedding;
}

// 📘 Step 3: Store policy document chunks
export async function storePolicy(policyText: string) {
  await setUpQdrant();
  const chunks = policyText
    .split(/\n{2,}|\r{2,}/) // split by paragraphs or double newlines
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  const points = await Promise.all(
    chunks.map(async (chunk, i) => ({
      id: i,
      vector: await embedText(chunk),
      payload: { text: chunk },
    }))
  );

  await qdrant.upsert(COLLECTION_NAME, { points });
  console.log(
    `Stored ${points.length} chunks in Qdrant collection '${COLLECTION_NAME}'`
  );
}

export async function queryPolicyContext(
  query: string,
  topK = 5
): Promise<string[]> {
  const embedding = await embedText(query);
  const results = await qdrant.search(COLLECTION_NAME, {
    vector: embedding,
    limit: topK,
  });

  // Sort results in document order (by id)
  const sortedResults = results.sort(
    (a, b) => (a.id as number) - (b.id as number)
  );

  // Extract raw text chunks
  const rawChunks = sortedResults.map((res) =>
    (res.payload as { text: string }).text.trim()
  );

  // 🧹 Clean + deduplicate chunks
  const contextChunks = Array.from(new Set(rawChunks))
    // remove fragments or repeated headers like "5.1. Password Complexity"
    .filter(
      (text) =>
        text.length > 40 && // ignore tiny fragments
        !/^\d+(\.\d+)*\s*Password\s*Complexity/i.test(text) && // skip stray section headers
        !/^Page\s*\d+/i.test(text) && // skip page numbers if any
        !/^(ACME\s*Inc\.|Company\s*Policy)/i.test(text) // skip cover/title lines
    );

  // ✅ Return clean, unique policy sections
  return contextChunks;
}
