export default {
  id: "toolnet",
  priority: 1,
  alias: "tn",
  uiAlias: "tn",
  display: {
    name: "ToolNet API",
    icon: "api",
    color: "#673AB7",
    textIcon: "TN",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.toolnet.io/v1", // Will be overridden if they use a proxy or custom node
  },
  models: [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
    { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku" },
    { id: "gemini-2.5-pro-exp", name: "Gemini 2.5 Pro (Exp)" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  ],
  passthroughModels: true,
};
