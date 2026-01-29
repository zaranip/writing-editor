import { createClient } from "@/lib/supabase/server";
import { generateQueryEmbedding } from "./embeddings";
import type { RetrievedChunk } from "@/types";

/**
 * Retrieve relevant chunks from the vector store for a given query.
 */
export async function retrieveContext(
  query: string,
  projectId: string,
  userId: string,
  openaiApiKey: string,
  matchCount: number = 10,
  matchThreshold: number = 0.7
): Promise<RetrievedChunk[]> {
  // Generate embedding for the query
  const queryEmbedding = await generateQueryEmbedding(query, openaiApiKey);

  // Search for similar chunks
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_project_id: projectId,
    match_user_id: userId,
    match_count: matchCount,
    match_threshold: matchThreshold,
  });

  if (error) {
    console.error("RAG retrieval error:", error);
    return [];
  }

  return (data ?? []) as RetrievedChunk[];
}

/**
 * Format retrieved chunks into a context string for the LLM prompt.
 */
export function formatContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "No relevant sources found.";

  return chunks
    .map(
      (chunk, i) =>
        `[Source ${i + 1}] (relevance: ${(chunk.similarity * 100).toFixed(0)}%)\n${chunk.content}`
    )
    .join("\n\n---\n\n");
}
