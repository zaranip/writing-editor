import * as cheerio from "cheerio";

export async function extractUrlText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; WritingEditor/1.0; +https://writingeditor.app)",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Remove script, style, nav, footer, header elements
  $("script, style, nav, footer, header, aside, .nav, .footer, .header, .sidebar").remove();

  // Try to get main content first
  let text = "";
  const mainSelectors = ["article", "main", '[role="main"]', ".content", ".post-content", ".entry-content"];

  for (const selector of mainSelectors) {
    const el = $(selector);
    if (el.length > 0) {
      text = el.text();
      break;
    }
  }

  // Fallback to body
  if (!text) {
    text = $("body").text();
  }

  // Clean up whitespace
  return text
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
}
