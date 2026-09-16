import { proxyAwareFetch } from "../utils/proxyFetch.js";
import { normalizeGroqModelId } from "./groqNormalize.js";

export { normalizeGroqModelId };

export const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models";
export const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const FETCH_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache (10-30 min requirement)

export const PREFERRED_HEALTH_CHECK_MODELS = [
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
];

export const STATIC_GROQ_MODELS = [
  {
    id: "qwen/qwen3.8-27b",
    name: "Qwen 3.8 27B",
    contextLength: 131042,
    maxOutputTokens: 16384,
    supportsTools: true,
    supportsVision: true,
    supportsReasoning: true,
    supportsStreaming: true,
    isFree: true,
  },
  {
    id: "openai/gpt-oss-20b",
    name: "GPT OSS 20B",
    contextLength: 131072,
    maxOutputTokens: 65536,
    supportsTools: true,
    supportsVision: false,
    supportsReasoning: true,
    supportsStreaming: true,
    isFree: true,
  },
  {
    id: "openai/gpt-oss-120b",
    name: "GPT OSS 120B",
    contextLength: 131072,
    maxOutputTokens: 65536,
    supportsTools: true,
    supportsVision: false,
    supportsReasoning: true,
    supportsStreaming: true,
    isFree: true,
  },
  {
    id: "openai/gpt-oss-safeguard-20b",
    name: "Safety GPT OSS 20B",
    contextLength: 131072,
    maxOutputTokens: 65536,
    supportsTools: true,
    supportsVision: false,
    supportsReasoning: true,
    supportsStreaming: true,
    isFree: true,
  },
  {
    id: "groq/compound",
    name: "Compound",
    upstreamModelId: "groq/compound",
    contextLength: 131072,
    maxOutputTokens: 8192,
    supportsTools: false,
    supportsVision: false,
    supportsReasoning: false,
    supportsStreaming: true,
    isFree: true,
  },
  {
    id: "compound",
    name: "Compound",
    upstreamModelId: "groq/compound",
    contextLength: 131072,
    maxOutputTokens: 8192,
    supportsTools: false,
    supportsVision: false,
    supportsReasoning: false,
    supportsStreaming: true,
    isFree: true,
  },
  {
    id: "groq/compound-mini",
    name: "Compound Mini",
    upstreamModelId: "groq/compound-mini",
    contextLength: 131072,
    maxOutputTokens: 8192,
    supportsTools: false,
    supportsVision: false,
    supportsReasoning: false,
    supportsStreaming: true,
    isFree: true,
  },
  {
    id: "compound-mini",
    name: "Compound Mini",
    upstreamModelId: "groq/compound-mini",
    contextLength: 131072,
    maxOutputTokens: 8192,
    supportsTools: false,
    supportsVision: false,
    supportsReasoning: false,
    supportsStreaming: true,
    isFree: true,
  },
  {
    id: "allam-2-7b",
    name: "ALLaM-2 7B",
    contextLength: 4096,
    maxOutputTokens: 4096,
    supportsTools: false,
    supportsVision: false,
    supportsReasoning: false,
    supportsStreaming: true,
    isFree: true,
  },
  {
    id: "meta-llama/llama-prompt-guard-2-86m",
    name: "Prompt Guard 2 86M",
    contextLength: 512,
    maxOutputTokens: 512,
    supportsTools: false,
    supportsVision: false,
    supportsReasoning: false,
    supportsStreaming: false,
    isFree: true,
  },
  {
    id: "meta-llama/llama-prompt-guard-2-22m",
    name: "Prompt Guard 2 22M",
    contextLength: 512,
    maxOutputTokens: 512,
    supportsTools: false,
    supportsVision: false,
    supportsReasoning: false,
    supportsStreaming: false,
    isFree: true,
  },
  {
    id: "canopylabs/orpheus-v1-english",
    name: "Orpheus v1 English",
    kind: "tts",
    supportsTools: false,
    supportsVision: false,
    supportsReasoning: false,
    supportsStreaming: true,
    isFree: true,
  },
  {
    id: "canopylabs/orpheus-arabic-saudi",
    name: "Orpheus Arabic Saudi",
    kind: "tts",
    supportsTools: false,
    supportsVision: false,
    supportsReasoning: false,
    supportsStreaming: true,
    isFree: true,
  },
  {
    id: "whisper-large-v3",
    name: "Whisper Large v3",
    params: ["language", "response_format", "temperature", "prompt"],
    kind: "stt",
    supportsTools: false,
    supportsVision: false,
    supportsReasoning: false,
    supportsStreaming: false,
    isFree: true,
  },
  {
    id: "whisper-large-v3-turbo",
    name: "Whisper Large v3 Turbo",
    params: ["language", "response_format", "temperature", "prompt"],
    kind: "stt",
    supportsTools: false,
    supportsVision: false,
    supportsReasoning: false,
    supportsStreaming: false,
    isFree: true,
  },
];

export const GROQ_KNOWN_CAPABILITIES = {
  "qwen/qwen3.8-27b": {
    supportsTools: true,
    supportsVision: true,
    supportsReasoning: true,
    contextLength: 131042,
    maxOutputTokens: 16384,
    kind: "llm",
  },
  "openai/gpt-oss-20b": {
    supportsTools: true,
    supportsVision: false,
    supportsReasoning: true,
    contextLength: 131072,
    maxOutputTokens: 65536,
    kind: "llm",
  },
  "openai/gpt-oss-120b": {
    supportsTools: true,
    supportsVision: false,
    supportsReasoning: true,
    contextLength: 131072,
    maxOutputTokens: 65536,
    kind: "llm",
  },
  "openai/gpt-oss-safeguard-20b": {
    supportsTools: true,
    supportsVision: false,
    supportsReasoning: true,
    contextLength: 131072,
    maxOutputTokens: 65536,
    kind: "llm",
  },
  "groq/compound": {
    supportsTools: false,
    supportsVision: false,
    supportsReasoning: false,
    contextLength: 131072,
    maxOutputTokens: 8192,
    kind: "llm",
  },
  "groq/compound-mini": {
    supportsTools: false,
    supportsVision: false,
    supportsReasoning: false,
    contextLength: 131072,
    maxOutputTokens: 8192,
    kind: "llm",
  },
  "allam-2-7b": {
    supportsTools: false,
    supportsVision: false,
    supportsReasoning: false,
    contextLength: 4096,
    maxOutputTokens: 4096,
    kind: "llm",
  },
  "meta-llama/llama-prompt-guard-2-86m": {
    supportsTools: false,
    supportsVision: false,
    supportsReasoning: false,
    contextLength: 512,
    maxOutputTokens: 512,
    kind: "llm",
  },
  "meta-llama/llama-prompt-guard-2-22m": {
    supportsTools: false,
    supportsVision: false,
    supportsReasoning: false,
    contextLength: 512,
    maxOutputTokens: 512,
    kind: "llm",
  },
  "canopylabs/orpheus-v1-english": {
    supportsTools: false,
    supportsVision: false,
    supportsReasoning: false,
    kind: "tts",
  },
  "canopylabs/orpheus-arabic-saudi": {
    supportsTools: false,
    supportsVision: false,
    supportsReasoning: false,
    kind: "tts",
  },
  "whisper-large-v3": {
    supportsTools: false,
    supportsVision: false,
    supportsReasoning: false,
    kind: "stt",
  },
  "whisper-large-v3-turbo": {
    supportsTools: false,
    supportsVision: false,
    supportsReasoning: false,
    kind: "stt",
  },
};

const groqCatalogCache = new Map();

export function selectGroqHealthCheckModel(availableModels = []) {
  if (!Array.isArray(availableModels) || availableModels.length === 0) {
    return PREFERRED_HEALTH_CHECK_MODELS[0];
  }

  const modelIds = new Set(availableModels.map((m) => m.id || m));

  for (const preferred of PREFERRED_HEALTH_CHECK_MODELS) {
    if (modelIds.has(preferred)) {
      return preferred;
    }
  }

  // Fallback to any valid text/chat model
  const fallback = availableModels.find((m) => {
    const id = m.id || m;
    if (typeof id !== "string") return false;
    const isSpecial = id.startsWith("whisper") || id.startsWith("canopylabs/") || id.includes("prompt-guard");
    return !isSpecial;
  });

  return fallback?.id || fallback || availableModels[0]?.id || availableModels[0] || PREFERRED_HEALTH_CHECK_MODELS[0];
}

function inferGroqModelKind(inputModalities = [], outputModalities = []) {
  if (outputModalities.includes("transcription") || inputModalities.includes("audio")) {
    return "stt";
  }
  if (outputModalities.includes("speech")) {
    return "tts";
  }
  if (inputModalities.includes("image")) {
    return "imageToText";
  }
  return "llm";
}

export function normalizeGroqModel(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = raw.id;
  if (!id) return null;

  const known = GROQ_KNOWN_CAPABILITIES[id] || {};
  const inMods = Array.isArray(raw.input_modalities) ? raw.input_modalities : [];
  const outMods = Array.isArray(raw.output_modalities) ? raw.output_modalities : [];

  const kind = known.kind || inferGroqModelKind(inMods, outMods);
  const contextLength = raw.context_window || known.contextLength || 4096;
  const maxOutputTokens = raw.max_output_tokens || known.maxOutputTokens || Math.min(contextLength, 16384);

  const supportsVision = known.supportsVision ?? inMods.includes("image");
  const supportsTools = known.supportsTools ?? (kind === "llm" && !id.includes("prompt-guard") && !id.startsWith("allam"));
  const supportsReasoning = known.supportsReasoning ?? (id.includes("gpt-oss") || id.includes("qwen"));

  return {
    id,
    name: raw.name || raw.display_name || id,
    contextLength,
    maxOutputTokens,
    supportsTools,
    supportsVision,
    supportsReasoning,
    supportsStreaming: kind !== "stt",
    kind,
    isFree: true,
    active: raw.active !== false,
  };
}

export function toToolNetUnifiedModel(item) {
  const id = item.id;
  const known = GROQ_KNOWN_CAPABILITIES[id] || {};

  const contextWindow = item.contextLength || known.contextLength || 131072;
  const maxOutputTokens = item.maxOutputTokens || known.maxOutputTokens || 16384;
  const supportsVision = item.supportsVision ?? known.supportsVision ?? false;
  const supportsTools = item.supportsTools ?? known.supportsTools ?? true;
  const supportsReasoning = item.supportsReasoning ?? known.supportsReasoning ?? false;

  return {
    id,
    object: "model",
    created: item.created || Math.floor(Date.now() / 1000),
    owned_by: "groq",
    permission: [],
    root: id,
    parent: null,
    provider: "groq",
    context_window: contextWindow,
    max_output_tokens: maxOutputTokens,
    isFree: true,
    capabilities: {
      vision: supportsVision,
      tools: supportsTools,
      reasoning: supportsReasoning,
      streaming: item.supportsStreaming !== false,
      contextWindow,
      ...(maxOutputTokens ? { maxOutput: maxOutputTokens } : {}),
      ...(supportsReasoning ? { thinkingFormat: "openai" } : {}),
    },
    ...(item.pricing ? { pricing: item.pricing } : {}),
  };
}

function getCacheKey(apiKey, proxyUrl = "") {
  let hash = 0;
  const str = `${apiKey}:${proxyUrl}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return `groq:${Math.abs(hash)}`;
}

export async function resolveGroqModels(credentials, options = {}) {
  const apiKey = credentials?.apiKey || credentials?.accessToken;
  const proxyOptions = options.proxyOptions || null;
  const key = apiKey ? getCacheKey(apiKey, proxyOptions?.connectionProxyUrl || "") : "groq:default";

  const cached = groqCatalogCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { models: cached.models, cached: true };
  }

  if (!apiKey) {
    return { models: STATIC_GROQ_MODELS, cached: false, warning: "No Groq API key provided; using static catalog." };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;

    const res = await proxyAwareFetch(GROQ_MODELS_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "ToolNetAPI/1.0.0",
      },
      signal,
    }, proxyOptions);

    clearTimeout(timeout);

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      const warning = `Groq API returned HTTP ${res.status}: ${errorText.slice(0, 100)}`;
      options.log?.warn?.("GROQ", warning);
      return { models: STATIC_GROQ_MODELS, warning };
    }

    const json = await res.json();
    const rawList = Array.isArray(json?.data) ? json.data : [];

    const parsedModels = rawList
      .map(normalizeGroqModel)
      .filter(Boolean)
      .filter((m) => m.active);

    if (parsedModels.length === 0) {
      return { models: STATIC_GROQ_MODELS, warning: "Groq API returned no active models; using static catalog." };
    }

    const hasGroqCompound = parsedModels.some((m) => m.id === "groq/compound");
    const hasPlainCompound = parsedModels.some((m) => m.id === "compound");
    if (hasGroqCompound && !hasPlainCompound) {
      const compoundObj = parsedModels.find((m) => m.id === "groq/compound");
      parsedModels.push({
        ...compoundObj,
        id: "compound",
        upstreamModelId: "groq/compound",
      });
    }

    const hasGroqCompoundMini = parsedModels.some((m) => m.id === "groq/compound-mini");
    const hasPlainCompoundMini = parsedModels.some((m) => m.id === "compound-mini");
    if (hasGroqCompoundMini && !hasPlainCompoundMini) {
      const compoundMiniObj = parsedModels.find((m) => m.id === "groq/compound-mini");
      parsedModels.push({
        ...compoundMiniObj,
        id: "compound-mini",
        upstreamModelId: "groq/compound-mini",
      });
    }

    groqCatalogCache.set(key, {
      models: parsedModels,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return { models: parsedModels, cached: false };
  } catch (err) {
    const warning = `Failed to fetch dynamic Groq models: ${err.message}; using static catalog.`;
    options.log?.warn?.("GROQ", warning);
    return { models: STATIC_GROQ_MODELS, warning };
  }
}
