export default {
  id: "openrouter",
  priority: 10,
  hasFree: true,
  alias: "openrouter",
  aliases: ["openrouter", "or"],
  uiAlias: "openrouter",
  display: {
    name: "OpenRouter",
    icon: "router",
    color: "#F97316",
    textIcon: "OR",
    website: "https://openrouter.ai",
    notice: {
      text: "Free tier: 20+ free models, no credit card needed, 200 req/day. After $10 credit: 1,000 req/day.",
      apiKeyUrl: "https://openrouter.ai/settings/keys",
    },
  },
  category: "freeTier",
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    thinkingFormat: "openai",
    headers: {
      "HTTP-Referer": "https://endpoint-proxy.local",
      "X-Title": "Endpoint Proxy",
    },
  },
  models: [
    // ── Free Models (verified active on OpenRouter free tier) ──
    { id: "openrouter/free", name: "Free Models Router", contextLength: 200000, isFree: true, supportsTools: true, supportsReasoning: true, supportsVision: true, description: "Default free auto-router on OpenRouter" },
    { id: "recursive/flint-v1.0:free", name: "Recursive: Flint (free)", contextLength: 262144, isFree: true, supportsTools: true, supportsReasoning: true },
    { id: "xingchen-agi/xing4.0-29b-a4b:free", name: "XingChen: Xing4.0 29B A4B (free)", contextLength: 262144, isFree: true, supportsTools: true, supportsReasoning: true },
    { id: "nvidia/nemotron-3.5-super-vl:free", name: "NVIDIA: Nemotron 3.5 Super VL (free)", contextLength: 1000000, isFree: true, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "dots-studio/dots-3-note-preview:free", name: "Dots Studio: Dots3-Note Preview (free)", contextLength: 512000, isFree: true, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "liquid/lfm-2.5-2.6b:free", name: "LiquidAI: LFM2.5-2.6B (free)", contextLength: 65536, isFree: true, supportsTools: true, supportsReasoning: true },
    { id: "nvidia/nemotron-3.5-lightning:free", name: "NVIDIA: Nemotron 3.5 Lightning (free)", contextLength: 1000000, isFree: true, supportsTools: true, supportsReasoning: true },
    { id: "thinkingmachines/inkling-small:free", name: "Thinking Machines: Inkling Small (free)", contextLength: 1048576, isFree: true, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "thinkingmachines/inkling:free", name: "Thinking Machines: Inkling (free)", contextLength: 1048576, isFree: true, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "poolside/laguna-s-2.1:free", name: "Poolside: Laguna S 2.1 (free)", contextLength: 262144, isFree: true, supportsTools: true, supportsReasoning: true },
    { id: "poolside/laguna-xs-2.1:free", name: "Poolside: Laguna XS 2.1 (free)", contextLength: 262144, isFree: true, supportsTools: true, supportsReasoning: true },
    { id: "cohere/north-mini-code:free", name: "Cohere: North Mini Code (free)", contextLength: 256000, isFree: true, supportsTools: true, supportsReasoning: true },
    { id: "nvidia/nemotron-3.5-content-safety:free", name: "NVIDIA: Nemotron 3.5 Content Safety (free)", contextLength: 128000, isFree: true, supportsReasoning: true, supportsVision: true },
    { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "NVIDIA: Nemotron 3 Ultra (free)", contextLength: 1000000, isFree: true, supportsTools: true, supportsReasoning: true },
    { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", name: "NVIDIA: Nemotron 3 Nano Omni (free)", contextLength: 256000, isFree: true, supportsTools: true, supportsReasoning: true, supportsVision: true, supportsAudio: true },
    { id: "google/gemma-4-26b-a4b-it:free", name: "Google: Gemma 4 26B A4B (free)", contextLength: 262144, isFree: true, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "google/gemma-4-31b-it:free", name: "Google: Gemma 4 31B (free)", contextLength: 262144, isFree: true, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "google/lyria-3-pro-preview", name: "Google: Lyria 3 Pro Preview", contextLength: 1048576, isFree: true, supportsVision: true },
    { id: "google/lyria-3-clip-preview", name: "Google: Lyria 3 Clip Preview", contextLength: 1048576, isFree: true, supportsVision: true },
    { id: "nvidia/nemotron-3-super-120b-a12b:free", name: "NVIDIA: Nemotron 3 Super (free)", contextLength: 262144, isFree: true, supportsTools: true, supportsReasoning: true },

    // ── Anthropic Claude ──
    { id: "anthropic/claude-sonnet-5.5", name: "Claude Sonnet 5.5", contextLength: 200000, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "anthropic/claude-opus-5.5", name: "Claude Opus 5.5", contextLength: 200000, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "anthropic/claude-haiku-5.5", name: "Claude Haiku 5.5", contextLength: 200000, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "anthropic/claude-sonnet-5", name: "Claude Sonnet 5", contextLength: 200000, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "anthropic/claude-opus-5", name: "Claude Opus 5", contextLength: 200000, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5", contextLength: 200000, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "anthropic/claude-opus-4.5", name: "Claude Opus 4.5", contextLength: 200000, supportsTools: true, supportsReasoning: true, supportsVision: true },

    // ── OpenAI ──
    { id: "openai/gpt-4o", name: "OpenAI: GPT-4o", contextLength: 128000, supportsTools: true, supportsVision: true },
    { id: "openai/gpt-4o-mini", name: "OpenAI: GPT-4o-mini", contextLength: 128000, supportsTools: true, supportsVision: true },
    { id: "openai/o1", name: "OpenAI: o1", contextLength: 200000, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "openai/o3", name: "OpenAI: o3", contextLength: 200000, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "openai/o3-mini", name: "OpenAI: o3 Mini", contextLength: 200000, supportsTools: true, supportsReasoning: true },
    { id: "openai/o4-mini", name: "OpenAI: o4-mini", contextLength: 200000, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "openai/gpt-5.6-sol", name: "OpenAI: GPT-5.6 Sol", contextLength: 200000, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "openai/gpt-5.6-luna", name: "OpenAI: GPT-5.6 Luna", contextLength: 200000, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "openai/gpt-5.5", name: "OpenAI: GPT-5.5", contextLength: 200000, supportsTools: true, supportsReasoning: true, supportsVision: true },

    // ── DeepSeek ──
    { id: "deepseek/deepseek-chat", name: "DeepSeek: DeepSeek V3", contextLength: 163840, supportsTools: true },
    { id: "deepseek/deepseek-v4-pro", name: "DeepSeek: DeepSeek V4 Pro", contextLength: 1000000, supportsTools: true, supportsReasoning: true },
    { id: "deepseek/deepseek-v4-flash", name: "DeepSeek: DeepSeek V4 Flash", contextLength: 1000000, supportsTools: true, supportsReasoning: true },
    { id: "deepseek/deepseek-v4.1-flash", name: "DeepSeek: DeepSeek V4.1 Flash", contextLength: 1000000, supportsTools: true, supportsReasoning: true },

    // ── Google Gemini ──
    { id: "google/gemini-2.5-pro", name: "Google: Gemini 2.5 Pro", contextLength: 1048576, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "google/gemini-2.5-flash", name: "Google: Gemini 2.5 Flash", contextLength: 1048576, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "google/gemini-3.7-flash", name: "Google: Gemini 3.7 Flash", contextLength: 1048576, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "google/gemini-3.8-flash", name: "Google: Gemini 3.8 Flash", contextLength: 1048576, supportsTools: true, supportsReasoning: true, supportsVision: true },

    // ── Meta, Qwen, MiniMax, Mistral ──
    { id: "meta-llama/llama-3.3-70b-instruct", name: "Meta: Llama 3.3 70B Instruct", contextLength: 131072, supportsTools: true },
    { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen2.5 72B Instruct", contextLength: 32768, supportsTools: true },
    { id: "minimax/minimax-m3.1-flash", name: "MiniMax: MiniMax M3.1 Flash", contextLength: 1000000, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "mistralai/mistral-large-2407", name: "Mistral Large 2407", contextLength: 131072, supportsTools: true },

    // ── Embeddings ──
    { id: "openai/text-embedding-3-large", name: "OpenAI Text Embedding 3 Large", kind: "embedding" },
    { id: "openai/text-embedding-3-small", name: "OpenAI Text Embedding 3 Small", kind: "embedding" },
    { id: "openai/text-embedding-ada-002", name: "OpenAI Text Embedding Ada 002", kind: "embedding" },
    { id: "qwen/qwen3-embedding-8b", name: "Qwen3 Embedding 8B", kind: "embedding" },
    { id: "perplexity/pplx-embed-v1-4b", name: "Perplexity Embed V1 4B", kind: "embedding" },
    { id: "perplexity/pplx-embed-v1-0.6b", name: "Perplexity Embed V1 0.6B", kind: "embedding" },
    { id: "nvidia/llama-nemotron-embed-vl-1b-v2:free", name: "NVIDIA Nemotron Embed VL 1B V2 (Free)", kind: "embedding" },

    // ── TTS ──
    { id: "openai/gpt-4o-mini-tts", name: "GPT-4o Mini TTS", kind: "tts" },
    { id: "openai/tts-1-hd", name: "TTS-1 HD", kind: "tts" },
    { id: "openai/tts-1", name: "TTS-1", kind: "tts" },

    // ── Image Generation ──
    { id: "openai/dall-e-3", name: "DALL-E 3 (via OpenRouter)", params: ["size", "quality", "style", "response_format"], kind: "image" },
    { id: "openai/gpt-image-1", name: "GPT Image 1 (via OpenRouter)", params: ["n", "size", "quality", "response_format"], kind: "image" },
    { id: "google/imagen-3.0-generate-002", name: "Imagen 3 (via OpenRouter)", params: ["n", "size"], kind: "image" },
    { id: "black-forest-labs/FLUX.1-schnell", name: "FLUX.1 Schnell (via OpenRouter)", params: ["n", "size"], kind: "image" },
  ],
  serviceKinds: ["llm", "embedding", "tts", "imageToText"],
  ttsConfig: {
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "openai/gpt-4o-mini-tts",
    headers: { "HTTP-Referer": "https://endpoint-proxy.local", "X-Title": "Endpoint Proxy" },
  },
  embeddingConfig: {
    baseUrl: "https://openrouter.ai/api/v1/embeddings",
    authType: "apikey",
    authHeader: "bearer",
    headers: { "HTTP-Referer": "https://endpoint-proxy.local", "X-Title": "Endpoint Proxy" },
  },
  imageConfig: {
    baseUrl: "https://openrouter.ai/api/v1/images/generations",
    headers: { "HTTP-Referer": "https://endpoint-proxy.local", "X-Title": "Endpoint Proxy" },
  },
  modelsFetcher: { url: "https://openrouter.ai/api/v1/models", type: "openrouter-free" },
  passthroughModels: true,
};
