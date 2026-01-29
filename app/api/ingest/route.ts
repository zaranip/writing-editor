import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { extractPdfText } from "@/lib/ingest/pdf";
import { extractUrlText } from "@/lib/ingest/url";
import { extractYoutubeTranscript } from "@/lib/ingest/youtube";
import { extractImageText } from "@/lib/ingest/image";
import { chunkText } from "@/lib/ingest/chunker";
import { generateEmbeddings } from "@/lib/ai/embeddings";

export const maxDuration = 60; // Allow up to 60s for processing

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { sourceId } = await request.json();

  if (!sourceId) {
    return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
  }

  // Fetch the source
  const { data: source, error: sourceError } = await supabase
    .from("sources")
    .select("*")
    .eq("id", sourceId)
    .eq("user_id", user.id)
    .single();

  if (sourceError || !source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  // Update status to processing
  await supabase
    .from("sources")
    .update({ status: "processing" })
    .eq("id", sourceId);

  try {
    // Step 1: Extract text based on source type
    let extractedText = "";

    switch (source.type) {
      case "pdf": {
        // Download from Supabase Storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("sources")
          .download(source.file_path!);

        if (downloadError) throw new Error(`Download failed: ${downloadError.message}`);

        const buffer = Buffer.from(await fileData.arrayBuffer());
        extractedText = await extractPdfText(buffer);
        break;
      }

      case "url": {
        extractedText = await extractUrlText(source.original_url!);
        break;
      }

      case "youtube": {
        extractedText = await extractYoutubeTranscript(source.original_url!);
        break;
      }

      case "image": {
        // Get the user's OpenAI key (or Google key) for vision
        const { data: apiKeys } = await supabase
          .from("api_keys")
          .select("*")
          .eq("user_id", user.id);

        const openaiKey = apiKeys?.find((k) => k.provider === "openai");
        const googleKey = apiKeys?.find((k) => k.provider === "google");

        if (!openaiKey && !googleKey) {
          throw new Error("An OpenAI or Google API key is required for image processing");
        }

        // Get public URL for the image
        const { data: urlData } = supabase.storage
          .from("sources")
          .getPublicUrl(source.file_path!);

        const provider = openaiKey ? "openai" : "google";
        const key = openaiKey
          ? decrypt(openaiKey.encrypted_key)
          : decrypt(googleKey!.encrypted_key);

        extractedText = await extractImageText(urlData.publicUrl, key, provider as "openai" | "google");
        break;
      }

      case "text": {
        // For text files, download and read
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("sources")
          .download(source.file_path!);

        if (downloadError) throw new Error(`Download failed: ${downloadError.message}`);
        extractedText = await fileData.text();
        break;
      }
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error("No text could be extracted from this source");
    }

    // Step 2: Update source with extracted text
    await supabase
      .from("sources")
      .update({ content: extractedText })
      .eq("id", sourceId);

    // Step 3: Chunk the text
    const chunks = chunkText(extractedText);

    // Step 4: Generate embeddings
    // Get OpenAI key for embeddings
    const { data: apiKeys } = await supabase
      .from("api_keys")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "openai");

    if (!apiKeys || apiKeys.length === 0) {
      // Store chunks without embeddings — RAG won't work but text is saved
      const chunkRecords = chunks.map((content, index) => ({
        source_id: sourceId,
        project_id: source.project_id,
        user_id: user.id,
        content,
        chunk_index: index,
      }));

      await supabase.from("chunks").insert(chunkRecords);

      await supabase
        .from("sources")
        .update({
          status: "ready",
          error_message: "Processed without embeddings — add an OpenAI API key for RAG search",
        })
        .eq("id", sourceId);

      return NextResponse.json({ success: true, chunks: chunks.length, embeddings: false });
    }

    const openaiApiKey = decrypt(apiKeys[0].encrypted_key);
    const embeddings = await generateEmbeddings(chunks, openaiApiKey);

    // Step 5: Store chunks with embeddings
    const chunkRecords = chunks.map((content, index) => ({
      source_id: sourceId,
      project_id: source.project_id,
      user_id: user.id,
      content,
      chunk_index: index,
      embedding: JSON.stringify(embeddings[index]),
    }));

    const { error: insertError } = await supabase.from("chunks").insert(chunkRecords);

    if (insertError) {
      throw new Error(`Failed to store chunks: ${insertError.message}`);
    }

    // Step 6: Mark source as ready
    await supabase
      .from("sources")
      .update({ status: "ready" })
      .eq("id", sourceId);

    return NextResponse.json({
      success: true,
      chunks: chunks.length,
      embeddings: true,
    });
  } catch (error) {
    console.error("Ingestion error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await supabase
      .from("sources")
      .update({
        status: "error",
        error_message: errorMessage,
      })
      .eq("id", sourceId);

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
