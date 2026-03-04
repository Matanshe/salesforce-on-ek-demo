import { generateSignature } from "../utils/requestSigner";

const API_URL = import.meta.env.VITE_API_URL ?? "";

/** API can return { value, displayValue } or raw string */
export type FastSearchFieldValue =
  | { value?: string | null; displayValue?: string | null; Value?: string | null; DisplayValue?: string | null }
  | string;

export interface FastSearchResult {
  id: string;
  apiName: string;
  fields: Record<string, FastSearchFieldValue>;
  chunks?: unknown[];
}

export interface FastSearchResponse {
  results: FastSearchResult[];
  metadata?: {
    sources?: Record<string, unknown>;
    sobjects?: Record<string, unknown>;
  };
  queryInfo?: Record<string, unknown>;
}

export interface FastSearchParams {
  q: string;
  rankingMode?: string;
  configurationName?: string;
}

/**
 * Call the backend Fast Search API (proxies Salesforce Enterprise Search).
 * Path must include query string for signature validation.
 */
export async function fetchFastSearch(params: FastSearchParams): Promise<FastSearchResponse> {
  const { q, rankingMode = "Interleaved", configurationName } = params;
  const searchParams = new URLSearchParams({ q: q.trim(), rankingMode });
  if (configurationName?.trim()) {
    searchParams.set("configurationName", configurationName.trim());
  }
  const path = `/api/v1/fast-search?${searchParams.toString()}`;
  const { timestamp, signature } = await generateSignature("GET", path);

  const response = await fetch(`${API_URL}${path}`, {
    method: "GET",
    headers: {
      "X-Timestamp": timestamp,
      "X-Signature": signature,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(err.message || `Fast Search failed: ${response.statusText}`);
  }

  return response.json();
}

const HELP_SEARCH_CONFIG = "SFDCHelp7 DMO harmonized";

function fieldValue(f: FastSearchFieldValue | undefined): string | null {
  if (f == null) return null;
  if (typeof f === "string") return f.trim() || null;
  if (typeof f !== "object") return null;
  const v = (f as Record<string, unknown>).displayValue ?? (f as Record<string, unknown>).DisplayValue ?? (f as Record<string, unknown>).value ?? (f as Record<string, unknown>).Value ?? null;
  if (v == null) return null;
  const s = typeof v === "string" ? v : String(v);
  return s.trim() || null;
}

/**
 * Get display title from the API response. Uses result.fields.title (or any field with "title" in the key).
 */
export function getResultTitle(result: FastSearchResult): string {
  const fields = result.fields;
  if (!fields || typeof fields !== "object") return result.apiName || result.id || "Result";

  // 1) Explicit result.fields.title (lowercase)
  const v1 = fieldValue(fields.title);
  if (v1) return v1;
  // 2) result.fields.Title
  const v2 = fieldValue(fields.Title);
  if (v2) return v2;
  // 3) Any field whose key contains "title" (e.g. Title__c)
  for (const [key, f] of Object.entries(fields)) {
    if (key.toLowerCase().includes("title")) {
      const v = fieldValue(f);
      if (v) return v;
    }
  }
  // 4) Other common display fields
  for (const key of ["Name", "Label", "Subject", "Description"]) {
    const v = fieldValue(fields[key]);
    if (v) return v;
  }
  // 5) First non-empty field (skip Id-like keys so we don't show id as title)
  for (const [key, f] of Object.entries(fields)) {
    if (key === "Id" || key === "id" || key === "Content_ID__c") continue;
    const v = fieldValue(f);
    if (v) return v;
  }
  return result.apiName || result.id || "Result";
}

export function getHelpSearchConfig(): string {
  return HELP_SEARCH_CONFIG;
}

/**
 * Get content ID for DMO harmonized results so we can link to /article/:contentId.
 */
export function getResultContentId(result: FastSearchResult): string | null {
  if (result.apiName === "SFDCHelp7_DMO_harmonized__dlm") {
    const v = fieldValue(result.fields?.Content_ID__c);
    if (v) return v;
  }
  return null;
}

/**
 * Get language from a fast-search result (e.g. Language__c, DC.Language) for filtering "same language" versions.
 */
export function getResultLanguage(result: FastSearchResult): string | null {
  const fields = result.fields;
  if (!fields || typeof fields !== "object") return null;
  for (const [key, f] of Object.entries(fields)) {
    if (key.toLowerCase().includes("language")) {
      const v = fieldValue(f);
      if (v) return v;
    }
  }
  return null;
}

export interface ArticleVersion {
  contentId: string;
  title: string;
  /** HUDMO / object API name (e.g. result.apiName) used to fetch this version via get-hudmo */
  hudmo: string;
  /** Display name for the version (e.g. from cdp_sys_SourceVersion__c or DataSourceObject__c); falls back to title or contentId */
  versionName?: string;
}

/**
 * Fetch other article versions: same title, same language (when language is available in results).
 * Uses fast-search with exact phrase query; filters by contentId (excludes current) and optional language.
 */
export async function fetchArticleVersions(
  title: string,
  language: string | null,
  currentContentId: string | null,
  configurationName?: string
): Promise<ArticleVersion[]> {
  if (!title || typeof title !== "string" || !title.trim()) return [];
  const config = configurationName?.trim() || getHelpSearchConfig();
  const titleTrimmed = title.trim().replace(/\s+/g, " ");
  const phrase = titleTrimmed.includes(" ") ? `"${titleTrimmed.replace(/"/g, '\\"')}"` : `"${titleTrimmed.replace(/"/g, '\\"')}"`;
  const res = await fetchFastSearch({ q: phrase, configurationName: config });
  const results = res.results ?? [];
  console.log("[fetchArticleVersions] query:", phrase, "| raw results count:", results.length);
  console.log(
    "[fetchArticleVersions] raw articles:",
    results.map((r) => ({
      title: getResultTitle(r),
      contentId: getResultContentId(r),
      hudmo: r.apiName,
      language: getResultLanguage(r),
    }))
  );
  const seen = new Set<string>();
  const versions: ArticleVersion[] = [];
  const titleNormLower = titleTrimmed.toLowerCase();
  const langNorm = language?.toLowerCase().trim() ?? null;
  for (const result of results) {
    const resultTitle = getResultTitle(result).trim().replace(/\s+/g, " ");
    if (resultTitle.toLowerCase() !== titleNormLower) continue;
    const contentId = getResultContentId(result);
    if (!contentId || contentId === currentContentId) continue;
    if (seen.has(contentId)) continue;
    const resultLang = getResultLanguage(result);
    if (langNorm != null && resultLang != null) {
      if (resultLang.toLowerCase().trim() !== langNorm) continue;
    }
    seen.add(contentId);
    const hudmo = result.apiName && typeof result.apiName === "string" ? result.apiName : "";
    versions.push({ contentId, title: getResultTitle(result), hudmo, versionName: getResultTitle(result) });
  }
  console.log("[fetchArticleVersions] filtered versions (same title + language):", versions);
  return versions;
}

/**
 * Fetch other article versions via SOQL (customer's harmonized object).
 * Uses GET /api/v1/article-versions with title and optional language filter.
 * Prefer this when customerId is set so the correct object (e.g. hexagon_zoomin_2_harmonized__dll) is queried.
 */
export async function fetchArticleVersionsBySoql(
  customerId: string,
  title: string,
  language: string | null,
  currentContentId: string | null
): Promise<ArticleVersion[]> {
  if (!title || typeof title !== "string" || !title.trim()) return [];
  const params = new URLSearchParams({
    customerId,
    title: title.trim(),
  });
  if (currentContentId) params.set("currentContentId", currentContentId);
  if (language != null && String(language).trim() !== "") params.set("language", String(language).trim());
  const path = `/api/v1/article-versions?${params.toString()}`;
  const { timestamp, signature } = await generateSignature("GET", path);

  const response = await fetch(`${API_URL}${path}`, {
    method: "GET",
    headers: {
      "X-Timestamp": timestamp,
      "X-Signature": signature,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(err.message || `Article versions failed: ${response.statusText}`);
  }

  const data = (await response.json()) as { versions?: ArticleVersion[] };
  const versions = data.versions ?? [];
  console.log("[fetchArticleVersionsBySoql] versions:", versions);
  return versions;
}
