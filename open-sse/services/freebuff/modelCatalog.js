/**
 * Freebuff Model Catalog
 * Maps ToolNet model IDs (freebuff/<model>) to verified Freebuff models and their TUI picker representations.
 */

export const FREEBUFF_CATALOG = [
  {
    id: "solar-pro-4",
    name: "Solar Pro 4",
    tuiName: "Solar Pro 4",
    aliases: ["solar-pro4", "solar-pro"],
    contextLength: 500000,
    effectiveContextLength: 500000,
    upstreamMaxOutputTokens: null,
    effectiveMaxOutputTokens: null,
    defaultOutputReserveTokens: 4096,
    contextPruningBudget: { baseChat: 200000, base2: 400000 },
    supportsStreaming: true,
    supportsTools: false,
    availabilityStatus: "available",
    source: "CodebuffAI/freebuff/common/src/constants/freebuff-models.ts",
    verifiedAt: "2026-10-10",
  },
  {
    id: "glm-5.3-flash",
    name: "GLM 5.3 Flash",
    tuiName: "GLM 5.3 Flash",
    aliases: ["glm-5.3"],
    contextLength: 131072,
    effectiveContextLength: 131072,
    upstreamMaxOutputTokens: null,
    effectiveMaxOutputTokens: null,
    defaultOutputReserveTokens: 4096,
    contextPruningBudget: { baseChat: 52428, base2: 400000 },
    supportsStreaming: true,
    supportsTools: false,
    availabilityStatus: "available",
    source: "fallback",
    verifiedAt: "2026-10-10",
  },
  {
    id: "mimo-v2.5",
    name: "MiMo 2.5",
    tuiName: "MiMo 2.5",
    aliases: ["mimo-2.5", "mimo"],
    contextLength: 131072,
    effectiveContextLength: 131072,
    upstreamMaxOutputTokens: null,
    effectiveMaxOutputTokens: null,
    defaultOutputReserveTokens: 4096,
    contextPruningBudget: { baseChat: 52428, base2: 400000 },
    supportsStreaming: true,
    supportsTools: false,
    availabilityStatus: "available",
    source: "fallback",
    verifiedAt: "2026-10-10",
  },
  {
    id: "deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    tuiName: "DeepSeek V4 Flash",
    aliases: ["deepseek-v4-flash-0731", "deepseek-v4"],
    contextLength: 1048576,
    effectiveContextLength: 1048576,
    upstreamMaxOutputTokens: null,
    effectiveMaxOutputTokens: null,
    defaultOutputReserveTokens: 4096,
    contextPruningBudget: { baseChat: 419430, base2: 400000 },
    supportsStreaming: true,
    supportsTools: false,
    availabilityStatus: "available",
    source: "CodebuffAI/freebuff/agents/base-chat.ts",
    verifiedAt: "2026-10-10",
  },
  {
    id: "deepseek-v4.1-flash",
    name: "DeepSeek V4.1 Flash",
    tuiName: "DeepSeek V4.1 Flash",
    aliases: ["deepseek-v4-1-flash", "deepseek-v4.1"],
    contextLength: 1048576,
    effectiveContextLength: 1048576,
    upstreamMaxOutputTokens: null,
    effectiveMaxOutputTokens: null,
    defaultOutputReserveTokens: 4096,
    contextPruningBudget: { baseChat: 419430, base2: 400000 },
    supportsStreaming: true,
    supportsTools: false,
    availabilityStatus: "available",
    source: "fallback",
    verifiedAt: "2026-10-10",
  },
  {
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    tuiName: "DeepSeek V4 Pro",
    aliases: [],
    contextLength: 1048576,
    effectiveContextLength: 1048576,
    upstreamMaxOutputTokens: null,
    effectiveMaxOutputTokens: null,
    defaultOutputReserveTokens: 4096,
    contextPruningBudget: { baseChat: 419430, base2: 400000 },
    supportsStreaming: true,
    supportsTools: false,
    availabilityStatus: "paused",
    source: "CodebuffAI/freebuff/agents/base-chat.ts",
    verifiedAt: "2026-10-10",
  },
  {
    id: "mimo-v2.5-pro",
    name: "MiMo 2.5 Pro",
    tuiName: "MiMo 2.5 Pro",
    aliases: ["mimo-2.5-pro"],
    contextLength: 131072,
    effectiveContextLength: 131072,
    upstreamMaxOutputTokens: null,
    effectiveMaxOutputTokens: null,
    defaultOutputReserveTokens: 4096,
    contextPruningBudget: { baseChat: 52428, base2: 400000 },
    supportsStreaming: true,
    supportsTools: false,
    availabilityStatus: "available",
    source: "fallback",
    verifiedAt: "2026-10-10",
  },
  {
    id: "glm-5.2",
    name: "GLM 5.2",
    tuiName: "GLM 5.2",
    aliases: [],
    contextLength: 131072,
    effectiveContextLength: 131072,
    upstreamMaxOutputTokens: null,
    effectiveMaxOutputTokens: null,
    defaultOutputReserveTokens: 4096,
    contextPruningBudget: { baseChat: 52428, base2: 400000 },
    supportsStreaming: true,
    supportsTools: false,
    availabilityStatus: "available",
    source: "fallback",
    verifiedAt: "2026-10-10",
  },
  {
    id: "gpt-5.6-luna",
    name: "GPT 5.6 Luna",
    tuiName: "GPT 5.6 Luna",
    aliases: ["gpt-5.6"],
    contextLength: 1050000,
    effectiveContextLength: 1000000,
    upstreamMaxOutputTokens: null,
    effectiveMaxOutputTokens: null,
    defaultOutputReserveTokens: 4096,
    contextPruningBudget: { baseChat: 400000, base2: 400000 },
    supportsStreaming: true,
    supportsTools: false,
    availabilityStatus: "paused",
    source: "CodebuffAI/freebuff/agents/base-chat.ts",
    verifiedAt: "2026-10-10",
  },
  {
    id: "minimax-m3",
    name: "MiniMax M3",
    tuiName: "MiniMax M3",
    aliases: ["minimax"],
    contextLength: 524288,
    effectiveContextLength: 524288,
    upstreamMaxOutputTokens: null,
    effectiveMaxOutputTokens: null,
    defaultOutputReserveTokens: 4096,
    contextPruningBudget: { baseChat: 209715, base2: 400000 },
    supportsStreaming: true,
    supportsTools: false,
    availabilityStatus: "paused",
    source: "CodebuffAI/freebuff/agents/base-chat.ts",
    verifiedAt: "2026-10-10",
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    tuiName: "Gemini 3.8 Flash",
    aliases: ["gemini-3.8"],
    contextLength: 1000000,
    effectiveContextLength: 1000000,
    upstreamMaxOutputTokens: null,
    effectiveMaxOutputTokens: null,
    defaultOutputReserveTokens: 4096,
    contextPruningBudget: { baseChat: 400000, base2: 400000 },
    supportsStreaming: true,
    supportsTools: false,
    availabilityStatus: "available",
    source: "CodebuffAI/freebuff/common/src/constants/freebuff-models.ts",
    verifiedAt: "2026-10-10",
  },
  {
    id: "ox-alpha",
    name: "OX Alpha",
    tuiName: "OX Alpha",
    aliases: [],
    contextLength: 1048576,
    effectiveContextLength: 1000000,
    upstreamMaxOutputTokens: null,
    effectiveMaxOutputTokens: null,
    defaultOutputReserveTokens: 4096,
    contextPruningBudget: { baseChat: 400000, base2: 400000 },
    supportsStreaming: true,
    supportsTools: false,
    availabilityStatus: "available",
    source: "CodebuffAI/freebuff/common/src/constants/freebuff-models.ts",
    verifiedAt: "2026-10-10",
  },
  {
    id: "claude-fable-5",
    name: "Claude Fable 5",
    tuiName: "Claude Fable 5",
    aliases: [],
    contextLength: 200000,
    effectiveContextLength: 200000,
    upstreamMaxOutputTokens: null,
    effectiveMaxOutputTokens: null,
    defaultOutputReserveTokens: 4096,
    contextPruningBudget: { baseChat: 80000, base2: 400000 },
    supportsStreaming: true,
    supportsTools: false,
    availabilityStatus: "available",
    source: "fallback",
    verifiedAt: "2026-10-10",
  },
  {
    id: "kimi-k3-eco",
    name: "Kimi K3 Eco",
    tuiName: "Kimi K3 Eco",
    aliases: ["kimi-k3"],
    contextLength: 262144,
    effectiveContextLength: 262144,
    upstreamMaxOutputTokens: null,
    effectiveMaxOutputTokens: null,
    defaultOutputReserveTokens: 4096,
    contextPruningBudget: { baseChat: 104857, base2: 250000 },
    supportsStreaming: true,
    supportsTools: false,
    availabilityStatus: "available",
    source: "fallback",
    verifiedAt: "2026-10-10",
  }
];

export function calculateAvailableInputTokens(modelId, messages, tools, options = {}) {
  const model = FREEBUFF_CATALOG.find(m => m.id === modelId) || FREEBUFF_CATALOG.find(m => m.id === "solar-pro-4");
  // Default to base2 agent budget since ToolNetAPI uses Freebuff CLI
  const agentType = options.agentType || "base2";
  let budget = typeof model.contextPruningBudget === "object" ? model.contextPruningBudget[agentType] : model.contextPruningBudget;
  if (budget == null) budget = 131072;
  
  // Overhead (system prompt assumed size in base2/CLI + JSON framing)
  const systemOverhead = 2000;
  
  // Estimate ~4 chars per token, avoid double-counting
  let messagesTokens = 0;
  for (const m of messages) {
    // Only count content strings (ToolNetAPI might flatten tool calls or array contents)
    let contentStr = "";
    if (typeof m.content === "string") {
      contentStr = m.content;
    } else if (Array.isArray(m.content)) {
      contentStr = m.content.map(p => p.text || "").join("\n");
    }
    messagesTokens += Math.ceil((contentStr.length) / 4);
    messagesTokens += 5; // Role overhead
  }
  
  let toolsTokens = 0;
  if (tools && tools.length > 0) {
    toolsTokens += Math.ceil(JSON.stringify(tools).length / 4);
  }
  
  const tokensUsed = systemOverhead + messagesTokens + toolsTokens;
  const remaining = budget - tokensUsed - model.defaultOutputReserveTokens;
  
  return {
    isEstimated: true,
    budget,
    tokensUsed,
    remaining: Math.max(0, remaining),
    modelId: model.id,
    agentType
  };
}

export function normalizeFreebuffModelId(rawId) {
  if (!rawId || typeof rawId !== "string") return "solar-pro-4";
  let cleaned = rawId.trim().toLowerCase();
  if (cleaned.startsWith("freebuff/")) {
    cleaned = cleaned.slice("freebuff/".length);
  } else if (cleaned.startsWith("fb/")) {
    cleaned = cleaned.slice("fb/".length);
  }

  for (const entry of FREEBUFF_CATALOG) {
    if (entry.id === cleaned) return entry.id;
    if (entry.aliases.includes(cleaned)) return entry.id;
  }

  return cleaned;
}

export function findModelByTuiName(tuiLine) {
  if (!tuiLine || typeof tuiLine !== "string") return null;
  const lower = tuiLine.toLowerCase();
  for (const entry of FREEBUFF_CATALOG) {
    if (lower.includes(entry.tuiName.toLowerCase())) return entry;
    for (const a of entry.aliases) {
      if (lower.includes(a.toLowerCase())) return entry;
    }
  }
  return null;
}

/**
 * Reduce a string to lowercase alphanumerics only, so punctuation/spacing and
 * the TUI's reasoning tags ("• high") don't break matching. "DeepSeek V4.1
 * Flash • high" and "deepseek-v4.1-flash" both collapse to "deepseekv41flash…".
 */
export function normalizeModelForMatch(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function getTuiMatcherForModel(modelId) {
  const norm = normalizeFreebuffModelId(modelId);
  const entry = FREEBUFF_CATALOG.find((e) => e.id === norm);
  const candidates = entry
    ? [entry.tuiName, entry.name, entry.id, ...(entry.aliases || [])]
    : [norm];
  const keys = candidates.map(normalizeModelForMatch).filter(Boolean);
  return (line) => {
    const haystack = normalizeModelForMatch(line);
    return keys.some((key) => haystack.includes(key));
  };
}
