#!/usr/bin/env node
/**
 * Reads Proofpoint TOC XML and outputs a CSV with content_id, title, href.
 * Usage: node scripts/proofpoint-toc-to-csv.js
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tocPath = join(__dirname, "../server/public/data/npre-user-guide-enus-toc-enhanced.xml");
const outPath = join(__dirname, "../server/public/data/proofpoint-content-ids.csv");

const xml = readFileSync(tocPath, "utf8");

// Match <nav ...> tags that have Content_ID__c (self-closing or with children)
const navRegex = /<nav\s+([^>]+?)(?:\s*\/?>|>)/g;
const rows = [];
let match;
while ((match = navRegex.exec(xml)) !== null) {
  const attrs = match[1];
  const contentId = attrs.match(/Content_ID__c="([^"]*)"/)?.[1];
  if (!contentId) continue;
  const title = attrs.match(/title="([^"]*)"/)?.[1] ?? "";
  const href = attrs.match(/href="([^"]*)"/)?.[1] ?? "";
  rows.push({ content_id: contentId, title, href });
}

function escapeCsv(s) {
  const str = String(s ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const header = "content_id,title,href";
const lines = [header, ...rows.map((r) => [r.content_id, r.title, r.href].map(escapeCsv).join(","))];
writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`Wrote ${rows.length} rows to ${outPath}`);
