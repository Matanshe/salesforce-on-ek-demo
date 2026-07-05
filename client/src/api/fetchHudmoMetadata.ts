// src/api/fetchHudmoMetadata.ts
import { generateSignature } from "@/utils/requestSigner";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

/**
 * Metadata pulled by direct-querying the harmonized HUDMO DMO table (not the EK rendering API).
 * Surfaces fields the rendering API omits: real last-modified date, language, harmonization
 * status, source/connector provenance, copyright, and the original source document.
 */
export interface HudmoMetadata {
  title?: string | null;
  language?: string | null;
  lastModified?: string | null;
  isHarmonized?: boolean;
  connectorType?: string | null;
  dataSource?: string | null;
  contentType?: string | null;
  size?: number | null;
  copyright?: string | null;
  description?: string | null;
  generator?: string | null;
  sourceDocument?: string | null;
  sourceFile?: string | null;
}

const cache = new Map<string, HudmoMetadata | null>();

/** Fetch curated HUDMO-table metadata for one article (by dccid). Returns null on any failure. */
export async function fetchHudmoMetadata(
  dccid: string,
  customerId: string
): Promise<HudmoMetadata | null> {
  if (!dccid || !customerId) return null;

  const cacheKey = `${customerId}:${dccid}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;

  try {
    const qs = `?dccid=${encodeURIComponent(dccid)}&customerId=${encodeURIComponent(customerId)}`;
    const path = `/api/v1/get-hudmo-metadata${qs}`;
    const { timestamp, signature } = await generateSignature("GET", path);

    const response = await fetch(`${API_URL}${path}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Timestamp": timestamp,
        "X-Signature": signature,
      },
    });

    if (!response.ok) {
      console.warn(`fetchHudmoMetadata: ${response.status} ${response.statusText}`);
      cache.set(cacheKey, null);
      return null;
    }

    const result = await response.json();
    const data = (result?.data ?? null) as HudmoMetadata | null;
    cache.set(cacheKey, data);
    return data;
  } catch (error) {
    console.error("fetchHudmoMetadata error:", error);
    cache.set(cacheKey, null);
    return null;
  }
}
