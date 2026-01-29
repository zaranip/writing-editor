"use client";

import { useState, useEffect, useCallback } from "react";
import { DocumentEditor } from "@/components/editor/document-editor";
import { SlideEditor } from "@/components/editor/slide-editor";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Presentation,
  Plus,
  Trash2,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import type { Document } from "@/types";

interface DocumentsPanelProps {
  projectId: string;
}

export function DocumentsPanel({ projectId }: DocumentsPanelProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDoc, setActiveDoc] = useState<Document | null>(null);
  const [creating, setCreating] = useState<"document" | "slides" | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== id));
        if (activeDoc?.id === id) setActiveDoc(null);
      }
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  };

  const handleNewDocument = (type: "document" | "slides") => {
    setCreating(type);
    setActiveDoc(null);
  };

  const handleSave = useCallback(
    (id: string, title: string) => {
      // Refresh the document list
      fetchDocuments();
      setCreating(null);
      // Update active doc if it was newly created
      if (!activeDoc) {
        setActiveDoc({
          id,
          project_id: projectId,
          user_id: "",
          title,
          type: creating || "document",
          content: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    },
    [activeDoc, creating, fetchDocuments, projectId]
  );

  // Show editor if editing or creating
  if (activeDoc || creating) {
    const isSlides = creating === "slides" || activeDoc?.type === "slides";

    return (
      <div className="flex h-full flex-col">
        <div className="mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setActiveDoc(null);
              setCreating(null);
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to documents
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          {isSlides ? (
            <SlideEditor
              projectId={projectId}
              documentId={activeDoc?.id}
              initialTitle={activeDoc?.title || "Untitled Presentation"}
              initialContent={
                activeDoc?.content && typeof activeDoc.content === "object" && "html" in activeDoc.content
                  ? String(activeDoc.content.html)
                  : ""
              }
              onSave={handleSave}
            />
          ) : (
            <DocumentEditor
              projectId={projectId}
              documentId={activeDoc?.id}
              initialTitle={activeDoc?.title || "Untitled Document"}
              initialContent={
                activeDoc?.content && typeof activeDoc.content === "object" && "html" in activeDoc.content
                  ? String(activeDoc.content.html)
                  : ""
              }
              onSave={handleSave}
            />
          )}
        </div>
      </div>
    );
  }

  // Document list view
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button onClick={() => handleNewDocument("document")} className="gap-2">
          <Plus className="h-4 w-4" />
          <FileText className="h-4 w-4" />
          New Document
        </Button>
        <Button
          onClick={() => handleNewDocument("slides")}
          variant="outline"
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          <Presentation className="h-4 w-4" />
          New Slides
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No documents yet</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            Create a new document or presentation. You can generate content from your
            research sources using AI, then edit and export it.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => setActiveDoc(doc)}
            >
              <div className="flex items-center gap-3">
                {doc.type === "slides" ? (
                  <Presentation className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <FileText className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <h4 className="font-medium">{doc.title}</h4>
                  <p className="text-xs text-muted-foreground">
                    {doc.type === "slides" ? "Presentation" : "Document"} &middot;
                    Updated {new Date(doc.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(doc.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
