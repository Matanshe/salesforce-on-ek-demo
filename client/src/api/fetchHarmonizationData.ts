// src/api/fetchHarmonizationData.ts
import { generateSignature } from "@/utils/requestSigner";


const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export async function fetchHarmonizationData(
  hudmo: string,
  dccid: string
) {
  const { timestamp, signature } = await generateSignature(
    "POST",
    "/api/v1/get-hudmo"
  );

  const response = await fetch(`${API_URL}/api/v1/get-hudmo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Timestamp": timestamp,
      "X-Signature": signature,
    },
    body: JSON.stringify({
      hudmoName: hudmo,
      dccid,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch harmonization data: ${response.statusText}`
    );
  }

  const result = await response.json();
  return result.data;
}
