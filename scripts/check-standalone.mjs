import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const distDir = process.env.NEXT_DIST_DIR || ".next";
const buildDir = resolve(process.cwd(), distDir);
const standaloneDir = resolve(buildDir, "standalone");

// Recursively list files (Node >=20 readdirSync({recursive:true}) returns names
// with a trailing separator for dirs; we only care about the count here).
function fileCount(dir) {
  if (!existsSync(dir)) return 0;
  try {
    return readdirSync(dir, { recursive: true }).filter((f) => !String(f).endsWith("/")).length;
  } catch {
    return 0;
  }
}

function hasFileSuffix(dir, suffix) {
  if (!existsSync(dir)) return false;
  try {
    return readdirSync(dir, { recursive: true }).some((f) => String(f).endsWith(suffix));
  } catch {
    return false;
  }
}

function hasApiRoutes(dir) {
  if (!existsSync(dir)) return false;
  try {
    return readdirSync(dir, { recursive: true }).some((f) => String(f).includes("route"));
  } catch {
    return false;
  }
}

const required = [
  { label: "standalone server entry (server.js)", exists: () => existsSync(join(standaloneDir, "server.js")) },
  { label: "standalone server chunks (.next/server)", exists: () => fileCount(join(standaloneDir, distDir, "server")) > 0 },
  { label: "standalone static assets (.next/static)", exists: () => fileCount(join(standaloneDir, distDir, "static")) > 0 },
  { label: "standalone public assets (public)", exists: () => fileCount(join(standaloneDir, "public")) > 0 },
  { label: "dashboard page chunk", exists: () => hasFileSuffix(join(standaloneDir, distDir, "server", "app"), "page.js") || hasFileSuffix(join(standaloneDir, distDir, "server", "app"), "page.mjs") },
  { label: "api/v1 route chunk", exists: () => hasApiRoutes(join(standaloneDir, distDir, "server", "app", "api", "v1")) },
];

let failures = 0;
for (const item of required) {
  const ok = item.exists();
  if (!ok) {
    console.error(`[standalone-check] MISSING: ${item.label}`);
    failures++;
  } else {
    console.log(`[standalone-check] ok: ${item.label}`);
  }
}

if (failures > 0) {
  console.error(`[standalone-check] Integrity check FAILED (${failures} missing). Refusing to ship a broken build.`);
  process.exit(1);
}
console.log("[standalone-check] Standalone build integrity OK");