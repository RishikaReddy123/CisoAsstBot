import { Pinecone } from "@pinecone-database/pinecone";
import ollama from "ollama";

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY as string,
});

const index = pc.Index(process.env.PINECONE_INDEX_NAME || "chat-memory");

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await ollama.embeddings({
    model: "nomic-embed-text",
    prompt: text,
  });
  return response.embedding;
}

export async function storeMemory(
  userId: string,
  message: string,
  reply: string
) {
  const text = `User: ${message}/nAssistant: ${reply}`;

  const values = await generateEmbedding(text);

  await index.upsert([
    {
      id: `${userId}-${Date.now()}`,
      values,
      metadata: { userId, text },
    },
  ]);
}

export async function retrieveMemory(
  userId: string,
  query: string
): Promise<string> {
  const values = await generateEmbedding(query);
  const results = await index.query({
    vector: values as any,
    topK: 5,
    filter: { userId },
    includeMetadata: true,
  });
  if (!results.matches || results.matches.length === 0) {
    console.log("No memory found for user:", userId);
    return "";
  }

  const memories = results.matches
    .map((m: any) => m.metadata?.text || "")
    .filter(Boolean)
    .join("\n");

  console.log("🔎 Retrieved memory:", memories || "No memory found");
  return memories;
}
