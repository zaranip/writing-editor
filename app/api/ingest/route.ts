import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { extractPdfText } from "@/lib/ingest/pdf";
import { extractYoutubeTranscript } from "@/lib/ingest/youtube";
import { extractImageText } from "@/lib/ingest/image";
import { scrapeUrlWithImages } from "@/lib/search/web-search";

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
    // Generate file prefix for this source
    const timestamp = Date.now();
    const safeTitle = source.title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 50);
    const filePrefix = `${source.project_id}/${timestamp}-${safeTitle}`;
    
    let extractedText = "";
    let textFilePath: string | null = null;
    const savedImagePaths: string[] = [];

    switch (source.type) {
      case "pdf": {
        // Download PDF from Supabase Storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("sources")
          .download(source.file_path!);

        if (downloadError) throw new Error(`Download failed: ${downloadError.message}`);

        const buffer = Buffer.from(await fileData.arrayBuffer());
        extractedText = await extractPdfText(buffer);
        
        // Save extracted text to .txt file
        const textContent = `# ${source.title}\n\nSource: PDF Document\n\n## Content\n\n${extractedText}`;
        const textBlob = new Blob([textContent], { type: "text/plain" });
        textFilePath = `${filePrefix}/content.txt`;
        
        await supabase.storage.from("sources").upload(textFilePath, textBlob, { contentType: "text/plain" });
        break;
      }

      case "url": {
        // Scrape URL with images
        const { content, description, featuredImages } = await scrapeUrlWithImages(source.original_url!);
        extractedText = content;
        
        // Save text content to .txt file
        const textContent = `# ${source.title}\n\nSource: ${source.original_url}\n\n${description ? `## Summary\n${description}\n\n` : ""}## Content\n\n${content}`;
        const textBlob = new Blob([textContent], { type: "text/plain" });
        textFilePath = `${filePrefix}/content.txt`;
        
        const { error: textUploadError } = await supabase.storage
          .from("sources")
          .upload(textFilePath, textBlob, { contentType: "text/plain" });
        
        if (textUploadError) throw new Error(`Failed to save content: ${textUploadError.message}`);

        // Download and save featured images
        for (let i = 0; i < Math.min(featuredImages.length, 3); i++) {
          try {
            const imgResponse = await fetch(featuredImages[i], {
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
        break;
      }

      case "youtube": {
        extractedText = await extractYoutubeTranscript(source.original_url!);
        
        // Save transcript to .txt file
        const textContent = `# ${source.title}\n\nSource: ${source.original_url}\n\n## Transcript\n\n${extractedText}`;
        const textBlob = new Blob([textContent], { type: "text/plain" });
        textFilePath = `${filePrefix}/content.txt`;
        
        await supabase.storage.from("sources").upload(textFilePath, textBlob, { contentType: "text/plain" });
        break;
      }

      case "image": {
        // Get the user's API key for vision
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
        const { data: urlData } = supabase.storage.from("sources").getPublicUrl(source.file_path!);

        const provider = openaiKey ? "openai" : "google";
        const key = openaiKey ? decrypt(openaiKey.encrypted_key) : decrypt(googleKey!.encrypted_key);

        extractedText = await extractImageText(urlData.publicUrl, key, provider as "openai" | "google");
        
        // Save description to .txt file
        const textContent = `# ${source.title}\n\nSource: Uploaded Image\n\n## Image Description\n\n${extractedText}`;
        const textBlob = new Blob([textContent], { type: "text/plain" });
        textFilePath = `${filePrefix}/content.txt`;
        
        await supabase.storage.from("sources").upload(textFilePath, textBlob, { contentType: "text/plain" });
        
        // Keep the original image path
        if (source.file_path) {
          savedImagePaths.push(source.file_path);
        }
        break;
      }

      case "text": {
        // For text files, download and read
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("sources")
          .download(source.file_path!);

        if (downloadError) throw new Error(`Download failed: ${downloadError.message}`);
        extractedText = await fileData.text();
        // Keep original file path for text files
        textFilePath = source.file_path;
        break;
      }
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error("No text could be extracted from this source");
    }

    // Update source with file paths and summary
    await supabase
      .from("sources")
      .update({
        status: "ready",
        file_path: textFilePath,
        content: extractedText.slice(0, 500), // Store preview/summary
        metadata: {
          ...((source.metadata as Record<string, unknown>) || {}),
          image_paths: savedImagePaths,
          processed_at: new Date().toISOString(),
        },
      })
      .eq("id", sourceId);

    return NextResponse.json({
      success: true,
      textFile: textFilePath,
      images: savedImagePaths.length,
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
