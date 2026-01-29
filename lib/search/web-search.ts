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
  const result = await scrapeUrlWithImages(url);
  return { title: result.title, content: result.content };
}

/**
 * Scrape URL and extract text content plus featured images.
 * Returns title, cleaned text content, and URLs of featured/hero images.
 */
export async function scrapeUrlWithImages(url: string): Promise<{
  title: string;
  content: string;
  description: string;
  featuredImages: string[];
}> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; WritingEditor/1.0; +https://writingeditor.app)",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const baseUrl = new URL(url);

  // Extract title
  const title = $("title").text().trim() || $("h1").first().text().trim() || url;

  // Extract description from meta tags
  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="twitter:description"]').attr("content") ||
    "";

  // Extract featured images (og:image, twitter:image, large content images)
  const featuredImages: string[] = [];
  const seenUrls = new Set<string>();

  // Helper to add image URL
  const addImage = (imgUrl: string | undefined) => {
    if (!imgUrl) return;
    try {
      // Resolve relative URLs
      const absoluteUrl = new URL(imgUrl, baseUrl).href;
      // Skip data URLs, tiny images, and duplicates
      if (
        !absoluteUrl.startsWith("data:") &&
        !seenUrls.has(absoluteUrl) &&
        !absoluteUrl.includes("1x1") &&
        !absoluteUrl.includes("pixel") &&
        !absoluteUrl.includes("tracking")
      ) {
        seenUrls.add(absoluteUrl);
        featuredImages.push(absoluteUrl);
      }
    } catch {
      // Invalid URL, skip
    }
  };

  // Priority 1: Open Graph and Twitter images
  addImage($('meta[property="og:image"]').attr("content"));
  addImage($('meta[property="og:image:secure_url"]').attr("content"));
  addImage($('meta[name="twitter:image"]').attr("content"));
  addImage($('meta[name="twitter:image:src"]').attr("content"));

  // Priority 2: Schema.org image
  addImage($('[itemprop="image"]').attr("src") || $('[itemprop="image"]').attr("content"));

  // Priority 3: First large images from main content (likely hero/featured)
  const mainContent = $("article, main, .content, .post-content, .entry-content").first();
  const imgContainer = mainContent.length > 0 ? mainContent : $("body");
  
  imgContainer.find("img").each((_, el) => {
    if (featuredImages.length >= 5) return false; // Limit to 5 images
    const src = $(el).attr("src") || $(el).attr("data-src");
    const width = parseInt($(el).attr("width") || "0", 10);
    const height = parseInt($(el).attr("height") || "0", 10);
    
    // Only include reasonably sized images
    if ((width >= 200 || height >= 200) || (!width && !height)) {
      addImage(src);
    }
  });

  // Remove non-content elements for text extraction
  $("script, style, nav, footer, header, aside, .nav, .footer, .header, .sidebar, .ad, .ads, .advertisement, .comments, .comment").remove();

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

  return {
    title,
    description: description.trim(),
    content: cleaned.slice(0, 15000), // Keep more content for the txt file
    featuredImages: featuredImages.slice(0, 5), // Max 5 featured images
  };
}
