// Free OpenCode models that don't use the "-free" id suffix
const KNOWN_FREE_OPENCODE_MODELS = ["big-pickle"];
// Dead or unavailable models to exclude
const EXCLUDED_OPENCODE_MODELS = new Set(["deepseek-v4-flash-free"]);

export const FILTERS = {
  "openrouter-free": (models) =>
    (Array.isArray(models) ? models : [])
      .filter(
        (m) =>
          m.isFree === true ||
          (m.pricing?.prompt !== undefined &&
            Number(m.pricing.prompt) === 0 &&
            Number(m.pricing.completion) === 0) ||
          m.id?.endsWith(":free")
      )
      .map((m) => ({
        id: m.id,
        name: m.name || m.id,
        contextLength: m.context_length || 0,
        isFree: true,
        supportsTools: Boolean(m.supported_parameters?.includes("tools")),
        supportsReasoning: Boolean(
          m.supported_parameters?.includes("reasoning") ||
          m.supported_parameters?.includes("include_reasoning")
        ),
        supportsVision: Boolean(m.architecture?.input_modalities?.includes("image")),
        supportsAudio: Boolean(m.architecture?.input_modalities?.includes("audio")),
      }))
      .sort((a, b) => b.contextLength - a.contextLength),

  "kilo-gateway": (models) =>
    (Array.isArray(models) ? models : [])
      .filter(
        (m) =>
          m.isFree === true ||
          (m.pricing?.prompt !== undefined &&
            Number(m.pricing.prompt) === 0 &&
            Number(m.pricing.completion) === 0)
      )
      .map((m) => ({
        id: m.id,
        name: m.name || m.id,
        contextLength: m.context_length || 0,
        isFree: true,
        supportsTools: Boolean(m.supported_parameters?.includes("tools")),
        supportsReasoning: Boolean(
          m.supported_parameters?.includes("reasoning") ||
          m.supported_parameters?.includes("include_reasoning")
        ),
        supportsVision: Boolean(m.architecture?.input_modalities?.includes("image")),
      }))
      .sort((a, b) => b.contextLength - a.contextLength),

  "kilo-free": (models) => FILTERS["kilo-gateway"](models),

  "opencode-free": (models) =>
    models
      .filter(
        (m) =>
          !EXCLUDED_OPENCODE_MODELS.has(m.id) &&
          (m.id?.endsWith("-free") || KNOWN_FREE_OPENCODE_MODELS.includes(m.id))
      )
      .map((m) => ({ id: m.id, name: m.id })),

  // models.dev returns a large catalog; keep only mimo models
  "mimo-free": (models) =>
    (Array.isArray(models) ? models : [])
      .filter((m) => m.id?.startsWith("mimo") || m.name?.toLowerCase().includes("mimo"))
      .map((m) => ({ id: m.id, name: m.name || m.id })),

  "api-airforce-free": (models) =>
    (Array.isArray(models) ? models : [])
      .filter((m) => m.supports_chat !== false && (m.tier === "free" || m.access_tiers?.includes("free")))
      .map((m) => ({ id: m.id, name: m.id, contextLength: m.context_length || m.max_tokens })),
};
