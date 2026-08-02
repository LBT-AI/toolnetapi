export default {
  id: "agnes",
  priority: 35,
  hasFree: true,
  alias: "agnes",
  display: {
    name: "Agnes AI",
    icon: "api",
    color: "#000000",
    textIcon: "AG",
    website: "https://agnes-ai.com",
    notice: {
      text: "Free Omni-Modal AI API, World-Class AI Models.",
      apiKeyUrl: "https://agnes-ai.com",
    },
  },
  category: "freeTier",
  transport: {
    baseUrl: "https://apihub.agnes-ai.com/v1/chat/completions",
    thinkingFormat: "openai",
  },
  serviceKinds: ["llm", "image", "video"],
  models: [
    { id: "agnes-2.0-flash", name: "Agnes 2.0 Flash", kind: "llm" },
    { id: "agnes-image-2.1-flash", name: "Agnes Image 2.1 Flash", kind: "image" },
    { id: "agnes-video-v2.0", name: "Agnes Video v2.0", kind: "video" },
  ],
  imageConfig: {
    baseUrl: "https://apihub.agnes-ai.com/v1/images/generations",
  },
  videoConfig: {
    baseUrl: "https://apihub.agnes-ai.com/v1/videos/generations",
  },
  passthroughModels: true,
};
