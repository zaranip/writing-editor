import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { getModel } from "@/lib/ai/provider";

export const maxDuration = 120;

interface SourceData {
  id: string;
  title: string;
  original_url: string | null;
  content: string | null;
  file_path: string | null;
  metadata: {
    image_paths?: string[];
    [key: string]: unknown;
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { projectId, type, title, prompt } = await request.json();

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

  // Fetch all ready sources for the project
  const { data: sources } = await supabase
    .from("sources")
    .select("id, title, original_url, content, file_path, metadata")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .eq("status", "ready");

  // Build context from sources
  let context = "No sources available.";
  const imageUrls: string[] = [];

  if (sources && sources.length > 0) {
    const contextParts: string[] = [];
    
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i] as SourceData;
      let sourceContent = source.content || "";
      
      // If there's a file_path, try to download the full .txt content
      if (source.file_path) {
        try {
          const { data: fileData } = await supabase.storage
            .from("sources")
            .download(source.file_path);
          
          if (fileData) {
            sourceContent = await fileData.text();
          }
        } catch (e) {
          console.error(`Failed to download source file: ${source.file_path}`, e);
        }
      }
      
      // Collect image URLs for presentations
      // Handle metadata that might be string or object
      let metadata = source.metadata;
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch {
          metadata = {};
        }
      }
      
      const imagePaths = metadata?.image_paths || [];
      console.log(`[Generate] Source "${source.title}" metadata:`, JSON.stringify(metadata));
      console.log(`[Generate] Source "${source.title}" image_paths:`, imagePaths);
      
      if (imagePaths.length > 0) {
        for (const imgPath of imagePaths) {
          const { data: urlData } = supabase.storage.from("sources").getPublicUrl(imgPath);
          if (urlData?.publicUrl) {
            console.log(`[Generate] Image URL generated: ${urlData.publicUrl}`);
            imageUrls.push(urlData.publicUrl);
          }
        }
      }
      
      contextParts.push(
        `[Source ${i + 1}: ${source.title}]${source.original_url ? `\nURL: ${source.original_url}` : ""}\n\n${sourceContent}`
      );
    }
    
    context = contextParts.join("\n\n---\n\n");
  }

  // Fetch recent chat messages for additional context (from newest chat session)
  const { data: latestSession } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  let messages: { role: string; content: string }[] | null = null;
  if (latestSession?.id) {
    const { data } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("chat_session_id", latestSession.id)
      .order("created_at", { ascending: false })
      .limit(20);
    messages = data;
  }

  const chatContext = messages?.length
    ? `\n\n--- RECENT CHAT CONTEXT ---\n${messages
        .reverse()
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n")}`
    : "";

  // Generate a short title (2-4 words) from the prompt - extracts the actual topic
  function generateShortTitle(text: string): string {
    if (!text) return "Research Document";
    
    // Remove common request prefixes and clean up
    let cleaned = text
      // Remove "Using the sources, create a document/presentation:" prefix
      .replace(/^(using the sources?,?\s*)?(please\s+)?(can you\s+)?(create|make|write|generate|give|build|design)\s+(me\s+)?(a\s+)?(comprehensive\s+)?(detailed\s+)?(document|presentation|report|summary|slide[s]?)(\s+about|\s+on|\s+for)?:?\s*/i, "")
      // Remove "I want/need a..." prefix  
      .replace(/^(i\s+)?(want|need|would like)\s+(a\s+)?/i, "")
      // Remove trailing "please", "thanks", etc.
      .replace(/\s+(please|thanks|thank you)\.?$/i, "")
      .trim();
    
    // Common words to filter out (verbs, articles, prepositions, pronouns)
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'for', 'with', 'from', 'about', 
      'that', 'this', 'into', 'onto', 'of', 'to', 'in', 'on', 'at', 'by',
      'give', 'me', 'make', 'create', 'write', 'build', 'get', 'find',
      'i', 'my', 'we', 'our', 'you', 'your', 'it', 'its',
      'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'some', 'any', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
    ]);
    
    // Extract words, keeping numbers attached to following words (e.g., "7 day" -> "7-day")
    const words = cleaned
      .split(/\s+/)
      .filter(w => w.length > 0)
      .filter(w => !stopWords.has(w.toLowerCase()));
    
    if (words.length === 0) return "Research Document";
    
    // Look for place names (capitalized words) and key nouns
    // Prioritize: place names, then numbers+nouns, then regular nouns
    const result: string[] = [];
    
    for (let i = 0; i < words.length && result.length < 3; i++) {
      const word = words[i];
      // Keep numbers with their following word (e.g., "7" + "day" -> "7-Day")
      if (/^\d+$/.test(word) && i + 1 < words.length) {
        result.push(`${word}-${words[i + 1].charAt(0).toUpperCase()}${words[i + 1].slice(1).toLowerCase()}`);
        i++; // Skip next word since we combined it
      } else if (word.length > 2) {
        // Capitalize first letter
        result.push(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
      }
    }
    
    return result.length > 0 ? result.join(" ") : "Research Document";
  }
  
  const shortTitle = generateShortTitle(prompt || title || "");
  const docTitle = prompt || title || "Research Document"; // Full prompt for AI context

  // Build image context for presentations
  const imageContext = type === "slides" && imageUrls.length > 0
    ? `\n\n--- AVAILABLE IMAGES (MUST USE) ---\nYou MUST include these images in your slides. Use exact URLs with <img> tags:\n${imageUrls.map((url, i) => `Image ${i + 1}: ${url}`).join("\n")}\n\nIMPORTANT: Copy the image URLs EXACTLY as shown above. Include at least one image per 2-3 slides.\n`
    : "";
  
  console.log(`[Generate] Type: ${type}, Images found: ${imageUrls.length}`);
  if (imageUrls.length > 0) {
    console.log(`[Generate] Image URLs to use:`, imageUrls);
  }

  let systemPrompt: string;

  if (type === "slides") {
    systemPrompt = `You are an expert presentation designer. Create a slide deck based on the research sources and chat context provided.

Output the content as structured HTML where each slide is a <section> element. Use this format:
<section>
  <h1>Slide Title</h1>
  <p>Content or bullet points</p>
  <ul><li>Point 1</li><li>Point 2</li></ul>
  <img src="EXACT_URL_FROM_AVAILABLE_IMAGES" alt="description">
</section>

${imageUrls.length > 0 ? `**IMAGES - REQUIRED:**
You have ${imageUrls.length} images that MUST be included in your slides. The exact URLs are provided in the AVAILABLE IMAGES section below.
- Copy each image URL EXACTLY as provided (do not modify or shorten)
- Use format: <img src="EXACT_URL" alt="description">
- Distribute images across slides (at least 1 image per 3 slides)
- Place images after the slide content, before </section>` : ""}

Guidelines:
- Create 8-15 slides
- First slide: Title slide with the presentation title and a subtitle
- Include a table of contents/agenda slide
- Each slide should have a clear heading and 3-5 bullet points or a brief paragraph
- Use concise, presentation-friendly language
${imageUrls.length > 0 ? "- YOU MUST include images from the AVAILABLE IMAGES section - this is required" : ""}
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
    const userPrompt = `Create a ${type === "slides" ? "slide presentation" : "research document"} about: "${docTitle}".

--- SOURCE CONTEXT ---
${context}
${chatContext}
${imageContext}
--- END CONTEXT ---

Generate the ${type === "slides" ? "slides" : "document"} now. Output ONLY the HTML content, no markdown, no code fences.`;
    
    console.log(`[Generate] Sending to AI. Image context included: ${imageContext.length > 0}`);
    if (imageContext.length > 0) {
      console.log(`[Generate] Image context:`, imageContext);
    }
    
    const { text } = await generateText({
      model: getModel(provider, modelId, apiKey),
      system: systemPrompt,
      prompt: userPrompt,
    });
    
    console.log(`[Generate] AI response contains <img>: ${text.includes('<img')}`);
    if (text.includes('<img')) {
      const imgMatches = text.match(/<img[^>]+>/g);
      console.log(`[Generate] Found ${imgMatches?.length || 0} img tags:`, imgMatches?.slice(0, 3));
    }

    return NextResponse.json({ html: text, title: shortTitle });
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
