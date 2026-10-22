import { describe, expect, it } from "vitest";
import { PROVIDER_MODELS, getModelTargetFormat, getModelSupportedFormats } from "../../open-sse/config/providerModels.js";
import { getExecutor } from "../../open-sse/executors/index.js";

const CHAT_COMPLETIONS_MODELS = [
  "big-pickle",
  "beam-free",
  "flint-40b-free",
  "mimo-v2.6-flash-free",
  "nemotron-3.5-super-vl-free",
  "nemotron-3.5-lightning-free",
  "jev-1.13-free",
  "deepseek-v4.1-flash-free",
  "glm-5.3-flash-free",
];

describe("OpenCode Free model catalog", () => {
  it("contains all 9 expected models", () => {
    const ids = (PROVIDER_MODELS.opencode || []).map((m) => m.id);
    expect(ids).toEqual(CHAT_COMPLETIONS_MODELS);
  });
});

describe("OpenCode Free per-model targetFormat", () => {
  it("chat completion models have no targetFormat (defaults to openai)", () => {
    for (const m of CHAT_COMPLETIONS_MODELS) {
      expect(getModelTargetFormat("opencode", m)).toBeNull();
    }
  });
});

describe("OpenCode Free executor URL routing", () => {
  const executor = getExecutor("opencode");

  it("routes chat completion models to /zen/v1/chat/completions", () => {
    for (const m of CHAT_COMPLETIONS_MODELS) {
      expect(executor.buildUrl(m)).toBe("https://opencode.ai/zen/v1/chat/completions");
    }
  });
});

describe("OpenCode Free does not affect opencode-go", () => {
  it("opencode-go executor is separate and unchanged", () => {
    const goExecutor = getExecutor("opencode-go");
    expect(goExecutor.buildUrl("deepseek-v4-pro")).toBe("https://opencode.ai/zen/go/v1/chat/completions");
    expect(goExecutor.buildUrl("mimo-v2.5")).toBe("https://opencode.ai/zen/go/v1/chat/completions");
  });

  it("opencode-go model targetFormats unchanged", () => {
    expect(getModelTargetFormat("opencode-go", "deepseek-v4-pro")).toBeNull();
    expect(getModelTargetFormat("opencode-go", "mimo-v2.5")).toBeNull();
  });
});