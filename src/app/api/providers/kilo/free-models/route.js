import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const KILO_MODELS_URL = "https://api.kilo.ai/api/gateway/models";

export const VERIFIED_KILO_STATIC_FREE_MODELS = [
  {
    id: "kilo-auto/free",
    name: "Auto Free",
    contextLength: 256000,
    context_length: 256000,
    isFree: true,
    supportsTools: true,
    supportsReasoning: true,
    supportsVision: false,
    supportsAudio: false,
    description: "Default free auto router model on Kilo Code.",
  },
  {
    id: "reflection/beam-free",
    name: "Reflection: Beam 1.0 (free)",
    contextLength: 1048576,
    context_length: 1048576,
    isFree: true,
    supportsTools: true,
    supportsReasoning: true,
    supportsVision: false,
    supportsAudio: false,
  },
  {
    id: "minimax/minimax-m3.1-flash:free",
    name: "MiniMax: MiniMax M3.1 Flash (free)",
    contextLength: 1000000,
    context_length: 1000000,
    isFree: true,
    supportsTools: true,
    supportsReasoning: true,
    supportsVision: true,
    supportsAudio: false,
  },
  {
    id: "nvidia/nemotron-3.5-super-vl:free",
    name: "NVIDIA: Nemotron 3.5 Super VL (free)",
    contextLength: 1000000,
    context_length: 1000000,
    isFree: true,
    supportsTools: true,
    supportsReasoning: true,
    supportsVision: true,
    supportsAudio: false,
  },
  {
    id: "stealth/glyph-cluster",
    name: "Stealth: Glyph Cluster (free)",
    contextLength: 256000,
    context_length: 256000,
    isFree: true,
    supportsTools: true,
    supportsReasoning: true,
    supportsVision: false,
    supportsAudio: false,
  },
  {
    id: "openrouter/free",
    name: "OpenRouter Free Models Router",
    contextLength: 200000,
    context_length: 200000,
    isFree: true,
    supportsTools: true,
    supportsReasoning: true,
    supportsVision: true,
    supportsAudio: false,
  },
  {
    id: "liquid/lfm-2.5-2.6b:free",
    name: "LiquidAI: LFM2.5-2.6B (free)",
    contextLength: 65536,
    context_length: 65536,
    isFree: true,
    supportsTools: true,
    supportsReasoning: true,
    supportsVision: false,
    supportsAudio: false,
  },
  {
    id: "poolside/laguna-s-2.1:free",
    name: "Poolside: Laguna S 2.1 (free)",
    contextLength: 262144,
    context_length: 262144,
    isFree: true,
    supportsTools: true,
    supportsReasoning: true,
    supportsVision: false,
    supportsAudio: false,
  },
  {
    id: "poolside/laguna-xs-2.1:free",
    name: "Poolside: Laguna XS 2.1 (free)",
    contextLength: 262144,
    context_length: 262144,
    isFree: true,
    supportsTools: true,
    supportsReasoning: true,
    supportsVision: false,
    supportsAudio: false,
  },
  {
    id: "cohere/north-mini-code:free",
    name: "Cohere: North Mini Code (free)",
    contextLength: 256000,
    context_length: 256000,
    isFree: true,
    supportsTools: true,
    supportsReasoning: true,
    supportsVision: false,
    supportsAudio: false,
  },
  {
    id: "xingchen-agi/xing4.0-29b-a4b:free",
    name: "XingChen: Xing4.0 29B A4B (free)",
    contextLength: 262144,
    context_length: 262144,
    isFree: true,
    supportsTools: true,
    supportsReasoning: true,
    supportsVision: false,
    supportsAudio: false,
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    name: "NVIDIA: Nemotron 3 Ultra (free)",
    contextLength: 1000000,
    context_length: 1000000,
    isFree: true,
    supportsTools: true,
    supportsReasoning: true,
    supportsVision: false,
    supportsAudio: false,
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    name: "NVIDIA: Nemotron 3 Super (free)",
    contextLength: 262144,
    context_length: 262144,
    isFree: true,
    supportsTools: true,
    supportsReasoning: true,
    supportsVision: false,
    supportsAudio: false,
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    name: "NVIDIA: Nemotron 3.5 Lightning (free)",
    contextLength: 1000000,
    context_length: 1000000,
    isFree: true,
    supportsTools: true,
    supportsReasoning: true,
    supportsVision: false,
    supportsAudio: false,
  },
  {
    id: "dots-studio/dots-3-note-preview:free",
    name: "Dots Studio: Dots3-Note Preview (free)",
    contextLength: 512000,
    context_length: 512000,
    isFree: true,
    supportsTools: true,
    supportsReasoning: true,
    supportsVision: true,
    supportsAudio: false,
  },
  {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    name: "NVIDIA: Nemotron 3 Nano Omni (free)",
    contextLength: 256000,
    context_length: 256000,
    isFree: true,
    supportsTools: true,
    supportsReasoning: true,
    supportsVision: true,
    supportsAudio: true,
  },
  {
    id: "nvidia/nemotron-3.5-content-safety:free",
    name: "NVIDIA: Nemotron 3.5 Content Safety (free)",
    contextLength: 128000,
    context_length: 128000,
    isFree: true,
    supportsTools: true,
    supportsReasoning: true,
    supportsVision: true,
    supportsAudio: false,
  },
];

// NOTE: In-memory cache is maintained per Node.js process instance and resets
// upon process restart. It is not shared across multiple cluster/serverless instances.
let cachedModels = null;
let cacheTimestamp = 0;
let inFlightPromise = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes

export function _resetKiloModelsCache() {
  cachedModels = null;
  cacheTimestamp = 0;
  inFlightPromise = null;
}

export function parseKiloFreeModels(allModels) {
  if (!Array.isArray(allModels)) return [];
  const seen = new Set();
  const freeModels = [];

  for (const m of allModels) {
    if (!m?.id || seen.has(m.id)) continue;
    const isFree =
      m.isFree === true ||
      (m.pricing?.prompt !== undefined &&
        Number(m.pricing.prompt) === 0 &&
        Number(m.pricing.completion) === 0);

    if (isFree) {
      seen.add(m.id);
      const modalities = m.architecture?.input_modalities || [];
      const supportedParams = m.supported_parameters || [];
      const contextLen = m.context_length || 0;

      freeModels.push({
        id: m.id,
        name: m.name || m.id,
        isFree: true,
        contextLength: contextLen,
        context_length: contextLen,
        description: m.description || "",
        supportsTools: Boolean(supportedParams.includes("tools")),
        supportsReasoning: Boolean(
          supportedParams.includes("reasoning") ||
          supportedParams.includes("include_reasoning")
        ),
        supportsVision: Boolean(modalities.includes("image")),
        supportsAudio: Boolean(modalities.includes("audio")),
      });
    }
  }

  return freeModels;
}

async function fetchKiloModelsUpstream() {
  const res = await fetch(KILO_MODELS_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Kilo API returned ${res.status}`);
  }

  const json = await res.json();
  const rawList = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
  return parseKiloFreeModels(rawList);
}

export async function GET(request) {
  const url = request ? new URL(request.url) : null;
  const forceRefresh = url?.searchParams?.get("refresh") === "true" || url?.searchParams?.get("force") === "true";
  const now = Date.now();

  // Return cached result if still valid and force refresh was not requested
  if (!forceRefresh && cachedModels && now - cacheTimestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      source: "cached",
      models: cachedModels,
      cached: true,
      stale: false,
      fallback: false,
      cachedAt: new Date(cacheTimestamp).toISOString(),
      ttlMs: CACHE_TTL_MS,
      count: cachedModels.length,
    });
  }

  // Deduplicate concurrent in-flight requests
  let fetchError = null;
  let parsed = null;

  try {
    if (!inFlightPromise) {
      inFlightPromise = fetchKiloModelsUpstream();
    }
    parsed = await inFlightPromise;
  } catch (err) {
    fetchError = err;
  } finally {
    inFlightPromise = null;
  }

  // Success path: upstream returned live models
  if (parsed && parsed.length > 0) {
    cachedModels = parsed;
    cacheTimestamp = now;
    return NextResponse.json({
      source: "live",
      models: parsed,
      cached: false,
      stale: false,
      fallback: false,
      cachedAt: new Date(now).toISOString(),
      ttlMs: CACHE_TTL_MS,
      count: parsed.length,
    });
  }

  // Fallback 1: Return last-known-good cache if available (even if expired)
  if (cachedModels?.length) {
    const isStale = now - cacheTimestamp >= CACHE_TTL_MS;
    return NextResponse.json({
      source: isStale ? "stale" : "cached",
      models: cachedModels,
      cached: true,
      stale: isStale,
      fallback: false,
      cachedAt: new Date(cacheTimestamp).toISOString(),
      ttlMs: CACHE_TTL_MS,
      warning: fetchError?.message || "Upstream returned no free models; using last-known-good cache",
      count: cachedModels.length,
    });
  }

  // Fallback 2: Initial startup fallback to verified static catalog
  return NextResponse.json({
    source: "static_fallback",
    models: VERIFIED_KILO_STATIC_FREE_MODELS,
    cached: false,
    stale: false,
    fallback: true,
    warning: fetchError?.message || "Upstream returned no free models; using verified static list",
    count: VERIFIED_KILO_STATIC_FREE_MODELS.length,
  });
}
