#!/usr/bin/env node
/**
 * Try the Salesforce Fast Search API (Enterprise Search).
 * Run from repo root: node scripts/try-fast-search.js [query] [configurationName]
 *
 * Examples:
 *   node scripts/try-fast-search.js "data cloud"
 *   node scripts/try-fast-search.js "data cloud" "SFDCHelp7 DMO harmonized"
 *
 * Requires server/.env with SALESFORCE_LOGIN_URL, CLIENT_ID, CLIENT_SECRET.
 */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const serverEnvPath = join(repoRoot, "server", ".env");

function loadEnv() {
  if (!existsSync(serverEnvPath)) {
    console.error("server/.env not found. Copy server/.env.example to server/.env");
    process.exit(1);
  }
  const content = readFileSync(serverEnvPath, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let value = t.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

async function getToken(env) {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.CLIENT_ID || "",
    client_secret: env.CLIENT_SECRET || "",
  }).toString();
  const res = await fetch(`${env.SALESFORCE_LOGIN_URL}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("Token error:", data);
    process.exit(1);
  }
  return { accessToken: data.access_token, instanceUrl: data.instance_url };
}

async function main() {
  const env = loadEnv();
  const query = process.argv[2] || "search";
  const configurationName = process.argv[3] || null; // e.g. "SFDCHelp7 DMO harmonized" or omit for global

  console.log("Getting token...");
  const { accessToken, instanceUrl } = await getToken(env);

  const params = new URLSearchParams({ q: query, rankingMode: "Interleaved" });
  if (configurationName) params.set("configurationName", configurationName);
  const url = `${instanceUrl}/services/data/v64.0/connect/search/fast-search?${params.toString()}`;
  console.log("Request URL (base):", `${instanceUrl}/services/data/v64.0/connect/search/fast-search?q=...`);
  console.log("Query:", query, "Configuration:", configurationName || "(global)");
  console.log("");

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  console.log("Status:", res.status, res.statusText);
  try {
    const json = JSON.parse(text);
    console.log("Response:", JSON.stringify(json, null, 2));
  } catch {
    console.log("Response (raw):", text);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
