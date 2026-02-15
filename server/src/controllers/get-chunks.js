import sfAuthToken from "../utils/authToken.js";
import { getCurrentTimestamp } from "../utils/loggingUtil.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEBUG_LOG_PATH = path.resolve(__dirname, "../../../.cursor/debug.log");
function debugLog(payload) {
  try {
    const dir = path.dirname(DEBUG_LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(DEBUG_LOG_PATH, JSON.stringify(payload) + "\n");
  } catch (_) {}
}

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
    const chunkColNames = ["chunk__c", "chunk"];
    for (const colName of chunkColNames) {
      const idx = columns.findIndex((c) => c && String(c).toLowerCase() === colName);
      if (idx >= 0 && rec[idx] != null && typeof rec[idx] === "string") return String(rec[idx]);
    }
    // Fallback by position: SELECT is SourceRecordId__c, RecordId__c, Chunk__c so index 2 is Chunk__c; or [id, chunk] -> index 1
    if (rec.length >= 3 && rec[2] != null && typeof rec[2] === "string") return String(rec[2]);
    if (rec.length === 2 && rec[1] != null && typeof rec[1] === "string") return String(rec[1]);
    return "";
  }
  if (typeof rec !== "object") return "";
  const v = rec.Chunk__c ?? rec.chunk__c ?? rec.Chunk ?? rec.chunk;
  if (v != null && typeof v === "string") return v;
  const key = Object.keys(rec).find((k) => ["chunk__c", "chunk"].includes(k.toLowerCase()));
  return key != null && typeof rec[key] === "string" ? rec[key] : "";
}

/** Extract RecordId__c from a row (for ordering). Returns string or null. */
function getRecordIdFromRow(rec, metadata) {
  if (rec == null) return null;
  if (Array.isArray(rec)) {
    const columns = getColumnNames(metadata);
    const idx = columns.findIndex((c) => (c && String(c).toLowerCase()) === "recordid__c");
    if (idx >= 0 && rec[idx] != null) return String(rec[idx]);
    return null;
  }
  if (typeof rec !== "object") return null;
  const v = rec.RecordId__c ?? rec.recordId__c;
  if (v != null) return String(v);
  const key = Object.keys(rec).find((k) => k.toLowerCase() === "recordid__c");
  return key != null && rec[key] != null ? String(rec[key]) : null;
}

/** Extract SourceRecordId__c from a row (request ids are source record ids). Returns string or null. */
function getSourceRecordIdFromRow(rec, metadata) {
  if (rec == null) return null;
  if (Array.isArray(rec)) {
    const columns = getColumnNames(metadata);
    const idx = columns.findIndex((c) => (c && String(c).toLowerCase()) === "sourcerecordid__c");
    if (idx >= 0 && rec[idx] != null) return String(rec[idx]);
    return null;
  }
  if (typeof rec !== "object") return null;
  const v = rec.SourceRecordId__c ?? rec.sourceRecordId__c;
  if (v != null) return String(v);
  const key = Object.keys(rec).find((k) => k.toLowerCase() === "sourcerecordid__c");
  return key != null && rec[key] != null ? String(rec[key]) : null;
}

/**
 * Get chunk text for given chunk record IDs by querying the chunks table in Data 360.
 * Uses the Data 360 Connect REST API (Query SQL):
 *   https://developer.salesforce.com/docs/data/data-cloud-query-guide
 * - POST /services/data/v64.0/ssot/query-sql with body { sql } (Create SQL Query)
 * - GET /services/data/v64.0/ssot/query-sql/{queryId}/rows (Get SQL Query Results)
 * Uses same base URL (instance_url from OAuth) as get-hudmo and other APIs.
 * Chunk DMO: request ids can be source record ids or record ids; query by SourceRecordId__c OR RecordId__c. Returns Chunk__c, Citation__c.
 * Falls back to local file only if API is unavailable.
 */
const getChunks = async (req, res) => {
  // #region agent log
  (() => {
    const payload = { location: "get-chunks.js:entry", message: "getChunks invoked", data: { chunkRecordIdsLen: (req.body?.chunkRecordIds != null) ? (Array.isArray(req.body.chunkRecordIds) ? req.body.chunkRecordIds.length : String(req.body.chunkRecordIds).split(",").length) : 0, requestOrderFirst3: Array.isArray(req.body?.chunkRecordIds) ? req.body.chunkRecordIds.slice(0, 3) : (typeof req.body?.chunkRecordIds === "string" ? req.body.chunkRecordIds.split(",").map((id) => id.trim()).filter(Boolean).slice(0, 3) : []) }, timestamp: Date.now(), hypothesisId: "A" };
    debugLog(payload);
    fetch("http://127.0.0.1:7242/ingest/bebf9a71-04a2-4e86-a513-895cda001ee7", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => {});
  })();
  // #endregion
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
      // Data 360 SQL: support both source record ids and record ids (WHERE SourceRecordId__c IN (...) OR RecordId__c IN (...))
      const escapedIds = chunkRecordIds.map((id) => `'${String(id).replace(/'/g, "''")}'`).join(", ");
      const tableName = `"${chunkObjectApiName}"`;
      const sql = `SELECT SourceRecordId__c, RecordId__c, Chunk__c FROM ${tableName} WHERE (SourceRecordId__c IN (${escapedIds}) OR RecordId__c IN (${escapedIds}))`;
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
          // #region agent log
          (() => {
            const payload = { location: "get-chunks.js:create-not-ok", message: "createSqlQuery failed", data: { createStatus: createRes.status, errLen: (errText || "").length }, timestamp: Date.now(), hypothesisId: "B" };
            debugLog(payload);
            fetch("http://127.0.0.1:7242/ingest/bebf9a71-04a2-4e86-a513-895cda001ee7", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => {});
          })();
          // #endregion
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
          const result = createData?.result ?? createData;
          const statusObj = createData?.status ?? result?.status;
          const statusAsId =
            typeof statusObj === "string" && statusObj.length > 15 && !/^(Complete|Completed|Pending|Running|Failed|Error|Success|Submitted)$/i.test(statusObj.trim())
              ? statusObj
              : null;
          const queryId =
            createData?.id ?? createData?.queryId ?? createData?.query_id
            ?? result?.id ?? result?.queryId ?? result?.query_id
            ?? statusAsId
            ?? (statusObj?.id ?? statusObj?.queryId ?? statusObj?.query_id ?? null);
          const rr = createData?.returnedRows ?? result?.returnedRows;
          const fromReturnedRows = Array.isArray(rr)
            ? rr
            : rr && typeof rr === "object" && (Array.isArray(rr.rows) || Array.isArray(rr.data) || Array.isArray(rr.records))
              ? (rr.rows ?? rr.data ?? rr.records ?? null)
              : null;
          const meta = createData?.metadata ?? result?.metadata;
          let fromMetadata = null;
          let usedMetaRowsIndex = -1;
          if (meta && typeof meta === "object") {
            if (Array.isArray(meta.rows)) fromMetadata = meta.rows;
            else if (Array.isArray(meta.data)) fromMetadata = meta.data;
            else if (Array.isArray(meta.records)) fromMetadata = meta.records;
            else if (Array.isArray(meta)) {
              if (meta.length >= 2 && Array.isArray(meta[1])) {
                fromMetadata = meta[1];
                usedMetaRowsIndex = 1;
              } else if (meta.length >= 1 && Array.isArray(meta[0])) {
                fromMetadata = meta[0];
                usedMetaRowsIndex = 0;
              } else if (meta.length >= 2 && meta[1] && typeof meta[1] === "object" && !Array.isArray(meta[1])) {
                const m1 = meta[1];
                const nested = m1.rows ?? m1.data ?? m1.result ?? (Array.isArray(m1.records) ? m1.records : null);
                if (Array.isArray(nested)) {
                  fromMetadata = nested;
                  usedMetaRowsIndex = 1;
                }
              }
              if (!fromMetadata && meta.length >= 1 && meta[0] && typeof meta[0] === "object" && !Array.isArray(meta[0])) {
                const m0 = meta[0];
                const nested0 = m0.rows ?? m0.data ?? m0.result ?? (Array.isArray(m0.records) ? m0.records : null);
                if (Array.isArray(nested0)) {
                  fromMetadata = nested0;
                  usedMetaRowsIndex = 0;
                }
              }
              if (!fromMetadata) {
                const rowsEntry = meta.find((el) => Array.isArray(el) && el.length > 0);
                if (rowsEntry) fromMetadata = rowsEntry;
              }
            }
          }
          const inlineRecordsRaw =
            fromReturnedRows ?? fromMetadata
            ?? createData?.rows ?? createData?.data ?? (Array.isArray(createData?.records) ? createData.records : null)
            ?? result?.rows ?? result?.data ?? (Array.isArray(result?.records) ? result.records : null);
          if (queryId) {
            console.log(
              `${getCurrentTimestamp()} 🔗 - getChunks - fetching rows for queryId: ${queryId}`
            );
          }
          if (queryId) {
            const rowLimit = Math.max(chunkRecordIds.length, 100);
            const rowsUrl = `${baseUrl.replace(/\/$/, "")}/services/data/v64.0/ssot/query-sql/${queryId}/rows?offset=0&rowLimit=${rowLimit}`;
            const rowsRes = await fetch(rowsUrl, {
              method: "GET",
              headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token.accessToken}`,
              },
            });

            if (rowsRes.ok) {
              const rowsData = await rowsRes.json();
              const rowsResult = rowsData?.result ?? rowsData;
              const recordsRaw = rowsData?.data ?? rowsData?.rows ?? (Array.isArray(rowsData?.records) ? rowsData.records : null)
                ?? rowsResult?.data ?? rowsResult?.rows ?? (Array.isArray(rowsResult?.records) ? rowsResult.records : null)
                ?? (Array.isArray(rowsData?.returnedRows) ? rowsData.returnedRows : null)
                ?? (Array.isArray(rowsResult?.returnedRows) ? rowsResult.returnedRows : null);
              const records = Array.isArray(recordsRaw) ? recordsRaw : [];
              if (records.length === 0) {
                debugLog({ location: "get-chunks.js:rows-zero", message: "GET /rows returned 0 records", data: { rowsDataKeys: Object.keys(rowsData || {}), rowsResultKeys: Object.keys(rowsResult || {}), returnedRowsVal: rowsData?.returnedRows, hasResult: !!rowsData?.result }, timestamp: Date.now(), hypothesisId: "B" });
              }
              const meta = rowsData?.metadata ?? rowsResult?.metadata;
              const columns = getColumnNames(meta);
              const byId = new Map();
              for (const rec of records) {
                const sid = getSourceRecordIdFromRow(rec, meta);
                const rid = getRecordIdFromRow(rec, meta);
                if (sid != null) byId.set(sid, rec);
                if (rid != null) byId.set(rid, rec);
              }
              const responseOrder = chunkRecordIds.map((id) => (byId.has(id) ? id : null));
              const chunkRows = chunkRecordIds.map((id) => {
                const rec = byId.get(id);
                if (!rec) return { Chunk__c: "", Citation__c: null };
                const citation = Array.isArray(rec) && columns.length
                  ? (() => { const i = columns.findIndex((c) => (c && String(c).toLowerCase()) === "citation__c"); return i >= 0 && rec[i] != null ? rec[i] : null; })()
                  : (rec.Citation__c ?? rec.citation__c ?? null);
                return {
                  Chunk__c: getChunkTextFromRow(rec, meta),
                  Citation__c: citation,
                };
              });
              // #region agent log
              (() => {
                const payload = { location: "get-chunks.js:rows-ok", message: "Data Cloud GET /rows ok", data: { branch: "rows", chunkRowsLen: chunkRows.length, requestOrderFirst3: chunkRecordIds.slice(0, 3), responseOrderFirst3: responseOrder.slice(0, 3), orderMatch: chunkRecordIds.slice(0, 3).every((id, i) => responseOrder[i] === id), columns: columns.slice(0, 5) }, timestamp: Date.now(), hypothesisId: "A" };
                debugLog(payload);
                fetch("http://127.0.0.1:7242/ingest/bebf9a71-04a2-4e86-a513-895cda001ee7", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => {});
              })();
              // #endregion
              const sample = chunkRows[0]?.Chunk__c?.slice(0, 60);
              console.log(
                `${getCurrentTimestamp()} ✅ - getChunks - Data Cloud /rows returned ${chunkRows.length} chunk(s) (sample Chunk__c: ${sample ? `"${sample}..."` : "empty"})`
              );
              if (chunkRows.length > 0) return res.status(200).json({ chunkRows });
              console.log(`${getCurrentTimestamp()} 📁 - getChunks - API returned 0 rows, trying local fallback`);
            }
            // #region agent log
            const rowsErrText = await rowsRes.text().catch(() => "");
            (() => {
              const payload = { location: "get-chunks.js:rows-not-ok", message: "GET /rows failed", data: { branch: "rows-failed", rowsStatus: rowsRes.status, rowsBodyLen: (rowsErrText || "").length, rowsBodyPreview: (rowsErrText || "").slice(0, 300), queryIdUsed: queryId }, timestamp: Date.now(), hypothesisId: "B" };
              debugLog(payload);
              fetch("http://127.0.0.1:7242/ingest/bebf9a71-04a2-4e86-a513-895cda001ee7", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => {});
            })();
            // #endregion
            console.log(
              `${getCurrentTimestamp()} ⚠️ - getChunks - GET /rows failed: ${rowsRes.status} ${rowsErrText}`
            );
          }

          const inlineRecords = Array.isArray(inlineRecordsRaw) ? inlineRecordsRaw : null;
          if (Array.isArray(inlineRecords) && inlineRecords.length > 0) {
            const metaRaw = createData?.metadata ?? result?.metadata;
            const meta =
              usedMetaRowsIndex >= 0 && Array.isArray(metaRaw) && metaRaw.length >= 2
                ? metaRaw[1 - usedMetaRowsIndex]
                : Array.isArray(metaRaw) && metaRaw.length > 0 ? metaRaw[0] : metaRaw;
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
            const byIdInline = new Map();
            for (const rec of inlineRecords) {
              const sid = getSourceRecordIdFromRow(rec, meta);
              const rid = getRecordIdFromRow(rec, meta);
              if (sid != null) byIdInline.set(sid, rec);
              if (rid != null) byIdInline.set(rid, rec);
            }
            const responseOrderInline = chunkRecordIds.map((id) => (byIdInline.has(id) ? id : null));
            const chunkRows = chunkRecordIds.map((id) => {
              const rec = byIdInline.get(id);
              if (!rec) return { Chunk__c: "", Citation__c: null };
              const chunkText = getChunkTextFromRow(rec, meta);
              const citation = Array.isArray(rec) && columns.length
                ? (() => { const i = columns.findIndex((c) => (c && String(c).toLowerCase()) === "citation__c"); return i >= 0 && rec[i] != null ? rec[i] : null; })()
                : (rec.Citation__c ?? rec.citation__c ?? null);
              return { Chunk__c: chunkText, Citation__c: citation };
            });
            // #region agent log
            (() => {
              const payload = { location: "get-chunks.js:inline-ok", message: "Data Cloud inline rows", data: { branch: "inline", chunkRowsLen: chunkRows.length, requestOrderFirst3: chunkRecordIds.slice(0, 3), responseOrderFirst3: responseOrderInline.slice(0, 3), orderMatch: chunkRecordIds.slice(0, 3).every((id, i) => responseOrderInline[i] === id), columns: columns.slice(0, 5) }, timestamp: Date.now(), hypothesisId: "A" };
              debugLog(payload);
              fetch("http://127.0.0.1:7242/ingest/bebf9a71-04a2-4e86-a513-895cda001ee7", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => {});
            })();
            // #endregion
            console.log(
              `${getCurrentTimestamp()} ✅ - getChunks - Data Cloud (inline) returned ${chunkRows.length} chunk(s) (first Chunk__c length: ${chunkRows[0]?.Chunk__c?.length ?? 0})`
            );
            return res.status(200).json({ chunkRows });
          }
          if (!queryId && (!inlineRecords || inlineRecords.length === 0)) {
            // #region agent log
            (() => {
              const createKeys = Object.keys(createData || {});
              const payload = {
                location: "get-chunks.js:no-queryId-no-inline",
                message: "No queryId and no inline rows",
                data: {
                  branch: "api-empty",
                  hasQueryId: !!queryId,
                  inlineLen: (inlineRecords && inlineRecords.length) || 0,
                  createDataKeys: createKeys,
                  metadataKeys: createData?.metadata && typeof createData.metadata === "object" ? Object.keys(createData.metadata) : undefined,
                  metaArrayLen: Array.isArray(createData?.metadata) ? createData.metadata.length : undefined,
                  meta1Type: createData?.metadata?.[1] != null ? typeof createData.metadata[1] : undefined,
                  meta1IsArray: Array.isArray(createData?.metadata?.[1]),
                  meta1Length: Array.isArray(createData?.metadata?.[1]) ? createData.metadata[1].length : undefined,
                  meta1Keys: createData?.metadata?.[1] && typeof createData.metadata[1] === "object" ? Object.keys(createData.metadata[1]) : undefined,
                  statusType: createData?.status != null ? typeof createData.status : undefined,
                  statusValue: typeof createData?.status === "string" ? createData.status : (createData?.status && typeof createData.status === "object" ? JSON.stringify(createData.status).slice(0, 200) : undefined),
                },
                timestamp: Date.now(),
                hypothesisId: "B",
              };
              debugLog(payload);
              fetch("http://127.0.0.1:7242/ingest/bebf9a71-04a2-4e86-a513-895cda001ee7", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => {});
            })();
            // #endregion
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
              const row = data.chunks.find(
                (c) =>
                  c.Id === id || c.id === id
                  || c.RecordId__c === id || (c.recordId__c != null && String(c.recordId__c) === id)
                  || c.SourceRecordId__c === id || (c.sourceRecordId__c != null && String(c.sourceRecordId__c) === id)
              );
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
            // #region agent log
            (() => {
              const fileFormat = Array.isArray(data.chunks) ? "chunksArray" : "objectMap";
              const fileKeysSample = Array.isArray(data.chunks) ? (data.chunks.slice(0, 2).map((c) => c.Id ?? c.id) || []) : Object.keys(data).slice(0, 3);
              const payload = { location: "get-chunks.js:local-ok", message: "Local file returned chunks", data: { branch: "local", chunkRowsLen: chunkRows.length, fileFormat, fileKeysSample, requestIdsFirst3: chunkRecordIds.slice(0, 3) }, timestamp: Date.now(), hypothesisId: "C" };
              debugLog(payload);
              fetch("http://127.0.0.1:7242/ingest/bebf9a71-04a2-4e86-a513-895cda001ee7", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => {});
            })();
            // #endregion
            console.log(`${getCurrentTimestamp()} ✅ - getChunks - Local file returned ${chunkRows.length} chunk(s) from ${filePath}`);
            return res.status(200).json({ chunkRows });
          }
          // #region agent log
          (() => {
            const payload = { location: "get-chunks.js:local-zero-rows", message: "File parsed but 0 chunk rows", data: { branch: "local-zero", filePath: path.basename(filePath), fileFormat: Array.isArray(data.chunks) ? "chunksArray" : "objectMap", requestIdsFirst3: chunkRecordIds.slice(0, 3) }, timestamp: Date.now(), hypothesisId: "C" };
            debugLog(payload);
            fetch("http://127.0.0.1:7242/ingest/bebf9a71-04a2-4e86-a513-895cda001ee7", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => {});
          })();
          // #endregion
          console.log(`${getCurrentTimestamp()} 📭 - getChunks - file ${filePath} parsed but produced 0 chunk rows`);
        } catch (fileErr) {
          console.warn(`${getCurrentTimestamp()} ⚠️ - getChunks - Local file read failed:`, fileErr.message);
        }
      }
    }

    // No data found: return empty chunk rows so client can still render article without highlights
    // #region agent log
    (() => {
      const payload = { location: "get-chunks.js:final-empty", message: "No chunk data from API or file", data: { branch: "empty", chunkRecordIdsLen: chunkRecordIds.length }, timestamp: Date.now(), hypothesisId: "B" };
      debugLog(payload);
      fetch("http://127.0.0.1:7242/ingest/bebf9a71-04a2-4e86-a513-895cda001ee7", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => {});
    })();
    // #endregion
    console.log(`${getCurrentTimestamp()} 📭 - getChunks - No chunk data from Data Cloud or local file; returning empty chunkRows`);
    return res.status(200).json({ chunkRows: [] });
  } catch (error) {
    console.error(`${getCurrentTimestamp()} ❌ - getChunks - Error:`, error.message);
    return res.status(500).json({ message: error.message });
  }
};

export default getChunks;
