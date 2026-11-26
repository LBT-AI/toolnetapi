import { describe, expect, it } from "vitest";
import { PROVIDER_MODELS, getModelTargetFormat, getModelSupportedFormats } from "../../open-sse/config/providerModels.js";
import { getExecutor } from "../../open-sse/executors/index.js";

// NOTE (2026-11-26): an earlier draft of this file pinned the pre-#4842
// layout (9 models, /zen/v1). Upstream 9router moved the free tier to
// /inference/v1 with the v2 client fingerprint (#4842) and the catalog has
// since grown to 12 models, so the expectations below track upstream master:
// - Muse Spark contributor models are Responses models (openai-responses,
//   /inference/v1/responses).
// - Union Alpha is a Messages model (claude targetFormat,
//   /inference/v1/messages).
// - The rest are plain Chat Completions models.
const CHAT_COMPLETIONS_MODELS = [
  "jev-1.13-free",
  "big-pickle",
  "beam-free",
  "flint-40b-free",
  "mimo-v2.6-flash-free",
  "nemotron-3.5-super-vl-free",
  "nemotron-3.5-lightning-free",
  "deepseek-v4.1-flash-free",
  "glm-5.3-flash-free",
];

const RESPONSES_MODELS = [
  "muse-spark-1.2-contributor-free",
  "muse-spark-1.3-contributor-free",
];

const MESSAGES_MODELS = ["union-alpha"];

const ALL_MODELS = [...RESPONSES_MODELS, ...MESSAGES_MODELS, ...CHAT_COMPLETIONS_MODELS];

describe("OpenCode Free model catalog", () => {
  it("contains all 12 expected models", () => {
    const ids = (PROVIDER_MODELS.opencode || []).map((m) => m.id);
    expect(ids).toEqual(ALL_MODELS);
  });
});

describe("OpenCode Free per-model targetFormat", () => {
  it("chat completion models have no targetFormat (defaults to openai)", () => {
    for (const m of CHAT_COMPLETIONS_MODELS) {
      expect(getModelTargetFormat("opencode", m)).toBeNull();
    }
  });

  it("Muse Spark contributor models use the openai-responses targetFormat", () => {
    for (const m of RESPONSES_MODELS) {
      expect(getModelTargetFormat("opencode", m)).toBe("openai-responses");
    }
  });

  it("Union Alpha uses the claude targetFormat", () => {
    for (const m of MESSAGES_MODELS) {
      expect(getModelTargetFormat("opencode", m)).toBe("claude");
    }
  });
});

describe("OpenCode Free executor URL routing", () => {
  const executor = getExecutor("opencode");

  it("routes chat completion models to /inference/v1/chat/completions", () => {
    for (const m of CHAT_COMPLETIONS_MODELS) {
      expect(executor.buildUrl(m)).toBe("https://opencode.ai/inference/v1/chat/completions");
    }
  });

  it("routes Muse Spark contributor models to /inference/v1/responses", () => {
    for (const m of RESPONSES_MODELS) {
      expect(executor.buildUrl(m)).toBe("https://opencode.ai/inference/v1/responses");
    }
  });

  it("routes Union Alpha to /inference/v1/messages", () => {
    for (const m of MESSAGES_MODELS) {
      expect(executor.buildUrl(m)).toBe("https://opencode.ai/inference/v1/messages");
    }
  });
});

describe("OpenCode Free does not affect opencode-go", () => {
  it("opencode-go executor is separate and unchanged", () => {
    const goExecutor = getExecutor("opencode-go");
    expect(goExecutor.buildUrl("deepseek-v4-pro")).toBe("https://opencode.ai/inference/go/openai/v1/chat/completions");
    expect(goExecutor.buildUrl("mimo-v2.5")).toBe("https://opencode.ai/inference/go/openai/v1/chat/completions");
  });

  it("opencode-go model targetFormats unchanged", () => {
    expect(getModelTargetFormat("opencode-go", "deepseek-v4-pro")).toBeNull();
    expect(getModelTargetFormat("opencode-go", "mimo-v2.5")).toBeNull();
  });
});
