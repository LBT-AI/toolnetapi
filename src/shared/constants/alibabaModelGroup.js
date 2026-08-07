// Pure, dependency-free helpers for the Alibaba Model Pool feature.
// Importable from BOTH server code (open-sse/src) and client components.

export const ALIBABA_GROUP_NAMES = ["light", "code", "reasoning", "vision", "fallback"];

/**
 * Determine if a model ID qualifies for a given group based on naming heuristics.
 * Used for auto-classification suggestions only.
 */
export function classifyModelToGroup(modelId) {
  const id = modelId.toLowerCase();
  if (id.includes("vl") || id.includes("vision") || id.includes("ocr") || id.includes("qvq")) return "vision";
  if (id.includes("coder") || id.includes("code")) return "code";
  if (id.includes("thinking") || id.includes("qwq") || id.includes("r1") || id.includes("reasoning")) return "reasoning";
  if (id.includes("flash") || id.includes("turbo") || id.includes("lite") || id.includes("mini")) return "light";
  return null;
}
