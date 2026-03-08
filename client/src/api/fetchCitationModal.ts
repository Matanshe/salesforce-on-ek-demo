import { generateSignature } from "@/utils/requestSigner";
import type { ChunkRow } from "@/types/message";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface CitationModalResult {
  hudmoData: { attributes?: { content?: string; title?: string; metadata?: { sourceUrl?: string }; qa?: Array<{ question?: string; answer?: string }>; summary?: string } };
  chunkRows: ChunkRow[];
  articleTitle: string | null;
}

/**
 * Fetches HUDMO data and optional chunk rows for the citation modal.
 * Used by App and Proofpoint product pages so "Articles relevant for this page" and citation clicks open the same modal.
 */
export async function fetchCitationModal(
  dccid: string,
  objectApiName: string,
  chunkParams?: { chunkObjectApiName: string; chunkRecordIds: string },
  customerId?: string | null
): Promise<CitationModalResult | null> {
  try {
    const { timestamp, signature } = await generateSignature("POST", "/api/v1/get-hudmo");
    const body: { hudmoName: string; dccid: string; customerId?: string } = {
      hudmoName: objectApiName,
      dccid,
    };
    if (customerId) body.customerId = customerId;
    const response = await fetch(`${API_URL}/api/v1/get-hudmo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Timestamp": timestamp,
        "X-Signature": signature,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    const result = await response.json();
    const data = result?.data;
    if (!data || (data.attributes?.content == null && data.attributes?.title == null)) return null;

    let rows: ChunkRow[] = [];
    if (chunkParams?.chunkObjectApiName && chunkParams?.chunkRecordIds) {
      const { timestamp: ts2, signature: sig2 } = await generateSignature("POST", "/api/v1/get-chunks");
      const chunksRes = await fetch(`${API_URL}/api/v1/get-chunks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Timestamp": ts2, "X-Signature": sig2 },
        body: JSON.stringify({
          chunkObjectApiName: chunkParams.chunkObjectApiName,
          chunkRecordIds: chunkParams.chunkRecordIds,
        }),
      });
      if (chunksRes.ok) {
        const chunksResult = await chunksRes.json();
        const rawRows = chunksResult?.chunkRows ?? chunksResult?.data?.chunkRows;
        rows = Array.isArray(rawRows)
          ? rawRows.map((r: ChunkRow & Record<string, unknown>) => {
              const cit = r.Citation__c ?? r.citation__c;
              return {
                Chunk__c: typeof r.Chunk__c === "string" ? r.Chunk__c : typeof r.chunk__c === "string" ? r.chunk__c : "",
                Citation__c: cit == null || typeof cit === "string" ? cit : null,
              };
            })
          : [];
      }
    }

    const articleTitle = data?.attributes?.title ?? null;
    return { hudmoData: data, chunkRows: rows, articleTitle };
  } catch (e) {
    console.warn("[citation modal] fetch error:", e);
    return null;
  }
}
