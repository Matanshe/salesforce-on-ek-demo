import sfAuthToken from "../utils/authToken.js";
import { getCurrentTimestamp } from "../utils/loggingUtil.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Get column names from Data Cloud metadata. API returns metadata as array of { name, nullable, type }.
 * @param {{ columns?: string[] } | Array<{ name?: string }> | undefined} metadata
 * @returns {string[]}
 */
function getColumnNames(metadata) {
  if (!metadata) return [];
  if (Array.isArray(metadata)) return metadata.map((m) => (m && m.name != null ? String(m.name) : ""));
  if (metadata.columns) return metadata.columns;
  return [];
}

/**
 * Extract chunk text from a single row. Handles object rows (various key casings) and array rows (with column index).
 * Data Cloud inline response: data = [[ recordId, chunkText ], ...], metadata = [{ name: "RecordId__c" }, { name: "Chunk__c" }].
 * @param {Record<string, unknown> | unknown[]} rec - One row from createSqlQuery response (data/rows)
 * @param {{ columns?: string[] } | Array<{ name?: string }> | undefined} metadata - Optional; column names or array of { name }
 * @returns {string}
 */
function getChunkTextFromRow(rec, metadata) {
  if (rec == null) return "";
  if (Array.isArray(rec)) {
    const columns = getColumnNames(metadata);
    const idx = columns.findIndex((c) => (c && String(c).toLowerCase()) === "chunk__c");
    if (idx >= 0 && rec[idx] != null) return String(rec[idx]);
    return "";
  }
  if (typeof rec !== "object") return "";
  const v = rec.Chunk__c ?? rec.chunk__c;
  if (v != null && typeof v === "string") return v;
  const key = Object.keys(rec).find((k) => k.toLowerCase() === "chunk__c");
  return key != null && typeof rec[key] === "string" ? rec[key] : "";
}

/**
 * Get chunk text for given chunk record IDs by querying the chunks table in Data 360.
 * Uses the Data 360 Connect REST API (Query SQL):
 *   https://developer.salesforce.com/docs/data/data-cloud-query-guide
 * - POST /services/data/v64.0/ssot/query-sql with body { sql } (Create SQL Query)
 * - GET /services/data/v64.0/ssot/query-sql/{queryId}/rows (Get SQL Query Results)
 * Uses same base URL (instance_url from OAuth) as get-hudmo and other APIs.
 * Chunk DMO uses RecordId__c for the record identifier (not Id). Returns Chunk__c, Citation__c.
 * Falls back to local file only if API is unavailable.
 */
const getChunks = async (req, res) => {
  console.log(
    `${getCurrentTimestamp()} 📥 - getChunks - INVOKED body keys: ${Object.keys(req.body || {}).join(", ")} chunkObjectApiName=${req.body?.chunkObjectApiName ?? "missing"} chunkRecordIds type=${typeof req.body?.chunkRecordIds}`
  );
  try {
    const chunkObjectApiName = req.body.chunkObjectApiName;
    const chunkRecordIdsRaw = req.body.chunkRecordIds;
    const chunkRecordIds =
      typeof chunkRecordIdsRaw === "string"
        ? chunkRecordIdsRaw.split(",").map((id) => id.trim()).filter(Boolean)
        : Array.isArray(chunkRecordIdsRaw)
          ? chunkRecordIdsRaw.filter((id) => id != null && String(id).trim())
          : [];

    if (!chunkObjectApiName || chunkRecordIds.length === 0) {
      return res.status(400).json({
        errorCode: "MISSING_PARAMETERS",
        message: "chunkObjectApiName and chunkRecordIds (comma-separated or array) are required",
      });
    }

    console.log(
      `${getCurrentTimestamp()} 🔑 - getChunks - chunkObjectApiName: ${chunkObjectApiName}, chunkRecordIds: ${chunkRecordIds.length} ids`
    );
    console.log(
      `${getCurrentTimestamp()} 📋 - getChunks - chunkRecordIds list: ${chunkRecordIds.slice(0, 5).join(", ")}${chunkRecordIds.length > 5 ? ` ... (+${chunkRecordIds.length - 5} more)` : ""}`
    );

    const token = await sfAuthToken();
    const baseUrl = token?.instanceUrl;
    console.log(
      `${getCurrentTimestamp()} 🌐 - getChunks - baseUrl: ${baseUrl ? baseUrl.replace(/https?:\/\//, "").split("/")[0] : "none"}, hasToken: ${!!token?.accessToken}`
    );

    if (token?.accessToken && baseUrl) {
      // Data 360 SQL: table and column names per Connect API; chunk DMO uses RecordId__c (not Id)
      const escapedIds = chunkRecordIds.map((id) => `'${String(id).replace(/'/g, "''")}'`).join(", ");
      const tableName = `"${chunkObjectApiName}"`;
      const sql = `SELECT RecordId__c, Chunk__c FROM ${tableName} WHERE RecordId__c IN (${escapedIds})`;
      const querySqlUrl = `${baseUrl.replace(/\/$/, "")}/services/data/v64.0/ssot/query-sql`;
      console.log(
        `${getCurrentTimestamp()} 📤 - getChunks - Data Cloud POST sql (full): ${sql}`
      );

      try {
        const createRes = await fetch(querySqlUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token.accessToken}`,
          },
          body: JSON.stringify({ sql }),
        });

        if (!createRes.ok) {
          const errText = await createRes.text();
          console.warn(
            `${getCurrentTimestamp()} ⚠️ - getChunks - Data Cloud createSqlQuery failed: ${createRes.status} ${errText}`
          );
        } else {
          const createData = await createRes.json();
          const createKeys = Object.keys(createData || {}).join(", ");
          console.log(
            `${getCurrentTimestamp()} 📥 - getChunks - createSqlQuery response keys: ${createKeys}`
          );
          // Log full SQL response (truncate long strings so we see structure and column order)
          const maxLen = 400;
          const truncated = JSON.stringify(
            createData,
            (_, v) => (typeof v === "string" && v.length > maxLen ? `${v.slice(0, maxLen)}... [truncated ${v.length}]` : v),
            2
          );
          console.log(`${getCurrentTimestamp()} 📥 - getChunks - createSqlQuery response (strings >${maxLen} truncated):\n${truncated}`);
          const queryId = createData.id ?? createData.queryId ?? createData.query_id;
          if (queryId) {
            console.log(
              `${getCurrentTimestamp()} 🔗 - getChunks - fetching rows for queryId: ${queryId}`
            );
          }
          if (queryId) {
            const rowsUrl = `${baseUrl.replace(/\/$/, "")}/services/data/v64.0/ssot/query-sql/${queryId}/rows`;
            const rowsRes = await fetch(rowsUrl, {
              method: "GET",
              headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token.accessToken}`,
              },
            });

            if (rowsRes.ok) {
              const rowsData = await rowsRes.json();
              const records = rowsData.rows ?? rowsData.data ?? rowsData.records ?? [];
              const meta = rowsData.metadata;
              const columns = getColumnNames(meta);
              const chunkRows = records.map((rec) => {
                const citation = Array.isArray(rec) && columns.length
                  ? (() => { const i = columns.findIndex((c) => (c && String(c).toLowerCase()) === "citation__c"); return i >= 0 && rec[i] != null ? rec[i] : null; })()
                  : (rec.Citation__c ?? rec.citation__c ?? null);
                return {
                  Chunk__c: getChunkTextFromRow(rec, meta),
                  Citation__c: citation,
                };
              });
              const sample = chunkRows[0]?.Chunk__c?.slice(0, 60);
              console.log(
                `${getCurrentTimestamp()} ✅ - getChunks - Data Cloud /rows returned ${chunkRows.length} chunk(s) (sample Chunk__c: ${sample ? `"${sample}..."` : "empty"})`
              );
              return res.status(200).json({ chunkRows });
            }
            console.log(
              `${getCurrentTimestamp()} ⚠️ - getChunks - GET /rows failed: ${rowsRes.status} ${await rowsRes.text().catch(() => "")}`
            );
          }

          const inlineRecords =
            createData.rows ?? createData.data ?? (Array.isArray(createData.records) ? createData.records : null);
          if (Array.isArray(inlineRecords) && inlineRecords.length > 0) {
            const meta = createData.metadata;
            if (Array.isArray(inlineRecords[0])) {
              console.log(
                `${getCurrentTimestamp()} 📥 - getChunks - inline rows are arrays; column names: ${JSON.stringify(getColumnNames(meta))}`
              );
            } else if (inlineRecords[0] && typeof inlineRecords[0] === "object") {
              console.log(
                `${getCurrentTimestamp()} 📥 - getChunks - first inline row keys: ${Object.keys(inlineRecords[0]).join(", ")}`
              );
            }
            const columns = getColumnNames(meta);
            const chunkRows = inlineRecords.map((rec) => {
              const chunkText = getChunkTextFromRow(rec, meta);
              const citation = Array.isArray(rec) && columns.length
                ? (() => { const i = columns.findIndex((c) => (c && String(c).toLowerCase()) === "citation__c"); return i >= 0 && rec[i] != null ? rec[i] : null; })()
                : (rec.Citation__c ?? rec.citation__c ?? null);
              return {
                Chunk__c: chunkText,
                Citation__c: citation,
              };
            });
            console.log(
              `${getCurrentTimestamp()} ✅ - getChunks - Data Cloud (inline) returned ${chunkRows.length} chunk(s) (first Chunk__c length: ${chunkRows[0]?.Chunk__c?.length ?? 0})`
            );
            return res.status(200).json({ chunkRows });
          }
          if (!queryId && (!inlineRecords || inlineRecords.length === 0)) {
            console.log(
              `${getCurrentTimestamp()} 📭 - getChunks - create response had no queryId and no inline rows`
            );
          }
        }
      } catch (apiErr) {
        console.warn(`${getCurrentTimestamp()} ⚠️ - getChunks - Data Cloud query failed:`, apiErr.message);
        if (apiErr.stack) {
          console.warn(`${getCurrentTimestamp()} 📜 - getChunks - stack: ${String(apiErr.stack).slice(0, 300)}`);
        }
      }
    } else {
      console.log(
        `${getCurrentTimestamp()} 📭 - getChunks - skipping Data Cloud (no token or baseUrl)`
      );
    }

    // Fallback: local chunks data file (e.g. server/public/data/chunks.json or chunks_<objectApiName>.json)
    const dataDir = path.resolve(__dirname, "../../../public/data");
    const candidates = [
      path.join(dataDir, `chunks_${chunkObjectApiName}.json`),
      path.join(dataDir, "chunks.json"),
    ];

    console.log(
      `${getCurrentTimestamp()} 📁 - getChunks - trying local fallback; candidates: ${candidates.join(", ")}`
    );
    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        console.log(`${getCurrentTimestamp()} 📂 - getChunks - found file: ${filePath}`);
        try {
          const raw = fs.readFileSync(filePath, "utf8");
          const data = JSON.parse(raw);
          // Support formats: { "recordId": "text" } or { "recordId": { "Chunk__c": "..." } } or { "chunks": [{ Id, Chunk__c }] }
          const chunkRows = [];
          if (Array.isArray(data.chunks)) {
            for (const id of chunkRecordIds) {
              const row = data.chunks.find((c) => c.Id === id || c.id === id);
              chunkRows.push({
                Chunk__c: row?.Chunk__c ?? row?.chunk ?? "",
                Citation__c: row?.Citation__c ?? row?.citation ?? null,
              });
            }
          } else if (data && typeof data === "object") {
            for (const id of chunkRecordIds) {
              const val = data[id];
              if (typeof val === "string") {
                chunkRows.push({ Chunk__c: val, Citation__c: null });
              } else if (val && typeof val === "object") {
                chunkRows.push({
                  Chunk__c: val.Chunk__c ?? val.chunk ?? "",
                  Citation__c: val.Citation__c ?? val.citation ?? null,
                });
              } else {
                chunkRows.push({ Chunk__c: "", Citation__c: null });
              }
            }
          }
          if (chunkRows.length > 0) {
            console.log(`${getCurrentTimestamp()} ✅ - getChunks - Local file returned ${chunkRows.length} chunk(s) from ${filePath}`);
            return res.status(200).json({ chunkRows });
          }
          console.log(`${getCurrentTimestamp()} 📭 - getChunks - file ${filePath} parsed but produced 0 chunk rows`);
        } catch (fileErr) {
          console.warn(`${getCurrentTimestamp()} ⚠️ - getChunks - Local file read failed:`, fileErr.message);
        }
      }
    }

    // No data found: return empty chunk rows so client can still render article without highlights
    console.log(`${getCurrentTimestamp()} 📭 - getChunks - No chunk data from Data Cloud or local file; returning empty chunkRows`);
    return res.status(200).json({ chunkRows: [] });
  } catch (error) {
    console.error(`${getCurrentTimestamp()} ❌ - getChunks - Error:`, error.message);
    return res.status(500).json({ message: error.message });
  }
};

export default getChunks;
