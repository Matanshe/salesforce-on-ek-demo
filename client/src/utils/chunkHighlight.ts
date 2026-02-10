/**
 * Chunk highlighting: find chunk text in rendered HTML, wrap in spans.
 * Uses normalized (whitespace-collapsed) matching; returns first highlight element for scroll-into-view.
 */

const HIGHLIGHT_CLASS = "chunk-highlight";

/** Collapse runs of whitespace to a single space and trim. */
export function normalizeText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

interface Segment {
  node: Text;
  text: string;
}

function collectTextNodes(root: Node): Segment[] {
  const segments: Segment[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent ?? "";
    if (text.length > 0) {
      segments.push({ node, text });
    }
  }
  return segments;
}

/** Build normalized string and map: for each index in normalized, (segIdx, startInSeg, endInSeg). */
function buildNormalizedAndMap(
  segments: Segment[]
): { normalized: string; map: Array<{ segIdx: number; start: number; end: number }> } {
  const normChars: string[] = [];
  const mapOut: Array<{ segIdx: number; start: number; end: number }> = [];
  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const seg = segments[segIdx];
    const t = seg.text;
    let i = 0;
    while (i < t.length) {
      while (i < t.length && /\s/.test(t[i])) i++;
      const wordStart = i;
      while (i < t.length && !/\s/.test(t[i])) i++;
      const wordEnd = i;
      if (wordStart < wordEnd) {
        const word = t.slice(wordStart, wordEnd);
        const n = normalizeText(word);
        for (let k = 0; k < n.length; k++) {
          normChars.push(n[k]);
          mapOut.push({ segIdx, start: wordStart, end: wordEnd });
        }
      }
      if (i < t.length) {
        normChars.push(" ");
        mapOut.push({ segIdx, start: i, end: i + 1 });
        i++;
      }
    }
    if (segIdx < segments.length - 1) {
      normChars.push(" ");
      mapOut.push({ segIdx, start: 0, end: 0 });
    }
  }
  return { normalized: normChars.join(""), map: mapOut };
}

/**
 * Get first N and last N words from normalized text (anchors for fuzzy matching).
 */
function getFirstAndLastWords(normalized: string, n: number): { firstWords: string; lastWords: string } {
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { firstWords: "", lastWords: "" };
  const firstWords = words.slice(0, n).join(" ");
  const lastWords = words.length <= n ? firstWords : words.slice(-n).join(" ");
  return { firstWords, lastWords };
}

/**
 * Find one range: from start of firstWords to end of lastWords (everything in between).
 * Handles chunks split across elements with different line breaks/spaces.
 */
function findRangeByAnchors(normalized: string, firstWords: string, lastWords: string): [number, number] | null {
  if (!firstWords.length) return null;
  const start = normalized.indexOf(firstWords);
  if (start === -1) return null;
  // Last occurrence of lastWords that is at or after start (so it's after firstWords)
  let end = -1;
  let pos = start;
  for (;;) {
    const idx = normalized.indexOf(lastWords, pos);
    if (idx === -1) break;
    end = idx + lastWords.length;
    pos = idx + 1;
  }
  if (end < 0) return null;
  return [start, end];
}

/** Merge overlapping [start,end) ranges; sort by start. */
function mergeRanges(ranges: Array<[number, number]>): Array<[number, number]> {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number]> = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const [s, e] = sorted[i];
    const last = out[out.length - 1];
    if (s <= last[1]) {
      last[1] = Math.max(last[1], e);
    } else {
      out.push([s, e]);
    }
  }
  return out;
}

/**
 * Highlight chunk texts inside container. Wraps matching text in <span class="chunk-highlight">.
 * Returns the first highlight element for scroll-into-view, or null.
 */
const DEBUG_CHUNK_HIGHLIGHT = typeof window !== "undefined" && (window as unknown as { __DEBUG_CHUNK_HIGHLIGHT?: boolean }).__DEBUG_CHUNK_HIGHLIGHT;

export function highlightChunksInElement(container: HTMLElement, chunkTexts: string[]): HTMLElement | null {
  console.log("[chunkHighlight] called with container=" + !!container + " chunkTexts.length=" + chunkTexts.length);
  const segments = collectTextNodes(container);
  if (segments.length === 0) {
    if (DEBUG_CHUNK_HIGHLIGHT) console.log("[chunkHighlight] No text segments in container");
    return null;
  }

  const { normalized, map } = buildNormalizedAndMap(segments);
  if (DEBUG_CHUNK_HIGHLIGHT) {
    console.log("[chunkHighlight] segments:", segments.length, "normalized length:", normalized.length, "map length:", map.length);
  }
  const chunkRangesNorm: Array<[number, number]> = [];
  for (let i = 0; i < chunkTexts.length; i++) {
    const rawChunk = chunkTexts[i];
    const chunkNorm = normalizeText(rawChunk);
    if (chunkNorm.length === 0) continue;
    const { firstWords, lastWords } = getFirstAndLastWords(chunkNorm, 2);
    const range = findRangeByAnchors(normalized, firstWords, lastWords);
    if (range) chunkRangesNorm.push(range);
    if (DEBUG_CHUNK_HIGHLIGHT || !range) {
      console.log("[chunkHighlight] chunk", i, "anchors: first2=\"", firstWords, "\" last2=\"", lastWords, "\" found:", !!range);
    }
  }
  if (chunkRangesNorm.length === 0) {
    console.log("[chunkHighlight] No occurrences of chunk text(s) in document");
    return null;
  }

  const merged = mergeRanges(chunkRangesNorm);
  if (DEBUG_CHUNK_HIGHLIGHT) console.log("[chunkHighlight] merged ranges:", merged.length);

  // Map each normalized range [nStart, nEnd) to segment ranges: for each segIdx, (min start, max end) over map entries in range
  type SegRange = [number, number];
  const bySeg = new Map<number, SegRange[]>();
  for (const [nStart, nEnd] of merged) {
    const segRanges = new Map<number, { start: number; end: number }>();
    for (let ni = nStart; ni < nEnd; ni++) {
      const m = map[ni];
      if (!m) continue;
      const segIdx = m.segIdx;
      const existing = segRanges.get(segIdx);
      if (existing) {
        existing.start = Math.min(existing.start, m.start);
        existing.end = Math.max(existing.end, m.end);
      } else {
        segRanges.set(segIdx, { start: m.start, end: m.end });
      }
    }
    for (const [segIdx, { start, end }] of segRanges) {
      const arr = bySeg.get(segIdx) ?? [];
      arr.push([start, end]);
      bySeg.set(segIdx, arr);
    }
  }
  const bySegMerged = new Map<number, SegRange[]>();
  for (const [segIdx, arr] of bySeg) {
    bySegMerged.set(segIdx, mergeRanges(arr));
  }

  // Process segments from last to first so DOM changes don't invalidate node refs
  const segIndices = [...bySegMerged.keys()].sort((a, b) => b - a);
  let firstHighlight: HTMLElement | null = null;

  for (const segIdx of segIndices) {
    const segment = segments[segIdx];
    if (!segment) continue;
    const ranges = bySegMerged.get(segIdx)!;
    const text = segment.text;
    const node = segment.node;
    const parent = node.parentNode;
    if (!parent) continue;

    const doc = node.ownerDocument;
    const frag = doc.createDocumentFragment();
    let lastEnd = 0;
    for (const [start, end] of ranges) {
      const s = Math.max(0, Math.min(start, text.length));
      const e = Math.min(text.length, Math.max(end, s));
      if (s > lastEnd) {
        frag.appendChild(doc.createTextNode(text.slice(lastEnd, s)));
      }
      const span = doc.createElement("span");
      span.className = HIGHLIGHT_CLASS;
      span.appendChild(doc.createTextNode(text.slice(s, e)));
      frag.appendChild(span);
      if (!firstHighlight) firstHighlight = span;
      lastEnd = e;
    }
    if (lastEnd < text.length) {
      frag.appendChild(doc.createTextNode(text.slice(lastEnd)));
    }
    parent.replaceChild(frag, node);
  }

  if (firstHighlight) {
    console.log("[chunkHighlight] Applied highlights, first element in DOM");
  }
  return firstHighlight;
}
