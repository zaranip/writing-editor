"use client";

import { useState, useEffect } from "react";
import { FileDropzone } from "./file-dropzone";
import { UrlInput } from "./url-input";
import { SourceList } from "./source-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Upload, Link as LinkIcon, Youtube, ImageIcon, RefreshCw } from "lucide-react";
import type { Source } from "@/types";

interface SourcePanelProps {
  projectId: string;
  sources: Source[];
  onRefresh?: () => void;
}

export function SourcePanel({ projectId, sources: initialSources, onRefresh }: SourcePanelProps) {
  const [sources, setSources] = useState<Source[]>(initialSources);

  // Sync internal state when parent updates sources (e.g., after AI adds a source)
  useEffect(() => {
    setSources(initialSources);
  }, [initialSources]);

  // Poll for status updates when there are pending/processing sources
  useEffect(() => {
    const pendingSources = sources.filter(
      (s) => s.status === "pending" || s.status === "processing"
    );
    if (pendingSources.length === 0 || !onRefresh) return;

    const interval = setInterval(() => {
      onRefresh();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [sources, onRefresh]);

  function handleSourceAdded(source: Source) {
    setSources((prev) => [source, ...prev]);
  }

  function handleSourceRemoved(sourceId: string) {
    setSources((prev) => prev.filter((s) => s.id !== sourceId));
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="file">
        <TabsList>
          <TabsTrigger value="file" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            File
          </TabsTrigger>
          <TabsTrigger value="url" className="gap-1.5">
            <LinkIcon className="h-3.5 w-3.5" />
            URL
          </TabsTrigger>
          <TabsTrigger value="youtube" className="gap-1.5">
            <Youtube className="h-3.5 w-3.5" />
            YouTube
          </TabsTrigger>
          <TabsTrigger value="image" className="gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" />
            Image
          </TabsTrigger>
        </TabsList>

        <TabsContent value="file" className="mt-4">
          <FileDropzone
            projectId={projectId}
            accept={{ "application/pdf": [".pdf"], "text/plain": [".txt", ".md"] }}
            onSourceAdded={handleSourceAdded}
            sourceType="pdf"
          />
        </TabsContent>

        <TabsContent value="url" className="mt-4">
          <UrlInput
            projectId={projectId}
            onSourceAdded={handleSourceAdded}
            type="url"
            placeholder="https://example.com/article"
            label="Enter a web URL to analyze"
          />
        </TabsContent>

        <TabsContent value="youtube" className="mt-4">
          <UrlInput
            projectId={projectId}
            onSourceAdded={handleSourceAdded}
            type="youtube"
            placeholder="https://youtube.com/watch?v=..."
            label="Enter a YouTube video URL"
          />
        </TabsContent>

        <TabsContent value="image" className="mt-4">
          <FileDropzone
            projectId={projectId}
            accept={{ "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif"] }}
            onSourceAdded={handleSourceAdded}
            sourceType="image"
          />
        </TabsContent>
      </Tabs>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">
            Sources ({sources.length})
          </h3>
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              className="h-7 gap-1.5 text-xs text-muted-foreground"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </Button>
          )}
        </div>
        <SourceList
          sources={sources}
          onSourceRemoved={handleSourceRemoved}
        />
      </div>
    </div>
  );
}
