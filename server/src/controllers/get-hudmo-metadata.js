import sfAuthToken from "../utils/authToken.js";
import { getCurrentTimestamp } from "../utils/loggingUtil.js";
import { getCustomerById } from "../utils/customerConfig.js";

/**
 * Direct-query the harmonized HUDMO DMO table (bypassing the EK rendering API) for a single
 * article row, and return a curated set of metadata the rendering API does NOT surface:
 * real last-modified date, language, harmonization status, source/connector provenance,
 * copyright, and the original source document name.
 *
 * Query is by Content_ID__c = dccid against the customer's objectApiName.
 */

// Curated columns worth pulling. We intentionally skip S3 paths, ETag, Score, internal ids, etc.
const SELECT_FIELDS = [
  "Title__c",
  "Language__c",
  "LastModified__c",
  "IsHarmonized__c",
  "ConnectorType__c",
  "DataSource__c",
  "ContentType__c",
  "Size__c",
  "OriginId__c",
  "Metadata__c",
].join(",");

/** Pull the last path segment (file name) from a zip/path string. */
function baseName(pathish) {
  if (typeof pathish !== "string" || !pathish) return null;
  const parts = pathish.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : pathish;
}

/** The original source document is the top-level container of OriginId (e.g. the .zip bundle name). */
function sourceDocument(originId) {
  if (typeof originId !== "string" || !originId) return null;
  const first = originId.split("/").filter(Boolean)[0];
  return first || null;
}

const getHudmoMetadata = async (req, res) => {
  try {
    console.log(`${getCurrentTimestamp()} 🗄️ - getHudmoMetadata - Request received...`);

    const dccid = req.query.dccid || req.body?.dccid;
    const customerId = req.query.customerId || req.body?.customerId;

    if (!dccid || !customerId) {
      return res.status(400).json({
        errorCode: "MISSING_PARAMETERS",
        message: "Both dccid and customerId are required",
      });
    }

    let objectApiName;
    try {
      objectApiName = getCustomerById(customerId)?.objectApiName;
    } catch {
      objectApiName = null;
    }
    if (!objectApiName) {
      console.log(`${getCurrentTimestamp()} 📝 - getHudmoMetadata - No objectApiName for customer: ${customerId}`);
      return res.status(200).json({ data: null });
    }

    const { accessToken, instanceUrl } = await sfAuthToken(customerId);

    const soql = `SELECT ${SELECT_FIELDS} FROM ${objectApiName} WHERE Content_ID__c='${dccid}' LIMIT 1`;
    const apiUrl = `${instanceUrl}/services/data/v64.0/query/?q=${encodeURIComponent(soql)}`;

    console.log(`${getCurrentTimestamp()} 🌐 - getHudmoMetadata - Querying ${objectApiName} for dccid ${dccid}`);

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${getCurrentTimestamp()} ❌ - getHudmoMetadata - API Error: ${response.status} ${errorText.slice(0, 300)}`);
      // Degrade gracefully: this is enrichment, not core content.
      return res.status(200).json({ data: null });
    }

    const result = await response.json();
    const rec = result.records?.[0];
    if (!rec) {
      console.log(`${getCurrentTimestamp()} 📭 - getHudmoMetadata - No row for dccid ${dccid}`);
      return res.status(200).json({ data: null });
    }

    // Metadata__c is a JSON string (copyright, description, generator, miniToc, title).
    let metaObj = {};
    if (typeof rec.Metadata__c === "string" && rec.Metadata__c.trim()) {
      try {
        metaObj = JSON.parse(rec.Metadata__c);
      } catch {
        metaObj = {};
      }
    }

    const data = {
      title: rec.Title__c ?? null,
      language: rec.Language__c ?? null,
      lastModified: rec.LastModified__c ?? null,
      isHarmonized: rec.IsHarmonized__c === true,
      connectorType: rec.ConnectorType__c ?? null,
      dataSource: rec.DataSource__c ?? null,
      contentType: rec.ContentType__c ?? null,
      size: typeof rec.Size__c === "number" ? rec.Size__c : rec.Size__c ? Number(rec.Size__c) : null,
      copyright: metaObj.copyright ?? null,
      description: metaObj.description ?? null,
      generator: metaObj.generator ?? null,
      sourceDocument: sourceDocument(rec.OriginId__c),
      sourceFile: baseName(rec.OriginId__c),
    };

    console.log(`${getCurrentTimestamp()} ✅ - getHudmoMetadata - Metadata resolved for dccid ${dccid}`);
    res.status(200).json({ data });
  } catch (error) {
    console.error(`${getCurrentTimestamp()} ❌ - getHudmoMetadata - Error: ${error.message}`);
    // Enrichment endpoint: never hard-fail the article view.
    res.status(200).json({ data: null });
  }
};

export default getHudmoMetadata;
