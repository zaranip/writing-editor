"use client";

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

export function SourceList({ sources, onSourceRemoved }: SourceListProps) {
  const supabase = createClient();

  async function handleDelete(source: Source) {
    // Delete from storage if it has a file
    if (source.file_path) {
      await supabase.storage.from("sources").remove([source.file_path]);
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
        const TypeIcon = TYPE_ICONS[source.type] || FileText;
        const status = STATUS_CONFIG[source.status];
        const StatusIcon = status.icon;

        return (
          <div
            key={source.id}
            className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
          >
            <div className="rounded-md bg-muted p-2">
              <TypeIcon className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{source.title}</p>
              {source.original_url && (
                <p className="text-xs text-muted-foreground truncate">
                  {source.original_url}
                </p>
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
