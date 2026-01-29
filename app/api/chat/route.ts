import { streamText, tool, stepCountIs, type UIMessage, convertToModelMessages } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { getModel } from "@/lib/ai/provider";
import { retrieveContext, formatContext, getSourcesSummary } from "@/lib/ai/rag";
import { buildContextPrompt } from "@/lib/ai/prompts";
import { searchWeb, scrapeUrl, scrapeUrlWithImages } from "@/lib/search/web-search";
import type { LLMProvider, RetrievedChunk } from "@/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Not authenticated", { status: 401 });
  }

  const {
    messages,
    projectId,
    provider,
    model,
    chatId,
  }: {
    messages: UIMessage[];
    projectId: string;
    provider: LLMProvider;
    model: string;
    chatId?: string;
  } = await req.json();

  // Get the user's API key for the selected provider
  const { data: apiKeys } = await supabase
    .from("api_keys")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", provider);

  if (!apiKeys || apiKeys.length === 0) {
    return new Response(
      `No ${provider} API key found. Please add one in Settings.`,
      { status: 400 }
    );
  }

  const apiKey = decrypt(apiKeys[0].encrypted_key);

  // Get OpenAI key for RAG embeddings (if different from selected provider)
  let openaiKey = apiKey;
  if (provider !== "openai") {
    const { data: openaiKeys } = await supabase
      .from("api_keys")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "openai");

    if (openaiKeys && openaiKeys.length > 0) {
      openaiKey = decrypt(openaiKeys[0].encrypted_key);
    }
  }

  // Retrieve context via RAG
  const lastUserMessage = messages
    .filter((m) => m.role === "user")
    .pop();

  let systemPrompt = buildContextPrompt("No sources uploaded yet.");
  let retrievedChunks: RetrievedChunk[] = [];

  if (lastUserMessage) {
    try {
      const queryText = lastUserMessage.parts
        ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join(" ") || "";

      if (queryText && openaiKey) {
        retrievedChunks = await retrieveContext(
          queryText,
          projectId,
          user.id,
          openaiKey
        );
        const context = formatContext(retrievedChunks);
        systemPrompt = buildContextPrompt(context);
      }
    } catch (error) {
      console.error("RAG retrieval failed:", error);
    }
  }

  // Get sources summary for metadata
  const sourcesUsed = getSourcesSummary(retrievedChunks);

  // Stream the response with web research tools
  const result = streamText({
    model: getModel(provider, model, apiKey),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: {
      webSearch: tool({
        description:
          "Search the internet for information on a topic. Use this when the user asks you to research something, find sources, or when the uploaded sources don't contain enough information to answer a question. Returns a list of web results with titles, URLs, and snippets.",
        inputSchema: z.object({
          query: z.string().describe("The search query to find relevant information"),
        }),
        execute: async ({ query }) => {
          const results = await searchWeb(query, 8);
          return {
            query,
            results: results.map((r) => ({
              title: r.title,
              url: r.url,
              snippet: r.snippet,
            })),
          };
        },
      }),
      readWebPage: tool({
        description:
          "Read the full content of a web page. Use this after searching to get detailed content from a promising search result.",
        inputSchema: z.object({
          url: z.string().describe("The URL to read"),
        }),
        execute: async ({ url }) => {
          try {
            const { title, content } = await scrapeUrl(url);
            return { success: true, title, url, content };
          } catch (error) {
            return {
              success: false,
              title: "",
              url,
              content: `Failed to read page: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
          }
        },
      }),
      addToSources: tool({
        description:
          "Save a web page as a source in the user's project. Use this when you've found a useful web page that the user would want to keep as a research source. The page content and featured images will be saved for document generation.",
        inputSchema: z.object({
          url: z.string().describe("The URL of the source to add"),
          title: z.string().describe("A descriptive title for the source"),
        }),
        execute: async ({ url, title }) => {
          let sourceId: string | null = null;
          
          try {
            // Scrape URL for content and featured images
            const { content, description, featuredImages } = await scrapeUrlWithImages(url);

            if (!content || content.trim().length === 0) {
              return { success: false, message: "No content could be extracted from this URL." };
            }

            // Generate unique prefix for this source's files
            const timestamp = Date.now();
            const safeTitle = title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 50);
            const filePrefix = `${projectId}/${timestamp}-${safeTitle}`;

            // Save text content to a .txt file in storage
            const textContent = `# ${title}\n\nSource: ${url}\n\n${description ? `## Summary\n${description}\n\n` : ""}## Content\n\n${content}`;
            const textBlob = new Blob([textContent], { type: "text/plain" });
            const textPath = `${filePrefix}/content.txt`;
            
            const { error: textUploadError } = await supabase.storage
              .from("sources")
              .upload(textPath, textBlob, { contentType: "text/plain" });

            if (textUploadError) {
              throw new Error(`Failed to save content: ${textUploadError.message}`);
            }

            // Download and save featured images (up to 3)
            const savedImagePaths: string[] = [];
            for (let i = 0; i < Math.min(featuredImages.length, 3); i++) {
              const imageUrl = featuredImages[i];
              try {
                const imgResponse = await fetch(imageUrl, {
                  headers: { "User-Agent": "Mozilla/5.0 (compatible; WritingEditor/1.0)" },
                  signal: AbortSignal.timeout(10000),
                });
                
                if (imgResponse.ok) {
                  const contentType = imgResponse.headers.get("content-type") || "image/jpeg";
                  const ext = contentType.includes("png") ? "png" : contentType.includes("gif") ? "gif" : contentType.includes("webp") ? "webp" : "jpg";
                  const imgPath = `${filePrefix}/image-${i + 1}.${ext}`;
                  
                  const imgBlob = await imgResponse.blob();
                  const { error: imgUploadError } = await supabase.storage
                    .from("sources")
                    .upload(imgPath, imgBlob, { contentType });
                  
                  if (!imgUploadError) {
                    savedImagePaths.push(imgPath);
                  }
                }
              } catch {
                // Skip failed image downloads
              }
            }

            // Create source record
            const { data: source, error: insertError } = await supabase
              .from("sources")
              .insert({
                project_id: projectId,
                user_id: user!.id,
                type: "url",
                title,
                original_url: url,
                file_path: textPath,
                content: description || content.slice(0, 500), // Store summary/preview
                status: "ready",
                metadata: { 
                  auto_added: true,
                  image_paths: savedImagePaths,
                  scraped_at: new Date().toISOString(),
                },
              })
              .select()
              .single();

            if (insertError || !source) {
              // Clean up uploaded files if DB insert fails
              await supabase.storage.from("sources").remove([textPath, ...savedImagePaths]);
              return { success: false, message: `Failed to create source: ${insertError?.message}` };
            }
            
            sourceId = source.id;

            return {
              success: true,
              message: `Added "${title}" to sources${savedImagePaths.length > 0 ? ` with ${savedImagePaths.length} image(s)` : ""}.`,
              sourceId: source.id,
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            
            // Update source status to error if it was created
            if (sourceId) {
              await supabase
                .from("sources")
                .update({ status: "error", error_message: errorMessage })
                .eq("id", sourceId);
            }
            
            return {
              success: false,
              message: `Failed to add source: ${errorMessage}`,
            };
          }
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    messageMetadata: ({ part }) => {
      // Send sourcesUsed at the start of the message stream
      if (part.type === "start") {
        return { sourcesUsed };
      }
    },
    onFinish: async ({ messages: allMessages }) => {
      if (!chatId) return; // Client must create session first

      try {
        // Save only the last user message and the last assistant response
        const lastUserIdx = allMessages.length >= 2 ? allMessages.length - 2 : -1;
        const lastAssistantIdx = allMessages.length >= 1 ? allMessages.length - 1 : -1;

        const toSave: Array<{
          chat_session_id: string;
          project_id: string;
          user_id: string;
          role: string;
          content: string;
          metadata: Record<string, unknown>;
        }> = [];

        if (lastUserIdx >= 0 && allMessages[lastUserIdx].role === "user") {
          toSave.push({
            chat_session_id: chatId,
            project_id: projectId,
            user_id: user!.id,
            role: "user",
            content: extractTextFromParts(allMessages[lastUserIdx]) || "",
            metadata: { parts: allMessages[lastUserIdx].parts },
          });
        }

        if (lastAssistantIdx >= 0 && allMessages[lastAssistantIdx].role === "assistant") {
          toSave.push({
            chat_session_id: chatId,
            project_id: projectId,
            user_id: user!.id,
            role: "assistant",
            content: extractTextFromParts(allMessages[lastAssistantIdx]) || "",
            metadata: {
              parts: allMessages[lastAssistantIdx].parts,
              sourcesUsed, // Include which sources were used for RAG
            },
          });
        }

        if (toSave.length > 0) {
          await supabase.from("chat_messages").insert(toSave);
        }

        // Update session updated_at
        await supabase
          .from("chat_sessions")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", chatId);
      } catch (error) {
        console.error("Failed to save chat messages:", error);
      }
    },
  });
}

function extractTextFromParts(message: UIMessage | undefined): string | undefined {
  if (!message?.parts) return undefined;
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ");
}
