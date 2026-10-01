import { describe, expect, it } from "vitest";
import { applyThinking } from "open-sse/translator/concerns/thinkingUnified.js";

describe("applyThinking on OpenAI-compatible wire with native models", () => {
  it.each([
    ["gemini-3.5-flash-lite"],
    ["gemini-3.7-flash"],
    ["gemini-3-pro"],
  ])("Gemini 3.x model %s (gemini-level) over a custom OpenAI-compatible provider routes to reasoning_effort", (model) => {
    const out = applyThinking("openai", model, { reasoning_effort: "medium" }, "my-custom-gemini-openai");
    expect(out.reasoning_effort).toBe("medium");
    expect(out.generationConfig).toBeUndefined();
    expect(out.thinkingConfig).toBeUndefined();
  });

  it("Gemini 2.5 model (gemini-budget) over a custom OpenAI-compatible provider routes to reasoning_effort", () => {
    const out = applyThinking("openai", "gemini-2.5-flash", { reasoning_effort: "high" }, "my-custom-gemini-openai");
    expect(out.reasoning_effort).toBe("high");
    expect(out.generationConfig).toBeUndefined();
    expect(out.thinkingConfig).toBeUndefined();
  });

  it("Gemini model over its native format (antigravity/gemini-cli) still gets generationConfig", () => {
    const out = applyThinking("gemini-cli", "gemini-3.5-flash-lite", { reasoning_effort: "medium" }, "gemini-cli");
    expect(out.generationConfig?.thinkingConfig?.thinkingLevel).toBe("medium");
  });
});
