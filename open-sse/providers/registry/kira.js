export default {
  id: "kira",
  priority: 22,
  hasFree: true,
  alias: "kira",
  aliases: ["kira-ai", "kiraai"],
  display: {
    name: "Kira AI",
    icon: "psychology",
    color: "#06B6D4",
    textIcon: "KR",
    website: "https://kiraai.vn",
    notice: {
      text: "Free OpenAI-compatible AI models on Kira AI.",
      apiKeyUrl: "https://kiraai.vn",
    },
  },
  category: "freeTier",
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://kiraai.vn/api/v1/chat/completions",
    validateUrl: "https://kiraai.vn/api/v1/models",
    thinkingFormat: "openai",
    quirks: {
      // Kira is an OpenAI-compatible upstream: keep the forwarded body byte-faithful.
      // Jailbreak fake-history/prefill injections corrupt its reasoning models
      // (trailing assistant prefill forces reasoning-only output → empty content),
      // reasoning_content must not be stripped/deduped, and no reasoning placeholder
      // is required on assistant messages. All scoped to kira only.
      skipJailbreakInject: true,
      preserveReasoningContent: true,
      skipReasoningContentInject: true,
    },
  },
  models: [
    { id: "kira-3.5-pro", name: "Kira 3.5 Pro", contextLength: 128000, maxOutputTokens: 16384, supportsTools: true, supportsStreaming: true, isFree: true },
    { id: "kira-3.5-flash", name: "Kira 3.5 Flash", contextLength: 128000, maxOutputTokens: 16384, supportsTools: true, supportsStreaming: true, isFree: true },
    { id: "kira-2.5-pro", name: "Kira 2.5 Pro", contextLength: 128000, maxOutputTokens: 16384, supportsTools: true, supportsStreaming: true, isFree: true },
    { id: "kira-2.5-flash", name: "Kira 2.5 Flash", contextLength: 128000, maxOutputTokens: 16384, supportsTools: true, supportsStreaming: true, isFree: true },
    { id: "kira-2.0", name: "Kira 2.0", contextLength: 128000, maxOutputTokens: 16384, supportsTools: true, supportsStreaming: true, isFree: true },
    { id: "kira-mini-1.0", name: "Kira Mini 1.0", contextLength: 128000, maxOutputTokens: 16384, supportsTools: true, supportsStreaming: true, isFree: true },
  ],
  passthroughModels: true,
  serviceKinds: ["llm"],
};
