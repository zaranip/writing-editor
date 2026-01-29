"use client";

import { useCallback, useState } from "react";
import { Upload, FileIcon, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Source } from "@/types";

interface FileDropzoneProps {
  projectId: string;
  accept: Record<string, string[]>;
  onSourceAdded: (source: Source) => void;
  sourceType: "pdf" | "image";
}

export function FileDropzone({
  projectId,
  accept,
  onSourceAdded,
  sourceType,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const supabase = createClient();

  const acceptedExtensions = Object.values(accept).flat().join(", ");

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      setUploading(true);

      for (const file of fileArray) {
        try {
          // Upload to Supabase Storage
          const filePath = `${projectId}/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("sources")
            .upload(filePath, file);

          if (uploadError) {
            console.error("Upload error:", uploadError);
            continue;
          }

          // Create source record
          const { data: source, error: dbError } = await supabase
            .from("sources")
            .insert({
              project_id: projectId,
              user_id: (await supabase.auth.getUser()).data.user!.id,
              type: sourceType,
              title: file.name,
              file_path: filePath,
              status: "pending",
            })
            .select()
            .single();

          if (dbError) {
            console.error("DB error:", dbError);
            continue;
          }

          onSourceAdded(source);

          // Trigger ingestion
          fetch("/api/ingest", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sourceId: source.id }),
          });
        } catch (err) {
          console.error("File upload failed:", err);
        }
      }

      setUploading(false);
    },
    [projectId, sourceType, supabase, onSourceAdded]
  );

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50"
      }`}
    >
      {uploading ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Uploading...</p>
        </>
      ) : (
        <>
          {sourceType === "pdf" ? (
            <FileIcon className="h-8 w-8 text-muted-foreground" />
          ) : (
            <Upload className="h-8 w-8 text-muted-foreground" />
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            Drag & drop files here, or{" "}
            <label className="cursor-pointer text-primary underline-offset-4 hover:underline">
              browse
              <input
                type="file"
                className="hidden"
                multiple
                accept={Object.keys(accept).join(",")}
                onChange={handleInputChange}
              />
            </label>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Accepted: {acceptedExtensions}
          </p>
        </>
      )}
    </div>
  );
}
