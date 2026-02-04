import { generateSignature } from "../utils/requestSigner";

const API_URL = import.meta.env.VITE_API_URL ?? "";

export interface FastSearchFieldValue {
  value: string | null;
  displayValue: string | null;
}

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

/**
 * Get a display title for a Fast Search result from common field names.
 */
export function getResultTitle(result: FastSearchResult): string {
  const prefer = ["Title", "Name", "Label", "Subject", "Description"];
  for (const key of prefer) {
    const f = result.fields?.[key];
    const v = f?.displayValue ?? f?.value;
    if (v != null && String(v).trim()) return String(v).trim();
  }
  // Fallback: first non-empty field value
  if (result.fields) {
    for (const [, f] of Object.entries(result.fields)) {
      const v = f?.displayValue ?? f?.value;
      if (v != null && String(v).trim()) return String(v).trim();
    }
  }
  return result.apiName || result.id || "Result";
}

/**
 * Get content ID for DMO harmonized results so we can link to /article/:contentId.
 */
export function getResultContentId(result: FastSearchResult): string | null {
  if (result.apiName === "SFDCHelp7_DMO_harmonized__dlm") {
    const f = result.fields?.Content_ID__c;
    const v = f?.value ?? f?.displayValue;
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
}
