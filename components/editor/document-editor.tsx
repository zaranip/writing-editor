"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorToolbar } from "./editor-toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState, useCallback, useEffect } from "react";
import { Save, FileDown, Loader2, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DocumentEditorProps {
  projectId: string;
  documentId?: string;
  initialTitle?: string;
  initialContent?: string;
  onSave?: (id: string, title: string, content: string) => void;
  defaultPrompt?: string;  // Pre-filled prompt from chat context
}

export function DocumentEditor({
  projectId,
  documentId,
  initialTitle = "Untitled Document",
  initialContent = "",
  onSave,
  defaultPrompt,
}: DocumentEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [docId, setDocId] = useState(documentId);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState("");

  const editor = useEditor({
    immediatelyRender: false, // Prevent SSR hydration mismatch
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Highlight,
      Placeholder.configure({
        placeholder: 'Start writing or click "Generate" to create content from your research...',
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[400px] px-6 py-4",
      },
    },
  });

  // Update content when initialContent changes (e.g., after generation)
  useEffect(() => {
    if (editor && initialContent && !editor.getHTML().includes(initialContent.slice(0, 50))) {
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent]);

  const handleSave = useCallback(async () => {
    if (!editor) return;
    setSaving(true);

    try {
      const html = editor.getHTML();
      const method = docId ? "PUT" : "POST";
      const url = docId ? `/api/documents?id=${docId}` : "/api/documents";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title,
          content: { html },
          type: "document",
        }),
      });

      if (!response.ok) throw new Error("Failed to save");

      const data = await response.json();
      if (!docId && data.id) {
        setDocId(data.id);
      }
      setLastSaved(new Date());
      onSave?.(data.id || docId!, title, html);
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setSaving(false);
    }
  }, [editor, docId, projectId, title, onSave]);

  const openGenerateDialog = useCallback(() => {
    // Use chat context as default prompt, or fall back to generic suggestion
    if (defaultPrompt) {
      setGeneratePrompt(`Using the sources, create a comprehensive document: ${defaultPrompt}`);
    } else {
      setGeneratePrompt("Using the source information, create a comprehensive document about ");
    }
    setShowGenerateDialog(true);
  }, [defaultPrompt]);

  const handleGenerate = useCallback(async () => {
    if (!editor) return;
    setShowGenerateDialog(false);
    setGenerating(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          type: "document",
          title,
          prompt: generatePrompt,
        }),
      });

      if (!response.ok) throw new Error("Generation failed");

      const data = await response.json();
      if (data.html) {
        editor.commands.setContent(data.html);
      }
      // Update title if returned from API
      if (data.title && data.title !== "Research Document") {
        setTitle(data.title);
      }
    } catch (error) {
      console.error("Generate error:", error);
    } finally {
      setGenerating(false);
    }
  }, [editor, projectId, title, generatePrompt]);

  const handleExport = useCallback(
    async (format: "pdf" | "docx") => {
      if (!editor) return;
      setExporting(true);

      try {
        const response = await fetch("/api/documents/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            html: editor.getHTML(),
            title,
            format,
          }),
        });

        if (!response.ok) throw new Error("Export failed");

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Export error:", error);
      } finally {
        setExporting(false);
      }
    },
    [editor, title]
  );

  return (
    <div className="flex h-full flex-col rounded-lg border bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-8 border-none bg-transparent text-lg font-semibold shadow-none focus-visible:ring-0 px-0"
          placeholder="Document title..."
        />
        <div className="flex items-center gap-1 shrink-0">
          {lastSaved && (
            <span className="text-xs text-muted-foreground mr-2">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={openGenerateDialog}
            disabled={generating}
            title="Generate document from research"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            Generate
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Save
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={exporting}>
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <FileDown className="h-4 w-4 mr-1" />
                )}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("pdf")}>
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("docx")}>
                Export as DOCX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Toolbar */}
      <EditorToolbar editor={editor} />

      {/* Editor content */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Generate Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Document</DialogTitle>
            <DialogDescription>
              Describe what you want to create. Your sources will be used to generate the content.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={generatePrompt}
            onChange={(e) => setGeneratePrompt(e.target.value)}
            placeholder="e.g., Create a 7-day Prague itinerary with daily activities and restaurant recommendations"
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={!generatePrompt.trim()}>
              <Sparkles className="h-4 w-4 mr-1" />
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
