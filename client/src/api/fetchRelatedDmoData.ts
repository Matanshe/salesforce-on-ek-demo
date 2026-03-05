// src/api/fetchRelatedDmoData.ts
import { generateSignature } from "@/utils/requestSigner";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface RelatedDmoData {
  product_name__c?: string;
  major_version__c?: string;
  minor_version__c?: string;
  patch_version__c?: string;
}

// Record shape can be Salesforce (title__c, product_name__c, ...) or Proofpoint (Title__c, Content_ID__c, ...)
type DmoRecord = Record<string, unknown> & {
  title__c?: string;
  Title__c?: string;
  Content_ID__c?: string;
  content_id__c?: string;
  product_name__c?: string;
  Product_Name__c?: string;
  Product__c?: string;
  product__c?: string;
  major_version__c?: string;
  Major_Version__c?: string;
  minor_version__c?: string;
  Minor_Version__c?: string;
  patch_version__c?: string;
  Patch_Version__c?: string;
};

const dmoDataCacheMap = new Map<string, DmoRecord[]>();

export async function fetchRelatedDmoData(
  title: string,
  customerId?: string | null,
  contentId?: string | null
): Promise<RelatedDmoData | null> {
  if (!title && !contentId) return null;

  try {
    const cacheKey = customerId || "default";
    let dmoDataCache = dmoDataCacheMap.get(cacheKey);

    if (!dmoDataCache) {
      const customerParam = customerId ? `?customerId=${encodeURIComponent(customerId)}` : "";
      const { timestamp, signature } = await generateSignature(
        "GET",
        `/api/v1/query-dmo-relationship${customerParam}`
      );

      const response = await fetch(`${API_URL}/api/v1/query-dmo-relationship${customerParam}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Timestamp": timestamp,
          "X-Signature": signature,
        },
      });

      if (!response.ok) {
        console.warn(`Failed to fetch related DMO data: ${response.statusText}`);
        return null;
      }

      const result = await response.json();
      const records = (result.records ?? result.data?.records ?? []) as DmoRecord[];
      dmoDataCache = records;
      dmoDataCacheMap.set(cacheKey, records);
    }

    if (!dmoDataCache || dmoDataCache.length === 0) return null;

    const cache = dmoDataCache;
    const isProofpoint = customerId === "proofpoint";
    const contentIdNorm = contentId?.trim().toLowerCase();

    const matchingRecord = cache.find((record) => {
      if (isProofpoint && contentIdNorm) {
        const rid = (record.Content_ID__c ?? record.content_id__c ?? "").toString().trim().toLowerCase();
        if (rid && rid === contentIdNorm) return true;
      }
      const recordTitle = (record.title__c ?? record.Title__c ?? "").toString();
      return recordTitle.toLowerCase() === (title ?? "").toLowerCase();
    });

    if (matchingRecord) {
      const result: RelatedDmoData = {
        product_name__c:
          (matchingRecord.product_name__c ??
            matchingRecord.Product_Name__c ??
            matchingRecord.Product__c ??
            matchingRecord.product__c) as string | undefined,
        major_version__c:
          matchingRecord.major_version__c !== undefined
            ? matchingRecord.major_version__c
            : matchingRecord.Major_Version__c,
        minor_version__c:
          matchingRecord.minor_version__c !== undefined
            ? matchingRecord.minor_version__c
            : matchingRecord.Minor_Version__c,
        patch_version__c:
          matchingRecord.patch_version__c !== undefined
            ? matchingRecord.patch_version__c
            : matchingRecord.Patch_Version__c,
      };
      console.log("Matched DMO record:", matchingRecord);
      console.log("Extracted related data:", result);
      return result;
    }

    return null;
  } catch (error) {
    console.error("Error fetching related DMO data:", error);
    return null;
  }
}
