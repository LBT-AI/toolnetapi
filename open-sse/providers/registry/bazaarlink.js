export default {
  id: "bazaarlink",
  priority: 30,
  hasFree: true,
  alias: "bzl",
  aliases: ["bazaar-link"],
  uiAlias: "bzl",
  category: "freeTier",
  authType: "apikey",
  authModes: ["apikey"],
  display: {
    name: "Bazaarlink",
    icon: "storefront",
    color: "#DC2626",
    textIcon: "BZ",
    website: "https://bazaarlink.ai",
    notice: {
      text: "Bazaarlink API — Cung cấp các model Free tier không giới hạn thời gian (Auto Free, Qwen 3.7 Flash, DeepSeek V4 Flash).",
      apiKeyUrl: "https://bazaarlink.ai",
    },
  },
  transport: {
    baseUrl: "https://bazaarlink.ai/api/v1/chat/completions",
    validateUrl: "https://bazaarlink.ai/api/v1/models",
  },
  models: [
    { id: "auto:free", name: "Auto Router Free", contextLength: 1000000, isFree: true, description: "Tự động định tuyến đến model free khả dụng với chi phí 0$." },
    { id: "qwen/qwen3.7-flash:free", name: "Qwen 3.7 Flash (Free)", contextLength: 1000000, isFree: true, supportsVision: true, description: "Model thị giác & suy luận ngôn ngữ đa phương thức từ Alibaba (Free Tier)." },
    { id: "deepseek/deepseek-v4-flash-0731free:free", name: "DeepSeek V4 Flash 07/31 (Free)", contextLength: 1048576, isFree: true, description: "Model suy luận và code tốc độ cao từ DeepSeek (Free Tier)." },
    { id: "deepseek-v4-flash-0731free", name: "DeepSeek V4 Flash 07/31", upstreamModelId: "deepseek/deepseek-v4-flash-0731free:free", contextLength: 1048576, isFree: true, description: "Alias ngắn cho DeepSeek V4 Flash Free." },
    { id: "qwen3.7-flash:free", name: "Qwen 3.7 Flash (Free)", upstreamModelId: "qwen/qwen3.7-flash:free", contextLength: 1000000, isFree: true, supportsVision: true, description: "Alias ngắn cho Qwen 3.7 Flash Free." },
  ],
  passthroughModels: true,
};
