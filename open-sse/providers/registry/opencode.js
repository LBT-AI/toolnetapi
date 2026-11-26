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
    forceStream: true,
    noAuth: true,
    // Zen reasoning models reject multi-turn history whose assistant messages
    // carry no reasoning_content (400 missing_required_parameter), and the
    // response pipeline strips the field before it reaches the client, so the
    // echo can never come from the client. Inject a placeholder instead.
    reasoningInject: {
      scope: "all",
    },
    quirks: {
      forceAutoToolChoiceModels: ["muse-spark-1.3-contributor-free"],
      // The free lane's MiMo route (OpenRouter-backed) streams thinking as
      // `reasoning` + `reasoning_details[]`, not reasoning_content. stream.js lifts
      // the alias into reasoning_content for OpenAI-shaped clients; every other
      // model on the lane already emits reasoning_content, so the lift is a no-op.
      reasoningAliasFields: true,
    },
  },
  models: [
    { id: "seaglass-alpha-free", name: "Seaglass Alpha Free", contextLength: 1048576, isFree: true, supportsTools: true, supportsReasoning: true },
    { id: "tidepool-alpha-free", name: "Tidepool Alpha Free", contextLength: 1048576, isFree: true, supportsTools: true, supportsReasoning: true },
    { id: "hy4-flash-free", name: "Hy4 flash Free", contextLength: 1048576, isFree: true, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "iceman-free", name: "Iceman Free", contextLength: 262144, isFree: true, supportsTools: true, supportsReasoning: true },
    { id: "flint-40b-free", name: "Flint 40B Free", contextLength: 262144, isFree: true, supportsTools: true, supportsReasoning: true },
    { id: "deepseek-v4.1-flash-free", name: "DeepSeek V4.1 Flash Free", contextLength: 330000, isFree: true, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "nemotron-3.5-super-vl-free", name: "Nemotron 3.5 Super VL Free", contextLength: 1048576, isFree: true, supportsTools: true, supportsReasoning: true, supportsVision: true },
    { id: "beam-free", name: "Beam Free", contextLength: 1048576, isFree: true, supportsTools: true, supportsReasoning: true },
    { id: "mimo-v2.6-flash-free", name: "MiMo-V2.6-Flash Free", contextLength: 1048576, isFree: true, supportsTools: true, supportsReasoning: true, supportsVision: true, supportsAudio: true },
    { id: "nemotron-3.5-lightning-free", name: "Nemotron 3.5 Lightning Free", contextLength: 262144, isFree: true, supportsTools: true, supportsReasoning: true },
  ],
  serviceKinds: ["llm", "systemone"],
  systemoneConfig: {
    baseUrl: "https://opencode.ai/zen/v1/systemone",
    headers: {
      "x-opencode-client": "desktop",
      "User-Agent": "opencode/1.18.31",
    },
  },
  modelsFetcher: { url: "https://opencode.ai/zen/v1/models", type: "opencode-free" },
  passthroughModels: true,
};
