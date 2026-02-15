import sfAuthToken from "../utils/authToken.js";
import { getCurrentTimestamp } from "../utils/loggingUtil.js";

/**
 * Proxies Salesforce Fast Search (Enterprise Search) API.
 * GET /api/v1/fast-search?q=...&rankingMode=...&configurationName=...
 * - q (required): search query
 * - rankingMode (optional): default Interleaved
 * - configurationName (optional): e.g. "SFDCHelp7 DMO harmonized" or omit for global search
 */
const fastSearch = async (req, res) => {
  try {
    const q = req.query.q;
    const rankingMode = req.query.rankingMode || "Interleaved";
    const configurationName = req.query.configurationName || undefined;

    if (!q || typeof q !== "string" || !q.trim()) {
      return res.status(400).json({
        errorCode: "MISSING_QUERY",
        message: "Query parameter 'q' is required",
      });
    }

    console.log(
      `${getCurrentTimestamp()} 🔍 - fastSearch - q="${q}", rankingMode=${rankingMode}, configurationName=${configurationName ?? "(global)"}`
    );

    const { accessToken, instanceUrl } = await sfAuthToken();

    const params = new URLSearchParams({
      q: q.trim(),
      rankingMode,
    });
    if (configurationName && configurationName.trim()) {
      params.set("configurationName", configurationName.trim());
    }
    const apiUrl = `${instanceUrl}/services/data/v64.0/connect/search/fast-search?${params.toString()}`;

    const config = {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    };

    const response = await fetch(apiUrl, config);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `${getCurrentTimestamp()} ❌ - fastSearch - API Error: ${response.status} ${response.statusText}`
      );
      console.error(`${getCurrentTimestamp()} ❌ - fastSearch - Response: ${errorText}`);
      return res.status(response.status).json({
        errorCode: "FAST_SEARCH_ERROR",
        message: response.statusText,
        details: errorText,
      });
    }

    const data = await response.json();

    // Ensure we always send a top-level results array (Salesforce uses "results"; some responses only have metadata)
    let results = Array.isArray(data.results) ? data.results : [];
    if (results.length === 0 && (data.metadata || data.queryInfo)) {
      console.log(
        `${getCurrentTimestamp()} 🔍 - fastSearch - response keys: ${Object.keys(data).join(", ")}; results length: 0`
      );
      // If API returned results under another key, use it (e.g. searchRecords or nested under queryInfo)
      if (Array.isArray(data.searchRecords)) results = data.searchRecords;
      else if (Array.isArray(data.records)) results = data.records;
    }
    console.log(
      `${getCurrentTimestamp()} ✅ - fastSearch - ${results.length} results`
    );
    res.status(200).json({ ...data, results });
  } catch (error) {
    console.error(`${getCurrentTimestamp()} ❌ - fastSearch - Error: ${error.message}`);
    res.status(500).json({
      message: error.message,
    });
  }
};

export default fastSearch;
