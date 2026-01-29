import { createClient } from "@/lib/supabase/server";
import { generateQueryEmbedding } from "./embeddings";
import type { RetrievedChunk } from "@/types";

/**
 * Retrieve relevant chunks from the vector store for a given query.
 * Also fetches source titles for better citation display.
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

  const chunks = (data ?? []) as RetrievedChunk[];

  // Fetch source titles for the retrieved chunks
  if (chunks.length > 0) {
    const sourceIds = [...new Set(chunks.map((c) => c.source_id))];
    const { data: sources } = await supabase
      .from("sources")
      .select("id, title")
      .in("id", sourceIds);

    if (sources) {
      const titleMap = new Map(sources.map((s) => [s.id, s.title]));
      chunks.forEach((chunk) => {
        chunk.source_title = titleMap.get(chunk.source_id);
      });
    }
  }

  return chunks;
}

/**
 * Format retrieved chunks into a context string for the LLM prompt.
 * Includes source titles for better citations.
 */
export function formatContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "No relevant sources found.";

  // Group by source for cleaner display
  const sourceGroups = new Map<string, { title: string; chunks: RetrievedChunk[] }>();
  
  chunks.forEach((chunk) => {
    const key = chunk.source_id;
    if (!sourceGroups.has(key)) {
      sourceGroups.set(key, {
        title: chunk.source_title || "Unknown Source",
        chunks: [],
      });
    }
    sourceGroups.get(key)!.chunks.push(chunk);
  });

  // Format with source names
  let sourceNum = 1;
  const sections: string[] = [];
  
  for (const [, group] of sourceGroups) {
    const chunkTexts = group.chunks
      .map((c) => c.content)
      .join("\n\n");
    
    sections.push(
      `[Source ${sourceNum}: ${group.title}]\n${chunkTexts}`
    );
    sourceNum++;
  }

  return sections.join("\n\n---\n\n");
}

/**
 * Get a summary of sources used for display in the UI.
 */
export function getSourcesSummary(chunks: RetrievedChunk[]): { id: string; title: string }[] {
  const seen = new Set<string>();
  const sources: { id: string; title: string }[] = [];
  
  for (const chunk of chunks) {
    if (!seen.has(chunk.source_id)) {
      seen.add(chunk.source_id);
      sources.push({
        id: chunk.source_id,
        title: chunk.source_title || "Unknown Source",
      });
    }
  }
  
  return sources;
}
