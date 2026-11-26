import { getCapabilitiesForModel } from "../providers/capabilities.js";

const CAPABILITY_KEYS = ["vision", "pdf", "audioInput", "videoInput"];
const HARD_CAPS = new Set(CAPABILITY_KEYS);

export const DEFAULT_CAPACITY_ADAPTER = {
  vision: { enabled: true, roundRobin: false, models: [] },
  audioInput: { enabled: true, roundRobin: false, models: [] },
  pdf: { enabled: false, roundRobin: false, models: [] },
  videoInput: { enabled: false, roundRobin: false, models: [] },
};

const DEFAULT_FALLBACK_MODELS = {
  vision: ["oc/mimo-v2.5-free"],
  audioInput: ["oc/mimo-v2.5-free"],
  pdf: [],
  videoInput: [],
};

function normalizeCapEntry(entry, defaultEnabled = false) {
  if (Array.isArray(entry)) {
    return { enabled: true, roundRobin: false, models: entry.map((e) => e?.model || e).filter(Boolean) };
  }
  if (entry && typeof entry === "object") {
    return {
      enabled: entry.enabled !== undefined ? entry.enabled !== false : defaultEnabled,
      roundRobin: !!entry.roundRobin,
      models: Array.isArray(entry.models) ? entry.models.filter(Boolean) : [],
    };
  }
  return { enabled: defaultEnabled, roundRobin: false, models: [] };
}

export function getCapacityAdapterConfig(cap, settings) {
  const defEntry = DEFAULT_CAPACITY_ADAPTER[cap] || { enabled: false, roundRobin: false, models: [] };
  const entry = normalizeCapEntry(settings?.capacityAdapter?.[cap], defEntry.enabled);
  if (entry.enabled && entry.models.length === 0) {
    const fallback = DEFAULT_FALLBACK_MODELS[cap] || [];
    return { ...entry, models: fallback };
  }
  return entry;
}

export function getCapacityAdapterModels(settings, filterCaps = null) {
  const seen = new Set();
  const models = [];
  const targetCaps = filterCaps ? [...filterCaps].filter((c) => CAPABILITY_KEYS.includes(c)) : CAPABILITY_KEYS;
  for (const cap of targetCaps) {
    const { enabled, models: pool } = getCapacityAdapterConfig(cap, settings);
    if (!enabled) continue;
    for (const m of pool) {
      if (!seen.has(m)) {
        seen.add(m);
        models.push(m);
      }
    }
  }
  return models;
}

export function getCapacityAdapterStrategy(cap, settings) {
  const { enabled, roundRobin } = getCapacityAdapterConfig(cap, settings);
  return enabled && roundRobin ? "round-robin" : "fallback";
}

export function getActiveAdapterStrategy(requiredCapabilities, settings) {
  const hard = [...(requiredCapabilities || [])].filter((c) => HARD_CAPS.has(c));
  for (const cap of hard) {
    const { enabled, models } = getCapacityAdapterConfig(cap, settings);
    if (!enabled || models.length === 0) continue;
    return getCapacityAdapterStrategy(cap, settings);
  }
  return "fallback";
}

function modelSatisfies(modelStr, requiredHard) {
  const slash = modelStr.indexOf("/");
  const provider = slash > 0 ? modelStr.slice(0, slash) : "";
  const model = slash > 0 ? modelStr.slice(slash + 1) : modelStr;
  const caps = getCapabilitiesForModel(provider, model);
  return requiredHard.every((c) => caps[c] === true);
}

export function augmentModelsWithCapacityAdapter(models, requiredCapabilities, settings) {
  const hard = [...(requiredCapabilities || [])].filter((c) => HARD_CAPS.has(c));
  if (hard.length === 0 || !Array.isArray(models) || models.length === 0) return models;
  if (models.some((m) => modelSatisfies(m, hard))) return models;

  const pool = getCapacityAdapterModels(settings, hard).filter((m) => !models.includes(m) && modelSatisfies(m, hard));
  if (pool.length === 0) return models;
  return [...pool, ...models];
}

const CHARS_PER_TOKEN = 4;
const HEAD_KEEP = 6;

function blockLength(content) {
  if (typeof content === "string") return content.length;
  if (Array.isArray(content)) {
    return content.reduce((sum, b) => sum + (typeof b?.text === "string" ? b.text.length : 50), 0);
  }
  return 0;
}

export function stripHistoryForContext(body, contextWindow) {
  const key = Array.isArray(body.messages) ? "messages"
    : Array.isArray(body.input) ? "input"
    : Array.isArray(body.contents) ? "contents"
    : null;
  if (!key) return body;
  const arr = body[key];
  if (!arr || arr.length === 0) return body;

  const isSystem = (r) => r === "system" || r === "developer";
  const systemMsgs = arr.filter((m) => isSystem(m?.role));
  const rest = arr.filter((m) => !isSystem(m?.role));
  if (rest.length === 0) return body;

  const isAssistant = (r) => r === "assistant" || r === "model";
  let i = rest.length - 1;
  while (i >= 0 && !isAssistant(rest[i]?.role)) i--;
  const tail = rest.slice(i + 1);
  const older = rest.slice(0, i + 1);
  if (older.length === 0) return body;

  const contentOf = (m) => m.content ?? m.parts;
  const budgetChars = (contextWindow || 200000) * 0.8 * CHARS_PER_TOKEN;

  const headKept = older.slice(0, HEAD_KEEP);
  let total = systemMsgs.concat(headKept, tail).reduce((s, m) => s + blockLength(contentOf(m)), 0);

  let head = headKept;
  while (total > budgetChars && head.length > 0) {
    const dropped = head.pop();
    total -= blockLength(contentOf(dropped));
  }

  if (head.length === older.length) return body;
  return { ...body, [key]: [...systemMsgs, ...head, ...tail] };
}

export function withCapacityAdapterStripping(handleSingleModel, adapterModels) {
  const adapterSet = new Set(adapterModels);
  if (adapterSet.size === 0) return handleSingleModel;
  return (body, modelStr, ...rest) => {
    if (adapterSet.has(modelStr)) {
      const slash = modelStr.indexOf("/");
      const provider = slash > 0 ? modelStr.slice(0, slash) : "";
      const model = slash > 0 ? modelStr.slice(slash + 1) : modelStr;
      const { contextWindow } = getCapabilitiesForModel(provider, model);
      body = stripHistoryForContext(body, contextWindow);
    }
    return handleSingleModel(body, modelStr, ...rest);
  };
}
