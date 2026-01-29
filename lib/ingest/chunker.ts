/**
 * Split text into chunks of approximately `chunkSize` characters
 * with `overlap` character overlap between chunks.
 */
export function chunkText(
  text: string,
  chunkSize: number = 1500,
  overlap: number = 200
): string[] {
  if (!text || text.length === 0) return [];
  if (text.length <= chunkSize) return [text.trim()];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    // Try to break at a sentence boundary
    if (end < text.length) {
      const slice = text.slice(start, end + 200); // look ahead a bit
      const sentenceEnd = findLastSentenceBreak(slice, chunkSize);
      if (sentenceEnd > chunkSize * 0.5) {
        end = start + sentenceEnd;
      }
    } else {
      end = text.length;
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

function findLastSentenceBreak(text: string, maxPos: number): number {
  // Look for sentence endings (., !, ?) followed by whitespace
  const breakPoints = [". ", ".\n", "! ", "!\n", "? ", "?\n"];
  let lastBreak = -1;

  for (const bp of breakPoints) {
    let pos = 0;
    while (pos < maxPos) {
      const idx = text.indexOf(bp, pos);
      if (idx === -1 || idx >= maxPos) break;
      lastBreak = Math.max(lastBreak, idx + bp.length);
      pos = idx + 1;
    }
  }

  // Also check paragraph breaks
  const paragraphBreak = text.lastIndexOf("\n\n", maxPos);
  if (paragraphBreak > 0) {
    lastBreak = Math.max(lastBreak, paragraphBreak + 2);
  }

  return lastBreak;
}
