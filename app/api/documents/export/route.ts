import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { html, title, format } = await request.json();

  if (!html || !format) {
    return NextResponse.json(
      { error: "html and format are required" },
      { status: 400 }
    );
  }

  const docTitle = title || "Untitled Document";

  try {
    if (format === "pdf") {
      return await exportPdf(html, docTitle);
    } else if (format === "docx") {
      return await exportDocx(html, docTitle);
    } else if (format === "pptx") {
      return await exportPptx(html, docTitle);
    } else {
      return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
    }
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    );
  }
}

async function exportPdf(html: string, title: string): Promise<Response> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  // Simple HTML to PDF — parse text from HTML
  const lines = htmlToTextLines(html);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(title, margin, y);
  y += 12;

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  for (const line of lines) {
    if (y > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }

    if (line.type === "h1") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      y += 4;
    } else if (line.type === "h2") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      y += 3;
    } else if (line.type === "h3") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      y += 2;
    } else if (line.type === "li") {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
    }

    const prefix = line.type === "li" ? "  \u2022 " : "";
    const textLines = doc.splitTextToSize(prefix + line.text, maxWidth);

    for (const tl of textLines) {
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(tl, margin, y);
      y += line.type.startsWith("h") ? 7 : 5;
    }

    if (line.type.startsWith("h")) {
      y += 2;
    }
  }

  const buffer = doc.output("arraybuffer");

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${title}.pdf"`,
    },
  });
}

async function exportDocx(html: string, title: string): Promise<Response> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
  } = await import("docx");

  const lines = htmlToTextLines(html);
  const children: InstanceType<typeof Paragraph>[] = [];

  // Title
  children.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  for (const line of lines) {
    if (line.type === "h1") {
      children.push(
        new Paragraph({
          text: line.text,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 300, after: 200 },
        })
      );
    } else if (line.type === "h2") {
      children.push(
        new Paragraph({
          text: line.text,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
        })
      );
    } else if (line.type === "h3") {
      children.push(
        new Paragraph({
          text: line.text,
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        })
      );
    } else if (line.type === "li") {
      children.push(
        new Paragraph({
          children: [new TextRun(line.text)],
          bullet: { level: 0 },
          spacing: { after: 60 },
        })
      );
    } else if (line.type === "hr") {
      children.push(
        new Paragraph({
          text: "",
          border: {
            bottom: { style: "single" as const, size: 6, color: "999999" },
          },
          spacing: { before: 200, after: 200 },
        })
      );
    } else if (line.text.trim()) {
      children.push(
        new Paragraph({
          children: [new TextRun(line.text)],
          spacing: { after: 120 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${title}.docx"`,
    },
  });
}

async function exportPptx(html: string, title: string): Promise<Response> {
  const PptxGenJS = (await import("pptxgenjs")).default;

  const pptx = new PptxGenJS();
  pptx.title = title;

  // Parse sections from HTML
  const sections = parseSlides(html);

  if (sections.length === 0) {
    // Create a single slide with all content
    const slide = pptx.addSlide();
    slide.addText(title, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 1,
      fontSize: 28,
      bold: true,
      color: "363636",
    });

    const lines = htmlToTextLines(html);
    const text = lines.map((l) => l.text).join("\n");
    slide.addText(text, {
      x: 0.5,
      y: 1.8,
      w: 9,
      h: 4.5,
      fontSize: 14,
      color: "666666",
      valign: "top",
    });
  } else {
    for (const section of sections) {
      const slide = pptx.addSlide();

      // Slide title
      slide.addText(section.title, {
        x: 0.5,
        y: 0.3,
        w: 9,
        h: 0.8,
        fontSize: 24,
        bold: true,
        color: "363636",
      });

      // Slide content
      if (section.bullets.length > 0) {
        const bulletText = section.bullets.map((b) => ({
          text: b,
          options: { fontSize: 16, color: "555555", bullet: true as const },
        }));
        slide.addText(bulletText, {
          x: 0.5,
          y: 1.5,
          w: 9,
          h: 4.5,
          valign: "top",
        });
      } else if (section.content) {
        slide.addText(section.content, {
          x: 0.5,
          y: 1.5,
          w: 9,
          h: 4.5,
          fontSize: 16,
          color: "555555",
          valign: "top",
        });
      }
    }
  }

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${title}.pptx"`,
    },
  });
}

// --- Helper functions ---

interface TextLine {
  type: "h1" | "h2" | "h3" | "p" | "li" | "hr" | "blockquote";
  text: string;
}

function htmlToTextLines(html: string): TextLine[] {
  const lines: TextLine[] = [];

  // Simple regex-based HTML parser for server-side
  const tagPattern = /<(h[1-3]|p|li|hr|blockquote)[^>]*>([\s\S]*?)<\/\1>|<hr\s*\/?>/gi;
  let match;

  while ((match = tagPattern.exec(html)) !== null) {
    const fullMatch = match[0];
    if (fullMatch.match(/^<hr/i)) {
      lines.push({ type: "hr", text: "" });
      continue;
    }

    const tag = match[1].toLowerCase() as TextLine["type"];
    const content = match[2]
      .replace(/<[^>]+>/g, "") // Strip inner HTML tags
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    if (content) {
      lines.push({ type: tag, text: content });
    }
  }

  // If no structured elements found, split by paragraphs
  if (lines.length === 0) {
    const stripped = html
      .replace(/<[^>]+>/g, "\n")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l);

    for (const text of stripped) {
      lines.push({ type: "p", text });
    }
  }

  return lines;
}

interface SlideSection {
  title: string;
  content: string;
  bullets: string[];
}

function parseSlides(html: string): SlideSection[] {
  const sections: SlideSection[] = [];
  const sectionPattern = /<section[^>]*>([\s\S]*?)<\/section>/gi;
  let match;

  while ((match = sectionPattern.exec(html)) !== null) {
    const inner = match[1];

    // Extract title from h1 or h2
    const titleMatch = inner.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i);
    const title = titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
      : "Slide";

    // Extract bullets
    const bullets: string[] = [];
    const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;
    while ((liMatch = liPattern.exec(inner)) !== null) {
      const text = liMatch[1].replace(/<[^>]+>/g, "").trim();
      if (text) bullets.push(text);
    }

    // Extract paragraph content
    const pPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    const paragraphs: string[] = [];
    let pMatch;
    while ((pMatch = pPattern.exec(inner)) !== null) {
      const text = pMatch[1].replace(/<[^>]+>/g, "").trim();
      if (text) paragraphs.push(text);
    }

    sections.push({
      title,
      content: paragraphs.join("\n"),
      bullets,
    });
  }

  return sections;
}
