// Free OpenCode models that don't use the "-free" id suffix (none in current catalog)
const KNOWN_FREE_OPENCODE_MODELS = [];
// Dead or unavailable models to exclude
const EXCLUDED_OPENCODE_MODELS = new Set(["deepseek-v4-flash-free", "big-pickle", "jev-1.13-free"]);

const ALLOWED_OPENCODE_FREE_MODELS = new Set([
  "beam-free",
  "iceman-free",
  "hy4-flash-free",
  "flint-40b-free",
  "longcat-2.5-free",
  "glm-5.3-flash-free",
  "inkling-2-small-free",
  "mimo-v2.6-flash-free",
  "deepseek-v4.1-flash-free",
  "nemotron-3.5-super-vl-free",
  "nemotron-3.5-lightning-free",
]);

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

  "opencode-free": (models) => {
    const metaMap = {
      "beam-free": { name: "Beam Free", contextLength: 1048576, supportsTools: true, supportsReasoning: true, supportsVision: false },
      "iceman-free": { name: "Iceman Free", contextLength: 262144, supportsTools: true, supportsReasoning: true, supportsVision: false },
      "hy4-flash-free": { name: "Hy4 flash Free", contextLength: 1048576, supportsTools: true, supportsReasoning: true, supportsVision: true },
      "flint-40b-free": { name: "Flint 40B Free", contextLength: 262144, supportsTools: true, supportsReasoning: true, supportsVision: false },
      "longcat-2.5-free": { name: "LongCat 2.5 Free", contextLength: 1000000, supportsTools: true, supportsReasoning: true, supportsVision: true },
      "glm-5.3-flash-free": { name: "GLM-5.3-Flash Free", supportsTools: true, supportsReasoning: true, supportsVision: true },
      "inkling-2-small-free": { name: "Inkling 2 Small Free", contextLength: 1048576, supportsTools: true, supportsReasoning: true, supportsVision: true },
      "mimo-v2.6-flash-free": { name: "MiMo-V2.6-Flash Free", contextLength: 200000, supportsTools: true, supportsReasoning: true, supportsVision: true, supportsAudio: true },
      "deepseek-v4.1-flash-free": { name: "DeepSeek V4.1 Flash Free", contextLength: 200000, supportsTools: true, supportsReasoning: true, supportsVision: true },
      "nemotron-3.5-super-vl-free": { name: "Nemotron 3.5 Super VL Free", contextLength: 1048576, supportsTools: true, supportsReasoning: true, supportsVision: true },
      "nemotron-3.5-lightning-free": { name: "Nemotron 3.5 Lightning Free", contextLength: 262144, supportsTools: true, supportsReasoning: true, supportsVision: false },
    };
    return (Array.isArray(models) ? models : [])
      .filter((m) => ALLOWED_OPENCODE_FREE_MODELS.has(m.id) && !EXCLUDED_OPENCODE_MODELS.has(m.id))
      .map((m) => ({
        id: m.id,
        name: metaMap[m.id]?.name || m.name || m.id,
        contextLength: metaMap[m.id]?.contextLength || m.context_length || 0,
        isFree: true,
        supportsTools: metaMap[m.id]?.supportsTools ?? true,
        supportsReasoning: metaMap[m.id]?.supportsReasoning ?? true,
        supportsVision: metaMap[m.id]?.supportsVision ?? false,
        supportsAudio: metaMap[m.id]?.supportsAudio ?? false,
      }));
  },

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
