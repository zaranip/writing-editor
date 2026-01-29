"use client";

import { useState } from "react";
import { FileDropzone } from "./file-dropzone";
import { UrlInput } from "./url-input";
import { SourceList } from "./source-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Link as LinkIcon, Youtube, ImageIcon } from "lucide-react";
import type { Source } from "@/types";

interface SourcePanelProps {
  projectId: string;
  sources: Source[];
}

export function SourcePanel({ projectId, sources: initialSources }: SourcePanelProps) {
  const [sources, setSources] = useState<Source[]>(initialSources);

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
        <h3 className="text-sm font-medium mb-3">
          Sources ({sources.length})
        </h3>
        <SourceList
          sources={sources}
          onSourceRemoved={handleSourceRemoved}
        />
      </div>
    </div>
  );
}
