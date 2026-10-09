import { FREEBUFF_CATALOG } from "../../services/freebuff/modelCatalog.js";

const models = [];
for (const m of FREEBUFF_CATALOG) {
  const base = {
    name: m.name,
    upstreamModelId: m.id,
    contextLength: m.contextLength,
    maxOutputTokens: m.upstreamMaxOutputTokens,
    supportsTools: m.supportsTools,
    supportsStreaming: m.supportsStreaming,
    isFree: true,
    capabilities: {
      contextWindow: m.effectiveContextLength,
      maxOutput: m.effectiveMaxOutputTokens,
      tools: m.supportsTools
    }
  };
  models.push({ id: m.id, ...base });
  for (const alias of m.aliases || []) {
    models.push({ id: alias, ...base, name: m.name + " (alias)" });
  }
}

export default {
  id: "freebuff",
  priority: 21,
  hasFree: true,
  alias: "fb",
  aliases: [
    "freebuff-cli",
    "freebuff-ai",
    "codebuff",
  ],
  uiAlias: "fb",
  display: {
    name: "Freebuff",
    icon: "terminal",
    color: "#54A967",
    textIcon: "FB",
    website: "https://freebuff.com",
    notice: {
      text: "Freebuff CLI: 100% free coding assistant through official Freebuff interactive PTY sidecar.",
      signupUrl: "https://freebuff.com",
    },
  },
  category: "cliFree",
  authType: "cliSession",
  noAuth: true,
  authModes: [
    "cliSession",
  ],
  authHint: "Official CLI Interactive Session",
  transport: {
    baseUrl: "freebuff://pty/worker",
    format: "openai",
  },
  models,
  passthroughModels: true,
  serviceKinds: [
    "llm",
  ],
};
