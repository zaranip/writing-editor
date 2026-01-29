import { streamText, tool, stepCountIs, type UIMessage, convertToModelMessages } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { getModel } from "@/lib/ai/provider";
import { retrieveContext, formatContext } from "@/lib/ai/rag";
import { buildContextPrompt } from "@/lib/ai/prompts";
import { searchWeb, scrapeUrl } from "@/lib/search/web-search";
import { chunkText } from "@/lib/ingest/chunker";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import type { LLMProvider } from "@/types";

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

  if (lastUserMessage) {
    try {
      const queryText = lastUserMessage.parts
        ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join(" ") || "";

      if (queryText && openaiKey) {
        const chunks = await retrieveContext(
          queryText,
          projectId,
          user.id,
          openaiKey
        );
        const context = formatContext(chunks);
        systemPrompt = buildContextPrompt(context);
      }
    } catch (error) {
      console.error("RAG retrieval failed:", error);
    }
  }

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
          "Save a web page as a source in the user's project. Use this when you've found a useful web page that the user would want to keep as a research source. The page will be scraped, chunked, and made searchable via RAG.",
        inputSchema: z.object({
          url: z.string().describe("The URL of the source to add"),
          title: z.string().describe("A descriptive title for the source"),
        }),
        execute: async ({ url, title }) => {
          try {
            const { content } = await scrapeUrl(url);

            if (!content || content.trim().length === 0) {
              return { success: false, message: "No content could be extracted from this URL." };
            }

            const { data: source, error: insertError } = await supabase
              .from("sources")
              .insert({
                project_id: projectId,
                user_id: user!.id,
                type: "url",
                title,
                original_url: url,
                content,
                status: "processing",
                metadata: { auto_added: true },
              })
              .select()
              .single();

            if (insertError || !source) {
              return { success: false, message: `Failed to create source: ${insertError?.message}` };
            }

            const chunks = chunkText(content);

            if (openaiKey) {
              try {
                const embeddings = await generateEmbeddings(chunks, openaiKey);
                const chunkRecords = chunks.map((chunkContent, index) => ({
                  source_id: source.id,
                  project_id: projectId,
                  user_id: user!.id,
                  content: chunkContent,
                  chunk_index: index,
                  embedding: JSON.stringify(embeddings[index]),
                }));
                await supabase.from("chunks").insert(chunkRecords);
              } catch {
                const chunkRecords = chunks.map((chunkContent, index) => ({
                  source_id: source.id,
                  project_id: projectId,
                  user_id: user!.id,
                  content: chunkContent,
                  chunk_index: index,
                }));
                await supabase.from("chunks").insert(chunkRecords);
              }
            } else {
              const chunkRecords = chunks.map((chunkContent, index) => ({
                source_id: source.id,
                project_id: projectId,
                user_id: user!.id,
                content: chunkContent,
                chunk_index: index,
              }));
              await supabase.from("chunks").insert(chunkRecords);
            }

            await supabase
              .from("sources")
              .update({ status: "ready" })
              .eq("id", source.id);

            return {
              success: true,
              message: `Added "${title}" to sources (${chunks.length} chunks indexed).`,
              sourceId: source.id,
            };
          } catch (error) {
            return {
              success: false,
              message: `Failed to add source: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
          }
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async ({ messages: allMessages }) => {
      // Persist messages to the database for chat history
      try {
        // Determine the chat session ID
        let sessionId = chatId;

        if (!sessionId) {
          // Create a new chat session
          const firstUserMsg = allMessages.find((m) => m.role === "user");
          const title = firstUserMsg
            ? extractTextFromParts(firstUserMsg)?.slice(0, 100) || "New Chat"
            : "New Chat";

          const { data: session } = await supabase
            .from("chat_sessions")
            .insert({
              project_id: projectId,
              user_id: user!.id,
              title,
            })
            .select()
            .single();

          sessionId = session?.id;
        }

        if (!sessionId) return;

        // Save only the last user message and the last assistant response
        // (previous messages are already saved from earlier calls)
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
            chat_session_id: sessionId,
            project_id: projectId,
            user_id: user!.id,
            role: "user",
            content: extractTextFromParts(allMessages[lastUserIdx]) || "",
            metadata: {},
          });
        }

        if (lastAssistantIdx >= 0 && allMessages[lastAssistantIdx].role === "assistant") {
          toSave.push({
            chat_session_id: sessionId,
            project_id: projectId,
            user_id: user!.id,
            role: "assistant",
            content: extractTextFromParts(allMessages[lastAssistantIdx]) || "",
            metadata: {},
          });
        }

        if (toSave.length > 0) {
          await supabase.from("chat_messages").insert(toSave);
        }

        // Update session title if it's the first exchange
        if (!chatId) {
          const userText = extractTextFromParts(allMessages.find((m) => m.role === "user")!) || "New Chat";
          await supabase
            .from("chat_sessions")
            .update({ title: userText.slice(0, 100) })
            .eq("id", sessionId);
        }
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
