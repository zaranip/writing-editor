"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Globe,
  Youtube,
  ImageIcon,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import type { Source } from "@/types";

interface SourceListProps {
  sources: Source[];
  onSourceRemoved: (sourceId: string) => void;
}

const TYPE_ICONS = {
  pdf: FileText,
  text: FileText,
  url: Globe,
  youtube: Youtube,
  image: ImageIcon,
};

const STATUS_CONFIG: Record<string, {
  icon: typeof Clock;
  label: string;
  variant: "secondary" | "default" | "destructive";
  animate?: boolean;
}> = {
  pending: {
    icon: Clock,
    label: "Pending",
    variant: "secondary",
  },
  processing: {
    icon: Loader2,
    label: "Processing",
    variant: "default",
    animate: true,
  },
  ready: {
    icon: CheckCircle2,
    label: "Ready",
    variant: "secondary",
  },
  error: {
    icon: AlertCircle,
    label: "Error",
    variant: "destructive",
  },
};

// Component to display source thumbnail
function SourceThumbnail({ source }: { source: Source }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const supabase = createClient();
  
  useEffect(() => {
    // Check if source has image paths in metadata
    const imagePaths = (source.metadata as { image_paths?: string[] })?.image_paths;
    if (imagePaths && imagePaths.length > 0) {
      // Get public URL for first image
      const { data } = supabase.storage.from("sources").getPublicUrl(imagePaths[0]);
      if (data?.publicUrl) {
        setImageUrl(data.publicUrl);
      }
    }
  }, [source.metadata, supabase.storage]);

  if (imageUrl) {
    return (
      <div className="rounded-md overflow-hidden w-10 h-10 bg-muted flex-shrink-0">
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setImageUrl(null)}
        />
      </div>
    );
  }

  const TypeIcon = TYPE_ICONS[source.type] || FileText;
  return (
    <div className="rounded-md bg-muted p-2 flex-shrink-0">
      <TypeIcon className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

export function SourceList({ sources, onSourceRemoved }: SourceListProps) {
  const supabase = createClient();

  async function handleDelete(source: Source) {
    const filesToDelete: string[] = [];
    
    // Add main file path
    if (source.file_path) {
      filesToDelete.push(source.file_path);
    }
    
    // Add image paths from metadata
    const imagePaths = (source.metadata as { image_paths?: string[] })?.image_paths;
    if (imagePaths) {
      filesToDelete.push(...imagePaths);
    }
    
    // Delete all files from storage
    if (filesToDelete.length > 0) {
      await supabase.storage.from("sources").remove(filesToDelete);
    }

    // Delete from database (cascades to chunks)
    await supabase.from("sources").delete().eq("id", source.id);

    onSourceRemoved(source.id);
  }

  if (sources.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        No sources added yet. Upload files or add URLs above.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {sources.map((source) => {
        const status = STATUS_CONFIG[source.status];
        const StatusIcon = status.icon;

        return (
          <div
            key={source.id}
            className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
          >
            <SourceThumbnail source={source} />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{source.title}</p>
              {source.original_url && (
                <a
                  href={source.original_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary truncate flex items-center gap-1 group"
                >
                  <span className="truncate">{new URL(source.original_url).hostname}</span>
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </a>
              )}
            </div>

            <Badge variant={status.variant} className="shrink-0 gap-1">
              <StatusIcon
                className={`h-3 w-3 ${status.animate ? "animate-spin" : ""}`}
              />
              {status.label}
            </Badge>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => handleDelete(source)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
