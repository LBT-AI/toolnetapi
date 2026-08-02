export default {
  id: "bobide",
  priority: 40,
  hasFree: true,
  alias: "bob",
  uiAlias: "bob",
  display: {
    name: "IBM Bob IDE",
    icon: "smart_toy",
    color: "#0f62fe",
    textIcon: "BOB",
    website: "https://ibm.com/bob",
    notice: {
      text: "Robust, production-ready free tier with Bob Architect Pro and Bob Coder Flash.",
      apiKeyUrl: "https://ibm.com/bob/settings/keys",
    },
  },
  category: "freeTier",
  transport: {
    baseUrl: "https://api.bob-ide.ibm.com/v1/chat/completions",
    thinkingFormat: "openai",
  },
  models: [
    { id: "bob-architect-pro", name: "Bob Architect Pro", kind: "llm" },
    { id: "bob-coder-flash", name: "Bob Coder Flash", kind: "llm" },
  ],
  serviceKinds: ["llm"],
  passthroughModels: true,
};
