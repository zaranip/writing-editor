"use client";

import { useState, useCallback } from "react";

// Safe ID generator that works in all environments (SSR, client, older browsers)
function generateId(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Slide {
  id: string;
  title: string;
  content: string;
  bullets: string[];  // Parsed bullet points for display
  imageUrl?: string;  // Optional image for the slide
}

interface SlideEditorProps {
  projectId: string;
  documentId?: string;
  initialTitle?: string;
  initialContent?: string;
  onSave?: (id: string, title: string, content: string) => void;
  defaultPrompt?: string;  // Pre-filled prompt from chat context
}

function extractBullets(html: string): string[] {
  const bullets: string[] = [];
  const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = liPattern.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, "").trim();
    if (text) bullets.push(text);
  }
  return bullets;
}

function extractImageUrl(html: string): string | undefined {
  // Try to find img tag with src attribute
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) {
    console.log("[SlideParser] Found image URL:", imgMatch[1]);
    return imgMatch[1];
  }
  // Also check for src without quotes (malformed HTML)
  const imgMatchNoQuotes = html.match(/<img[^>]+src=([^\s>]+)/i);
  if (imgMatchNoQuotes) {
    console.log("[SlideParser] Found image URL (no quotes):", imgMatchNoQuotes[1]);
    return imgMatchNoQuotes[1];
  }
  return undefined;
}

function parseHtmlToSlides(html: string): Slide[] {
  if (!html) return [{ id: generateId(), title: "Title Slide", content: "", bullets: [] }];

  const slides: Slide[] = [];
  const sectionPattern = /<section[^>]*>([\s\S]*?)<\/section>/gi;
  let match;

  while ((match = sectionPattern.exec(html)) !== null) {
    const inner = match[1];
    const titleMatch = inner.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i);
    const title = titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
      : "Untitled Slide";

    // Extract bullet points from <ul>/<ol> lists
    const bullets = extractBullets(inner);
    
    // Extract image URL if present
    const imageUrl = extractImageUrl(inner);

    // Get content excluding the title tag, lists, and images
    const content = inner
      .replace(/<h[12][^>]*>[\s\S]*?<\/h[12]>/i, "")
      .replace(/<ul[^>]*>[\s\S]*?<\/ul>/gi, "")
      .replace(/<ol[^>]*>[\s\S]*?<\/ol>/gi, "")
      .replace(/<img[^>]*>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    slides.push({ id: generateId(), title, content, bullets, imageUrl });
  }

  if (slides.length === 0) {
    // Try to parse as generic HTML — split by h2 tags
    const parts = html.split(/<h2[^>]*>/i);
    if (parts.length > 1) {
      for (let i = 1; i < parts.length; i++) {
        const [title, ...rest] = parts[i].split(/<\/h2>/i);
        const restHtml = rest.join("");
        const bullets = extractBullets(restHtml);
        const imageUrl = extractImageUrl(restHtml);
        slides.push({
          id: generateId(),
          title: title.replace(/<[^>]+>/g, "").trim(),
          content: restHtml
            .replace(/<ul[^>]*>[\s\S]*?<\/ul>/gi, "")
            .replace(/<ol[^>]*>[\s\S]*?<\/ol>/gi, "")
            .replace(/<img[^>]*>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim(),
          bullets,
          imageUrl,
        });
      }
    } else {
      slides.push({
        id: generateId(),
        title: "Title Slide",
        content: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        bullets: [],
      });
    }
  }

  return slides;
}

function slidesToHtml(slides: Slide[]): string {
  return slides
    .map((s) => {
      const parts: string[] = [`  <h1>${s.title}</h1>`];
      
      // Add bullet points if present
      if (s.bullets.length > 0) {
        parts.push(`  <ul>\n${s.bullets.map(b => `    <li>${b}</li>`).join("\n")}\n  </ul>`);
      }
      
      // Add content if present
      if (s.content.trim()) {
        parts.push(`  <p>${s.content}</p>`);
      }
      
      // Add image if present
      if (s.imageUrl) {
        parts.push(`  <img src="${s.imageUrl}" alt="Slide image" style="max-width:100%;height:auto;">`);
      }
      
      return `<section>\n${parts.join("\n")}\n</section>`;
    })
    .join("\n");
}

export function SlideEditor({
  projectId,
  documentId,
  initialTitle = "Untitled Presentation",
  initialContent = "",
  onSave,
  defaultPrompt,
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
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState("");

  const activeSlide = slides[activeSlideIndex] || slides[0];

  const updateSlide = (index: number, field: keyof Slide, value: string) => {
    setSlides((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const addSlide = () => {
    const newSlide: Slide = {
      id: generateId(),
      title: "New Slide",
      content: "",
      bullets: [],
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

  const openGenerateDialog = useCallback(() => {
    // Use chat context as default prompt, or fall back to generic suggestion
    if (defaultPrompt) {
      setGeneratePrompt(`Using the sources, create a presentation: ${defaultPrompt}`);
    } else {
      setGeneratePrompt("Using the source information, create a presentation about ");
    }
    setShowGenerateDialog(true);
  }, [defaultPrompt]);

  const handleGenerate = useCallback(async () => {
    setShowGenerateDialog(false);
    setGenerating(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          type: "slides",
          title,
          prompt: generatePrompt,
        }),
      });

      if (!response.ok) throw new Error("Generation failed");

      const data = await response.json();
      if (data.html) {
        console.log("[SlideEditor] Received HTML:", data.html.substring(0, 500));
        console.log("[SlideEditor] HTML contains <img>:", data.html.includes("<img"));
        const parsed = parseHtmlToSlides(data.html);
        console.log("[SlideEditor] Parsed slides:", parsed.map(s => ({ title: s.title, hasImage: !!s.imageUrl, imageUrl: s.imageUrl })));
        setSlides(parsed);
        setActiveSlideIndex(0);
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
  }, [projectId, title, generatePrompt]);

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
            onClick={openGenerateDialog}
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
              <div className="aspect-video rounded-lg border bg-white dark:bg-zinc-900 shadow-sm p-6 flex flex-col overflow-hidden">
                <Input
                  value={activeSlide.title}
                  onChange={(e) =>
                    updateSlide(activeSlideIndex, "title", e.target.value)
                  }
                  className="text-2xl font-bold border-none bg-transparent shadow-none focus-visible:ring-0 p-0 h-auto shrink-0"
                  placeholder="Slide title..."
                />
                
                <div className="flex-1 mt-4 flex gap-4 min-h-0">
                  {/* Content side */}
                  <div className="flex-1 flex flex-col min-w-0">
                    {/* Bullet points (read-only display from AI) */}
                    {activeSlide.bullets.length > 0 && (
                      <ul className="space-y-1 mb-3 text-sm">
                        {activeSlide.bullets.map((bullet, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-primary mt-1">•</span>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    
                    {/* Editable content */}
                    <Textarea
                      value={activeSlide.content}
                      onChange={(e) =>
                        updateSlide(activeSlideIndex, "content", e.target.value)
                      }
                      className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 resize-none p-0 text-sm"
                      placeholder={activeSlide.bullets.length > 0 ? "Additional notes..." : "Slide content... Use each line for a bullet point."}
                    />
                  </div>
                  
                  {/* Image side */}
                  {activeSlide.imageUrl && (
                    <div className="w-1/3 shrink-0 flex items-center">
                      <img
                        src={activeSlide.imageUrl}
                        alt="Slide image"
                        className="w-full h-auto max-h-full object-contain rounded"
                        onError={(e) => {
                          // Hide broken images
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground text-center">
                Slide {activeSlideIndex + 1} of {slides.length}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Generate Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Presentation</DialogTitle>
            <DialogDescription>
              Describe what you want to create. Your sources and their images will be used.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={generatePrompt}
            onChange={(e) => setGeneratePrompt(e.target.value)}
            placeholder="e.g., Create a 7-day Prague itinerary with daily activities and photos"
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
