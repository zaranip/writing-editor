import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { getModel } from "@/lib/ai/provider";
import { retrieveContext, formatContext } from "@/lib/ai/rag";

export const maxDuration = 120;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { projectId, type, title } = await request.json();

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  // Get all user's API keys to find an available provider
  const { data: apiKeys } = await supabase
    .from("api_keys")
    .select("*")
    .eq("user_id", user.id);

  if (!apiKeys || apiKeys.length === 0) {
    return NextResponse.json(
      { error: "No API keys configured. Please add one in Settings." },
      { status: 400 }
    );
  }

  // Pick the best available provider (prefer OpenAI > Anthropic > Google for generation)
  const preferred = ["openai", "anthropic", "google"];
  const selectedKey = preferred
    .map((p) => apiKeys.find((k) => k.provider === p))
    .find(Boolean);

  if (!selectedKey) {
    return NextResponse.json({ error: "No supported API key found." }, { status: 400 });
  }

  const apiKey = decrypt(selectedKey.encrypted_key);
  const provider = selectedKey.provider as "openai" | "anthropic" | "google";

  // Choose a model for generation
  const modelMap = {
    openai: "gpt-4o",
    anthropic: "claude-sonnet-4-20250514",
    google: "gemini-2.0-flash",
  };
  const modelId = modelMap[provider];

  // Get OpenAI key for RAG embeddings
  let openaiKey = apiKey;
  if (provider !== "openai") {
    const openaiKeyRecord = apiKeys.find((k) => k.provider === "openai");
    if (openaiKeyRecord) {
      openaiKey = decrypt(openaiKeyRecord.encrypted_key);
    }
  }

  // Retrieve all relevant context from the project sources
  let context = "No sources available.";
  try {
    const chunks = await retrieveContext(
      title || "comprehensive research summary",
      projectId,
      user.id,
      openaiKey,
      20, // Get more chunks for document generation
      0.5  // Lower threshold for broader coverage
    );
    context = formatContext(chunks);
  } catch (error) {
    console.error("RAG retrieval failed:", error);
  }

  // Fetch recent chat messages for additional context
  const { data: messages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(20);

  const chatContext = messages?.length
    ? `\n\n--- RECENT CHAT CONTEXT ---\n${messages
        .reverse()
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n")}`
    : "";

  const docTitle = title || "Research Document";

  let systemPrompt: string;

  if (type === "slides") {
    systemPrompt = `You are an expert presentation designer. Create a slide deck based on the research sources and chat context provided.

Output the content as structured HTML where each slide is a <section> element. Use this format:
<section>
  <h1>Slide Title</h1>
  <p>Content or bullet points</p>
  <ul><li>Point 1</li><li>Point 2</li></ul>
</section>

Guidelines:
- Create 8-15 slides
- First slide: Title slide with the presentation title and a subtitle
- Include a table of contents/agenda slide
- Each slide should have a clear heading and 3-5 bullet points or a brief paragraph
- Use concise, presentation-friendly language
- Include a summary/conclusion slide
- Include a references/sources slide at the end
- Base ALL content on the provided source context
- Cite sources using [Source N] notation`;
  } else {
    systemPrompt = `You are an expert research writer. Create a well-structured, comprehensive research document based on the sources and chat context provided.

Output the content as clean HTML suitable for a rich text editor. Use proper HTML tags:
- <h1> for the document title
- <h2> for major sections
- <h3> for subsections
- <p> for paragraphs
- <ul>/<ol> with <li> for lists
- <blockquote> for important quotes
- <strong> and <em> for emphasis
- <hr> for section breaks

Guidelines:
- Start with the document title as <h1>
- Include an executive summary/introduction
- Organize content into logical sections with clear headings
- Be thorough and detailed — aim for 1500-3000 words
- Cite sources using [Source N] notation throughout
- Include a conclusion section
- Include a references section at the end listing all cited sources
- Base ALL content on the provided source context
- Write in a professional, academic tone`;
  }

  try {
    const { text } = await generateText({
      model: getModel(provider, modelId, apiKey),
      system: systemPrompt,
      prompt: `Create a ${type === "slides" ? "slide presentation" : "research document"} titled "${docTitle}".

--- SOURCE CONTEXT ---
${context}
${chatContext}
--- END CONTEXT ---

Generate the ${type === "slides" ? "slides" : "document"} now. Output ONLY the HTML content, no markdown, no code fences.`,
    });

    return NextResponse.json({ html: text });
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
