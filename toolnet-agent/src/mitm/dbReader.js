import { readFileSync, existsSync } from "fs";
import { ALIASES_FILE } from "../../src/system/paths.js";

function readCache() {
  try {
    if (!existsSync(ALIASES_FILE)) return null;
    return JSON.parse(readFileSync(ALIASES_FILE, "utf-8"));
  } catch { return null; }
}

export function getMitmAlias(toolName) {
  const all = readCache();
  return all?.[toolName] || null;
}