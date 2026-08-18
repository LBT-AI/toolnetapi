export default {
  id: "sambanova",
  priority: 25,
  hasFree: true,
  alias: "sambanova",
  aliases: ["sambanova-ai", "samba"],
  display: {
    name: "SambaNova Cloud",
    icon: "memory",
    color: "#EA580C",
    textIcon: "SN",
    website: "https://sambanova.ai",
    notice: {
      text: "Free high-speed inference on SambaNova Cloud with OpenAI-compatible API.",
      apiKeyUrl: "https://cloud.sambanova.ai/apis",
    },
  },
  category: "freeTier",
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.sambanova.ai/v1/chat/completions",
    validateUrl: "https://api.sambanova.ai/v1/models",
    thinkingFormat: "openai",
  },
  models: [
    { id: "DeepSeek-V3.1", name: "DeepSeek V3.1", contextLength: 131072, supportsTools: true, supportsStreaming: true },
    { id: "DeepSeek-V3.2", name: "DeepSeek V3.2", contextLength: 131072, supportsTools: true, supportsStreaming: true },
    { id: "Meta-Llama-3.3-70B-Instruct", name: "Meta Llama 3.3 70B Instruct", contextLength: 131072, supportsTools: true, supportsStreaming: true },
    { id: "gpt-oss-120b", name: "GPT OSS 120B", contextLength: 131072, supportsTools: true, supportsStreaming: true },
    { id: "gemma-4-31B-it", name: "Gemma 4 31B IT", contextLength: 131072, supportsTools: true, supportsStreaming: true },
  ],
  serviceKinds: ["llm"],
};
