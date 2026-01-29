import * as cheerio from "cheerio";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Search the web using DuckDuckGo HTML scraping (no API key required).
 * Returns a list of search results with title, url, and snippet.
 */
export async function searchWeb(query: string, maxResults = 8): Promise<SearchResult[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodedQuery}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $(".result").each((_, el) => {
      if (results.length >= maxResults) return;

      const titleEl = $(el).find(".result__title a");
      const snippetEl = $(el).find(".result__snippet");
      const urlEl = $(el).find(".result__url");

      const title = titleEl.text().trim();
      let url = titleEl.attr("href") || urlEl.text().trim();
      const snippet = snippetEl.text().trim();

      if (!title || !url) return;

      // DuckDuckGo wraps URLs in a redirect — extract the real URL
      if (url.includes("uddg=")) {
        try {
          const parsed = new URL(url, "https://duckduckgo.com");
          url = decodeURIComponent(parsed.searchParams.get("uddg") || url);
        } catch {
          // Use as-is
        }
      }

      // Ensure URL has protocol
      if (!url.startsWith("http")) {
        url = `https://${url}`;
      }

      results.push({ title, url, snippet });
    });

    return results;
  } catch (error) {
    console.error("Web search error:", error);
    return [];
  }
}

/**
 * Scrape and extract the main text content from a URL.
 * Used to get full content from search results.
 */
export async function scrapeUrl(url: string): Promise<{ title: string; content: string }> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; WritingEditor/1.0; +https://writingeditor.app)",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const title = $("title").text().trim() || $("h1").first().text().trim() || url;

  // Remove non-content elements
  $("script, style, nav, footer, header, aside, .nav, .footer, .header, .sidebar, .ad, .ads, .advertisement").remove();

  // Try main content selectors
  let text = "";
  const mainSelectors = ["article", "main", '[role="main"]', ".content", ".post-content", ".entry-content"];
  for (const selector of mainSelectors) {
    const el = $(selector);
    if (el.length > 0) {
      text = el.text();
      break;
    }
  }

  if (!text) {
    text = $("body").text();
  }

  // Clean whitespace
  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();

  // Limit to ~8000 chars to avoid overwhelming the context
  return {
    title,
    content: cleaned.slice(0, 8000),
  };
}
