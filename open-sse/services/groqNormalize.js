/**
 * Pure helper functions for Groq model ID normalization.
 * Completely dependency-free and safe for both client-side and server-side webpack bundles.
 */

/**
 * Normalizes a model identifier for Groq.
 * Upstream Groq requires 'groq/' prefix ONLY for compound models:
 *   - groq/compound
 *   - groq/compound-mini
 *
 * All other models (e.g. qwen/qwen3.8-27b, openai/gpt-oss-120b, whisper-large-v3)
 * do NOT have a 'groq/' prefix upstream.
 *
 * When clients pass 'groq/qwen/qwen3.8-27b' or 'groq/compound', this ensures
 * the correct upstream model ID is used.
 *
 * Examples:
 *   "groq/qwen/qwen3.8-27b"    -> "qwen/qwen3.8-27b"
 *   "qwen/qwen3.8-27b"         -> "qwen/qwen3.8-27b"
 *   "groq/compound"            -> "groq/compound"
 *   "compound"                 -> "groq/compound"
 *   "groq/groq/compound"       -> "groq/compound"
 *   "groq/openai/gpt-oss-120b" -> "openai/gpt-oss-120b"
 *   "groq/whisper-large-v3"    -> "whisper-large-v3"
 *
 * @param {string} modelId
 * @returns {string}
 */
export function normalizeGroqModelId(modelId) {
  if (!modelId || typeof modelId !== "string") return modelId;

  // Split off thinking suffix if present: "modelId(level)"
  const suffixMatch = modelId.match(/\([^()]+\)\s*$/);
  const suffix = suffixMatch ? suffixMatch[0] : "";
  let baseId = suffix ? modelId.slice(0, suffixMatch.index).trim() : modelId.trim();

  // Strip duplicate leading "groq/" (e.g. "groq/groq/compound" -> "groq/compound")
  while (baseId.startsWith("groq/groq/")) {
    baseId = baseId.slice(5);
  }

  // Handle compound and compound-mini: upstream ID officially starts with "groq/"
  if (baseId === "compound" || baseId === "groq/compound") {
    return `groq/compound${suffix}`;
  }
  if (baseId === "compound-mini" || baseId === "groq/compound-mini") {
    return `groq/compound-mini${suffix}`;
  }

  // For all other models: if it starts with "groq/", strip the leading "groq/"
  if (baseId.startsWith("groq/")) {
    baseId = baseId.slice(5);
  }

  return `${baseId}${suffix}`;
}
