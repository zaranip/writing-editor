"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Source, SourceType } from "@/types";

interface UrlInputProps {
  projectId: string;
  onSourceAdded: (source: Source) => void;
  type: SourceType;
  placeholder: string;
  label: string;
}

export function UrlInput({
  projectId,
  onSourceAdded,
  type,
  placeholder,
  label,
}: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setError(null);
    setLoading(true);

    try {
      // Validate URL
      new URL(url);

      // For YouTube, validate it's a YouTube URL
      if (type === "youtube") {
        const isYouTube =
          url.includes("youtube.com") || url.includes("youtu.be");
        if (!isYouTube) {
          setError("Please enter a valid YouTube URL");
          setLoading(false);
          return;
        }
      }

      // Create source record
      const title =
        type === "youtube"
          ? `YouTube: ${url}`
          : new URL(url).hostname + new URL(url).pathname.slice(0, 50);

      const { data: source, error: dbError } = await supabase
        .from("sources")
        .insert({
          project_id: projectId,
          user_id: (await supabase.auth.getUser()).data.user!.id,
          type,
          title,
          original_url: url,
          status: "pending",
        })
        .select()
        .single();

      if (dbError) throw new Error(dbError.message);

      onSourceAdded(source);
      setUrl("");

      // Trigger ingestion
      fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: source.id }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid URL");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          type="url"
          placeholder={placeholder}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <Button type="submit" disabled={loading || !url.trim()}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Plus className="mr-1 h-4 w-4" />
              Add
            </>
          )}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
