"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Save,
  FileDown,
  Loader2,
  Sparkles,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Slide {
  id: string;
  title: string;
  content: string;
}

interface SlideEditorProps {
  projectId: string;
  documentId?: string;
  initialTitle?: string;
  initialContent?: string;
  onSave?: (id: string, title: string, content: string) => void;
}

function parseHtmlToSlides(html: string): Slide[] {
  if (!html) return [{ id: crypto.randomUUID(), title: "Title Slide", content: "" }];

  const slides: Slide[] = [];
  const sectionPattern = /<section[^>]*>([\s\S]*?)<\/section>/gi;
  let match;

  while ((match = sectionPattern.exec(html)) !== null) {
    const inner = match[1];
    const titleMatch = inner.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i);
    const title = titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
      : "Untitled Slide";

    // Get content excluding the title tag
    const content = inner
      .replace(/<h[12][^>]*>[\s\S]*?<\/h[12]>/i, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    slides.push({ id: crypto.randomUUID(), title, content });
  }

  if (slides.length === 0) {
    // Try to parse as generic HTML — split by h2 tags
    const parts = html.split(/<h2[^>]*>/i);
    if (parts.length > 1) {
      for (let i = 1; i < parts.length; i++) {
        const [title, ...rest] = parts[i].split(/<\/h2>/i);
        slides.push({
          id: crypto.randomUUID(),
          title: title.replace(/<[^>]+>/g, "").trim(),
          content: rest
            .join("")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim(),
        });
      }
    } else {
      slides.push({
        id: crypto.randomUUID(),
        title: "Title Slide",
        content: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      });
    }
  }

  return slides;
}

function slidesToHtml(slides: Slide[]): string {
  return slides
    .map(
      (s) =>
        `<section>\n  <h1>${s.title}</h1>\n  <p>${s.content}</p>\n</section>`
    )
    .join("\n");
}

export function SlideEditor({
  projectId,
  documentId,
  initialTitle = "Untitled Presentation",
  initialContent = "",
  onSave,
}: SlideEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [docId, setDocId] = useState(documentId);
  const [slides, setSlides] = useState<Slide[]>(() =>
    parseHtmlToSlides(initialContent)
  );
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const activeSlide = slides[activeSlideIndex] || slides[0];

  const updateSlide = (index: number, field: keyof Slide, value: string) => {
    setSlides((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const addSlide = () => {
    const newSlide: Slide = {
      id: crypto.randomUUID(),
      title: "New Slide",
      content: "",
    };
    setSlides((prev) => [
      ...prev.slice(0, activeSlideIndex + 1),
      newSlide,
      ...prev.slice(activeSlideIndex + 1),
    ]);
    setActiveSlideIndex(activeSlideIndex + 1);
  };

  const deleteSlide = (index: number) => {
    if (slides.length <= 1) return;
    setSlides((prev) => prev.filter((_, i) => i !== index));
    if (activeSlideIndex >= slides.length - 1) {
      setActiveSlideIndex(Math.max(0, activeSlideIndex - 1));
    }
  };

  const moveSlide = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= slides.length) return;
    setSlides((prev) => {
      const copy = [...prev];
      [copy[index], copy[newIndex]] = [copy[newIndex], copy[index]];
      return copy;
    });
    setActiveSlideIndex(newIndex);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const html = slidesToHtml(slides);
      const method = docId ? "PUT" : "POST";
      const url = docId ? `/api/documents?id=${docId}` : "/api/documents";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title,
          content: { html },
          type: "slides",
        }),
      });

      if (!response.ok) throw new Error("Failed to save");

      const data = await response.json();
      if (!docId && data.id) setDocId(data.id);
      setLastSaved(new Date());
      onSave?.(data.id || docId!, title, html);
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setSaving(false);
    }
  }, [slides, docId, projectId, title, onSave]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          type: "slides",
          title,
        }),
      });

      if (!response.ok) throw new Error("Generation failed");

      const data = await response.json();
      if (data.html) {
        const parsed = parseHtmlToSlides(data.html);
        setSlides(parsed);
        setActiveSlideIndex(0);
      }
    } catch (error) {
      console.error("Generate error:", error);
    } finally {
      setGenerating(false);
    }
  }, [projectId, title]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const html = slidesToHtml(slides);
      const response = await fetch("/api/documents/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, title, format: "pptx" }),
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title}.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setExporting(false);
    }
  }, [slides, title]);

  return (
    <div className="flex h-full flex-col rounded-lg border bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-8 border-none bg-transparent text-lg font-semibold shadow-none focus-visible:ring-0 px-0"
          placeholder="Presentation title..."
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
            onClick={handleGenerate}
            disabled={generating}
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
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <FileDown className="h-4 w-4 mr-1" />
            )}
            PPTX
          </Button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Slide navigator */}
        <div className="w-48 border-r overflow-y-auto p-2 space-y-2 bg-muted/30">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className={`group relative rounded-lg border p-2 cursor-pointer text-xs transition-colors ${
                index === activeSlideIndex
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
              onClick={() => setActiveSlideIndex(index)}
            >
              <div className="font-medium truncate">{index + 1}. {slide.title}</div>
              <p className="text-muted-foreground truncate mt-0.5">
                {slide.content.slice(0, 50) || "Empty slide"}
              </p>
              <div className="absolute top-1 right-1 hidden group-hover:flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveSlide(index, "up");
                  }}
                  disabled={index === 0}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveSlide(index, "down");
                  }}
                  disabled={index === slides.length - 1}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSlide(index);
                  }}
                  disabled={slides.length <= 1}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1"
            onClick={addSlide}
          >
            <Plus className="h-3 w-3" />
            Add Slide
          </Button>
        </div>

        {/* Slide editor */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeSlide && (
            <div className="max-w-2xl mx-auto space-y-4">
              {/* Slide preview card */}
              <div className="aspect-video rounded-lg border bg-white dark:bg-zinc-900 shadow-sm p-8 flex flex-col">
                <Input
                  value={activeSlide.title}
                  onChange={(e) =>
                    updateSlide(activeSlideIndex, "title", e.target.value)
                  }
                  className="text-2xl font-bold border-none bg-transparent shadow-none focus-visible:ring-0 p-0 h-auto"
                  placeholder="Slide title..."
                />
                <Textarea
                  value={activeSlide.content}
                  onChange={(e) =>
                    updateSlide(activeSlideIndex, "content", e.target.value)
                  }
                  className="flex-1 mt-4 border-none bg-transparent shadow-none focus-visible:ring-0 resize-none p-0 text-sm"
                  placeholder="Slide content... Use each line for a bullet point."
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Slide {activeSlideIndex + 1} of {slides.length}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
