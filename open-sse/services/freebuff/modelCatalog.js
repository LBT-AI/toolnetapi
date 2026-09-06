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
    contextLength: 65536,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    isFree: true,
    description: "Upstage Solar Pro 4 model on Freebuff.",
  },
  {
    id: "glm-5.3-flash",
    name: "GLM 5.3 Flash",
    tuiName: "GLM 5.3 Flash",
    aliases: ["glm-5.3"],
    contextLength: 131072,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    isFree: true,
    description: "Deep reasoning GLM 5.3 Flash model on Freebuff.",
  },
  {
    id: "mimo-v2.5",
    name: "MiMo 2.5",
    tuiName: "MiMo 2.5",
    aliases: ["mimo-2.5", "mimo"],
    contextLength: 131072,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    isFree: true,
    description: "Balanced model for everyday coding tasks.",
  },
  {
    id: "deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    tuiName: "DeepSeek V4 Flash",
    aliases: ["deepseek-v4-flash-0731", "deepseek-v4"],
    contextLength: 1048576,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    isFree: true,
    description: "Fast and smart DeepSeek V4 Flash on Freebuff.",
  },
  {
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    tuiName: "DeepSeek V4 Pro",
    aliases: [],
    contextLength: 1048576,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    isFree: true,
  },
  {
    id: "mimo-v2.5-pro",
    name: "MiMo 2.5 Pro",
    tuiName: "MiMo 2.5 Pro",
    aliases: ["mimo-2.5-pro"],
    contextLength: 131072,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    isFree: true,
  },
  {
    id: "glm-5.2",
    name: "GLM 5.2",
    tuiName: "GLM 5.2",
    aliases: [],
    contextLength: 131072,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    isFree: true,
  },
  {
    id: "gpt-5.6-luna",
    name: "GPT 5.6 Luna",
    tuiName: "GPT 5.6 Luna",
    aliases: ["gpt-5.6"],
    contextLength: 272000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    isFree: true,
  },
  {
    id: "minimax-m3",
    name: "MiniMax M3",
    tuiName: "MiniMax M3",
    aliases: ["minimax"],
    contextLength: 131072,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    isFree: true,
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    tuiName: "Gemini 3.8 Flash",
    aliases: ["gemini-3.8"],
    contextLength: 1048576,
    maxOutputTokens: 65536,
    supportsStreaming: true,
    isFree: true,
  },
  {
    id: "ox-alpha",
    name: "OX Alpha",
    tuiName: "OX Alpha",
    aliases: [],
    contextLength: 131072,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    isFree: true,
  },
  {
    id: "claude-fable-5",
    name: "Claude Fable 5",
    tuiName: "Claude Fable 5",
    aliases: [],
    contextLength: 200000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    isFree: true,
  },
  {
    id: "kimi-k3-eco",
    name: "Kimi K3 Eco",
    tuiName: "Kimi K3 Eco",
    aliases: ["kimi-k3"],
    contextLength: 262144,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    isFree: true,
  },
];

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

export function getTuiMatcherForModel(modelId) {
  const norm = normalizeFreebuffModelId(modelId);
  const entry = FREEBUFF_CATALOG.find((e) => e.id === norm);
  if (entry) {
    return (line) => {
      const lower = line.toLowerCase();
      return lower.includes(entry.tuiName.toLowerCase()) || entry.aliases.some((a) => lower.includes(a.toLowerCase()));
    };
  }
  return (line) => line.toLowerCase().includes(norm.toLowerCase());
}
