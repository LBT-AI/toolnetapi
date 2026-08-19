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
    { id: "kira-mini-1.0", name: "Kira Mini 1.0", contextLength: 128000, maxOutputTokens: 16384, supportsTools: true, supportsStreaming: true, isFree: true },
    { id: "deepseek-v4-pro-free", name: "Deepseek V4 Pro Free", contextLength: 1000000, maxOutputTokens: 128000, supportsTools: true, supportsStreaming: true, isFree: true },
    { id: "deepseek-v4-flash-free", name: "Deepseek V4 flash Free", contextLength: 1000000, maxOutputTokens: 128000, supportsTools: true, supportsStreaming: true, isFree: true },
    { id: "deepseek-v4-pro-1b-free", name: "Deepseek V4 Pro 1B free", contextLength: 1000000, maxOutputTokens: 128000, supportsTools: true, supportsStreaming: true, isFree: true },
    { id: "deepseek-v4-flash-1b-free", name: "Deepseek V4 Flash 1B Free", contextLength: 1000000, maxOutputTokens: 128000, supportsTools: true, supportsStreaming: true, isFree: true },
    { id: "qwen3.8-27b-free", name: "Qwen3.8 27B Free", contextLength: 1000000, maxOutputTokens: 128000, supportsTools: true, supportsStreaming: true, isFree: true },
    { id: "qwen3.8-max-free", name: "Qwen 3.8 Max Free", contextLength: 1000000, maxOutputTokens: 128000, supportsTools: true, supportsStreaming: true, isFree: true },
  ],
  serviceKinds: ["llm"],
};
