import { describe, expect, it } from "vitest";
import { PROVIDER_MODELS, getModelTargetFormat, getModelSupportedFormats } from "../../open-sse/config/providerModels.js";
import { getExecutor } from "../../open-sse/executors/index.js";

const CHAT_COMPLETIONS_MODELS = [
  "big-pickle",
  "x-preview-f-free",
  "hy3-free",
  "nemotron-3-ultra-free",
  "nemotron-3.5-lightning-free",
  "mimo-v2.5-free",
];

const RESPONSES_MODELS = ["muse-spark-1.2-contributor-free"];

describe("OpenCode Free model catalog", () => {
  it("contains all 7 expected models", () => {
    const ids = (PROVIDER_MODELS.opencode || []).map((m) => m.id);
    expect(ids).toEqual([
      "big-pickle",
      "x-preview-f-free",
      "hy3-free",
      "nemotron-3-ultra-free",
      "nemotron-3.5-lightning-free",
      "laguna-s-2.1-free",
      "mimo-v2.5-free",
      "muse-spark-1.2-contributor-free",
    ]);
  });
});

describe("OpenCode Free per-model targetFormat", () => {
  it("muse-spark-1.2-contributor-free targets openai-responses", () => {
    for (const m of RESPONSES_MODELS) {
      expect(getModelTargetFormat("opencode", m)).toBe("openai-responses");
    }
  });

  it("chat completion models have no targetFormat (defaults to openai)", () => {
    for (const m of CHAT_COMPLETIONS_MODELS) {
      expect(getModelTargetFormat("opencode", m)).toBeNull();
    }
  });
});

describe("OpenCode Free executor URL routing", () => {
  const executor = getExecutor("opencode");

  it("routes muse-spark-1.2-contributor-free to /zen/v1/responses", () => {
    for (const m of RESPONSES_MODELS) {
      expect(executor.buildUrl(m)).toBe("https://opencode.ai/zen/v1/responses");
    }
  });

  it("routes chat completion models to /zen/v1/chat/completions", () => {
    for (const m of CHAT_COMPLETIONS_MODELS) {
      expect(executor.buildUrl(m)).toBe("https://opencode.ai/zen/v1/chat/completions");
    }
  });

  it("laguna-s-2.1-free also routes to chat completions (not in either special list)", () => {
    expect(executor.buildUrl("laguna-s-2.1-free")).toBe("https://opencode.ai/zen/v1/chat/completions");
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