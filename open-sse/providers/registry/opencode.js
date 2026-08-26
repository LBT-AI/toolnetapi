export default {
  id: "opencode",
  priority: 40,
  hasFree: true,
  alias: "oc",
  uiAlias: "oc",
  display: {
    name: "OpenCode Free",
    icon: "terminal",
    color: "#E87040",
    textIcon: "OC",
  },
  category: "free",
  noAuth: true,
  transport: {
    baseUrl: "https://opencode.ai",
    headers: {
      "x-opencode-client": "desktop",
    },
    noAuth: true,
  },
  models: [
    { id: "big-pickle", name: "MiMo v2.5 (Big Pickle)", supportsTools: true, supportsReasoning: true },
    { id: "x-preview-f-free", name: "X Preview F Free", supportsReasoning: true },
    { id: "hy3-free", name: "Hy3 Free", supportsReasoning: true },
    { id: "nemotron-3-ultra-free", name: "Nemotron 3 Ultra Free" },
    { id: "nemotron-3.5-lightning-free", name: "Nemotron 3.5 Lightning Free" },
    { id: "laguna-s-2.1-free", name: "Laguna S 2.1 Free" },
    { id: "mimo-v2.5-free", name: "MiMo v2.5 Free" },
    { id: "muse-spark-1.2-contributor-free", name: "Muse Spark 1.2 Contributor Free", targetFormat: "openai-responses" },
  ],
  modelsFetcher: { url: "https://opencode.ai/zen/v1/models", type: "opencode-free" },
  passthroughModels: true,
};
