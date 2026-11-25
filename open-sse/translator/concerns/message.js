import { OPENAI_BLOCK } from "../schema/index.js";

// Collapse an OpenAI content-part array: a lone text part becomes a plain string,
// or all text parts become a joined string. Matches existing translator behavior.
export function collapseTextParts(parts, opts = {}) {
  if (!Array.isArray(parts) || parts.length === 0) return parts;
  if (parts.length === 1 && parts[0].type === OPENAI_BLOCK.TEXT && !(opts.preserveCacheControl && parts[0].cache_control)) {
    return parts[0].text;
  }
  const allText = parts.every(p => p.type === OPENAI_BLOCK.TEXT && !(opts.preserveCacheControl && p.cache_control));
  if (allText) {
    return parts.map(p => p.text || "").join("\n");
  }
  return parts;
}
