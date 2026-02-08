// src/api/fetchRelatedDmoData.ts
import { generateSignature } from "@/utils/requestSigner";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface RelatedDmoData {
  product_name__c?: string;
  major_version__c?: string;
  minor_version__c?: string;
  patch_version__c?: string;
}

// Cache for all DMO records per customer to avoid repeated queries
const dmoDataCacheMap = new Map<string, Array<{
  title__c?: string;
  Title__c?: string;
  product_name__c?: string;
  Product_Name__c?: string;
  major_version__c?: string;
  Major_Version__c?: string;
  minor_version__c?: string;
  Minor_Version__c?: string;
  patch_version__c?: string;
  Patch_Version__c?: string;
}>>();

export async function fetchRelatedDmoData(title: string, customerId?: string | null): Promise<RelatedDmoData | null> {
  if (!title) return null;

  try {
    // Use customer-specific cache key
    const cacheKey = customerId || "default";
    let dmoDataCache = dmoDataCacheMap.get(cacheKey);

    // Fetch all records if not cached for this customer
    if (!dmoDataCache) {
      const customerParam = customerId ? `?customerId=${encodeURIComponent(customerId)}` : '';
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
      const records = result.records || [];
      dmoDataCache = records;
      dmoDataCacheMap.set(cacheKey, records);
    }

    // Match by title__c (case-insensitive)
    if (!dmoDataCache || dmoDataCache.length === 0) {
      return null;
    }

    // TypeScript guard: dmoDataCache is now guaranteed to be defined
    const cache = dmoDataCache;
    const matchingRecord = cache.find((record) => {
      const recordTitle = record.title__c || record.Title__c || "";
      return recordTitle.toLowerCase() === title.toLowerCase();
    });

    if (matchingRecord) {
      const result = {
        product_name__c: matchingRecord.product_name__c || matchingRecord.Product_Name__c,
        major_version__c: matchingRecord.major_version__c !== undefined ? matchingRecord.major_version__c : matchingRecord.Major_Version__c,
        minor_version__c: matchingRecord.minor_version__c !== undefined ? matchingRecord.minor_version__c : matchingRecord.Minor_Version__c,
        patch_version__c: matchingRecord.patch_version__c !== undefined ? matchingRecord.patch_version__c : matchingRecord.Patch_Version__c,
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
