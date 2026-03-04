#!/usr/bin/env node
/**
 * Moves client/dist into server/public without wiping server/public.
 * Preserves server/public/data/ and other existing files (TOC XML, etc.).
 * Only replaces index.html and assets/ with the new build.
 */
import { rmSync, mkdirSync, cpSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const clientDist = join(repoRoot, "client", "dist");
const serverPublic = join(repoRoot, "server", "public");

if (!existsSync(clientDist)) {
  console.error("client/dist not found. Run the client build first.");
  process.exit(1);
}

if (!existsSync(serverPublic)) {
  mkdirSync(serverPublic, { recursive: true });
}

// Remove only built artifacts (index.html and assets/), not data/ or other files
const indexHtml = join(serverPublic, "index.html");
const assetsDir = join(serverPublic, "assets");
if (existsSync(indexHtml)) rmSync(indexHtml);
if (existsSync(assetsDir)) rmSync(assetsDir, { recursive: true });

// Copy new build into server/public (merge; preserves existing data/, etc.)
try {
  cpSync(clientDist, serverPublic, { recursive: true });
  console.log("move-build: copied client/dist into server/public (data/ preserved).");
} catch (err) {
  console.error("move-build error:", err.message);
  process.exit(1);
}
