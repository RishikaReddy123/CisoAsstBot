import { Pinecone } from "@pinecone-database/pinecone";
import ollama from "ollama";

// ------------------------------------------------------------
// INIT (your version, without environment)
// ------------------------------------------------------------
const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY as string,
});

const index = pc.Index(process.env.PINECONE_INDEX_NAME || "chat-memory");

// ------------------------------------------------------------
// EMBEDDINGS
// ------------------------------------------------------------
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await ollama.embeddings({
    model: "nomic-embed-text",
    prompt: text,
  });
  return response.embedding;
}

// ------------------------------------------------------------
// CHUNKING
// ------------------------------------------------------------
function chunkText(text: string, chunkSize = 3000, overlap = 200) {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = Math.max(end - overlap, end);
  }

  return chunks;
}

// ------------------------------------------------------------
// STORE Q/A MEMORY
// ------------------------------------------------------------
export async function storeMemory(
  userId: string,
  message: string,
  reply: string
) {
  const text = `User: ${message}\nAssistant: ${reply}`;
  const values = await generateEmbedding(text);

  await index.upsert([
    {
      id: `${userId}-qa-${Date.now()}`,
      values,
      metadata: {
        userId,
        type: "qa",
        text,
        createdAt: new Date().toISOString(),
      },
    },
  ]);
}

// ------------------------------------------------------------
// STORE DOCUMENT TEXT (CHUNKED)
// ------------------------------------------------------------
export async function storeDocumentText(
  userId: string,
  text: string,
  opts?: { replace?: boolean }
) {
  const chunks = chunkText(text);

  // delete old docs if replace = true
  if (opts?.replace) {
    const queryEmbedding = await generateEmbedding("document cleanup");

    const existing = await index.query({
      vector: queryEmbedding,
      topK: 100,
      filter: { userId, type: "document" },
      includeMetadata: true,
    });

    const ids = (existing.matches || []).map((m: any) => m.id);

    if (ids.length > 0) {
      await index.deleteMany(ids);
    }
  }

  // chunk upload
  const vectors = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;

    const values = await generateEmbedding(chunk);

    vectors.push({
      id: `${userId}-document-${Date.now()}-${i}`,
      values,
      metadata: {
        userId,
        type: "document",
        chunkIndex: i,
        text: chunk,
        createdAt: new Date().toISOString(),
      },
    });
  }

  // upload in batches of 50
  const batchSize = 50;

  for (let i = 0; i < vectors.length; i += batchSize) {
    await index.upsert(vectors.slice(i, i + batchSize));
  }
}

// ------------------------------------------------------------
// RETRIEVE MEMORY (Q/A)
// ------------------------------------------------------------
export async function retrieveMemory(
  userId: string,
  query: string,
  topK = 5
): Promise<string> {
  const embedding = await generateEmbedding(query);

  const results = await index.query({
    vector: embedding,
    topK,
    filter: { userId, type: "qa" },
    includeMetadata: true,
  });

  if (!results.matches?.length) return "";

  return results.matches
    .map((m: any) => m.metadata?.text)
    .filter(Boolean)
    .join("\n\n---\n\n");
}

// ------------------------------------------------------------
// RETRIEVE DOCUMENT (ALL CHUNKS)
// ------------------------------------------------------------
export async function retrieveDocumentText(
  userId: string,
  topK = 50
): Promise<string> {
  const embedding = await generateEmbedding("retrieve document content");

  const results = await index.query({
    vector: embedding,
    topK,
    filter: { userId, type: "document" },
    includeMetadata: true,
  });

  if (!results.matches?.length) return "";

  return results.matches
    .sort((a: any, b: any) => a.metadata.chunkIndex - b.metadata.chunkIndex)
    .map((m: any) => m.metadata?.text || "")
    .join("\n\n");
}
