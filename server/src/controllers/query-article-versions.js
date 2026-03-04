import sfAuthToken from "../utils/authToken.js";
import { getCurrentTimestamp } from "../utils/loggingUtil.js";
import { getCustomerById } from "../utils/customerConfig.js";

/**
 * GET /api/v1/article-versions?customerId=...&title=...&language=...&currentContentId=...
 * Used only when the article view is opened, to fill the "Other versions" (clustering) dropdown.
 * Runs SOQL against the customer's harmonized object to find articles with the same Title__c
 * (and optional Language__c). Returns other content IDs for the dropdown.
 */
const queryArticleVersions = async (req, res) => {
  try {
    const customerId = req.query.customerId;
    const title = req.query.title;
    const language = req.query.language || null;
    const currentContentId = req.query.currentContentId || null;

    if (!customerId || !title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        errorCode: "MISSING_PARAMETERS",
        message: "customerId and title are required",
      });
    }

    const customer = getCustomerById(customerId);
    const objectApiName = customer.objectApiName; // relevant HUDMO for this customer (e.g. hexagon_zoomin_2_harmonized__dlm, SFDCHelp7_DMO_harmonized__dlm)
    if (!objectApiName) {
      return res.status(400).json({
        errorCode: "NO_OBJECT",
        message: `Customer ${customerId} has no objectApiName configured`,
      });
    }

    const titleEscaped = title.trim().replace(/'/g, "''");
    // SOQL matches Postman query: same SELECT and WHERE Title__c = '<title>' only (no Language__c filter so result matches Postman).
    const selectFields =
      "Attachments__c, cdp_sys_SourceVersion__c, CitationReference__c, ConnectorType__c, Content_ID__c, ContentType__c, DataSource__c, DataSourceObject__c, SourceUrl__c, Title__c";
    const soqlQuery = `SELECT ${selectFields} FROM ${objectApiName} WHERE Title__c = '${titleEscaped}'`;

    console.log(
      `${getCurrentTimestamp()} 📝 - queryArticleVersions - SOQL: ${soqlQuery}, Customer: ${customerId}`
    );

    const { accessToken, instanceUrl } = await sfAuthToken(customerId);
    const encodedQuery = encodeURIComponent(soqlQuery);
    const apiUrl = `${instanceUrl}/services/data/v59.0/query/?q=${encodedQuery}`;

    const config = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    };

    const response = await fetch(apiUrl, config);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `${getCurrentTimestamp()} ❌ - queryArticleVersions - API Error: ${response.status} ${response.statusText}`
      );
      console.error(`${getCurrentTimestamp()} ❌ - queryArticleVersions - Response: ${errorText}`);
      return res.status(response.status).json({
        errorCode: "SOQL_ERROR",
        message: response.statusText,
        details: errorText,
      });
    }

    const data = await response.json();
    let records = data.records || [];

    if (data.nextRecordsUrl) {
      let nextUrl = `${instanceUrl}${data.nextRecordsUrl}`;
      while (nextUrl) {
        const nextRes = await fetch(nextUrl, config);
        if (!nextRes.ok) break;
        const nextData = await nextRes.json();
        records = records.concat(nextData.records || []);
        nextUrl = nextData.nextRecordsUrl ? `${instanceUrl}${nextData.nextRecordsUrl}` : null;
      }
    }

    console.log(
      `${getCurrentTimestamp()} 📊 - queryArticleVersions - Salesforce returned ${records.length} record(s) for object ${objectApiName}, title "${title.trim()}", currentContentId=${currentContentId || "(none)"}`
    );
    if (records.length > 0) {
      const firstKeys = Object.keys(records[0]).filter((k) => k !== "attributes");
      console.log(
        `${getCurrentTimestamp()} 📊 - queryArticleVersions - First record keys (excl. attributes): ${firstKeys.join(", ")}`
      );
    }

    const contentIdKey = records.length
      ? Object.keys(records[0]).find((k) => k.toLowerCase() === "content_id__c") || "Content_ID__c"
      : "Content_ID__c";
    const titleKey = records.length
      ? Object.keys(records[0]).find((k) => k.toLowerCase() === "title__c") || "Title__c"
      : "Title__c";
    // versionName is not set here; client fetches HUDMO content and reads <meta name="version" content="..."> from each article.

    const versions = [];
    const seen = new Set();
    for (const rec of records) {
      const contentId = rec[contentIdKey] ?? rec.Content_ID__c ?? rec.content_id__c ?? rec.Id ?? null;
      const contentIdStr = contentId != null ? String(contentId).trim() : null;
      if (!contentIdStr) {
        console.log(`${getCurrentTimestamp()} 📊 - queryArticleVersions - Skip record: no Content_ID__c (keys: ${Object.keys(rec).join(", ")})`);
        continue;
      }
      if (contentIdStr === currentContentId) {
        console.log(`${getCurrentTimestamp()} 📊 - queryArticleVersions - Skip record: same as currentContentId ${contentIdStr}`);
        continue;
      }
      if (seen.has(contentIdStr)) continue;
      seen.add(contentIdStr);
      const rowTitle = rec[titleKey] ?? rec.Title__c ?? rec.title__c ?? "";
      versions.push({
        contentId: contentIdStr,
        title: String(rowTitle),
        hudmo: objectApiName,
      });
    }

    console.log(
      `${getCurrentTimestamp()} ✅ - queryArticleVersions - ${versions.length} version(s) for title "${title.trim()}"`
    );

    res.status(200).json({ versions });
  } catch (error) {
    console.error(
      `${getCurrentTimestamp()} ❌ - queryArticleVersions - Error: ${error.message}`
    );
    res.status(500).json({
      errorCode: "QUERY_ERROR",
      message: error.message,
    });
  }
};

export default queryArticleVersions;
