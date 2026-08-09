import { describe, it, expect } from "vitest";
import { getThinkingLevels } from "../../open-sse/providers/thinkingLevels.js";

describe("getThinkingLevels", () => {
  it("adds max + ultra for gpt-5.6-sol/terra on codex, max-only for luna", () => {
    expect(getThinkingLevels("codex", "gpt-5.6-sol")).toEqual(
      ["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"]
    );
    expect(getThinkingLevels("codex", "gpt-5.6-terra")).toEqual(
      ["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"]
    );
    const luna = getThinkingLevels("codex", "gpt-5.6-luna");
    expect(luna).toContain("max");
    expect(luna).not.toContain("ultra");
  });

  it("does not add max for other codex models", () => {
    const levels = getThinkingLevels("codex", "gpt-5.3-codex");
    expect(levels).toEqual(["low", "medium", "high", "xhigh"]);
  });

  it("does not add max for other gpt-5.6 models", () => {
    const levels = getThinkingLevels("codex", "gpt-5.5");
    expect(levels || []).not.toContain("max");
  });

  it("Generic OpenAI providers do not get ultra/max (provider-scoped)", () => {
    const levels = getThinkingLevels("openai", "gpt-5.6-sol");
    expect(levels || []).not.toContain("ultra");
    expect(levels || []).not.toContain("max");
  });

  it("Kiro gpt-5.6 follows effort path, non-reasoning Kiro → null", () => {
    expect(getThinkingLevels("kiro", "gpt-5.6-sol")).toBeTruthy();
  });
});

import { applyThinking } from "../../open-sse/translator/concerns/thinkingUnified.js";

describe("applyThinking reasoning wire format mapping", () => {
  it("preserves max and ultra for codex gpt-5.6-sol", () => {
    const bodyMax = { reasoning_effort: "max" };
    applyThinking("openai", "gpt-5.6-sol", bodyMax, "codex");
    expect(bodyMax.reasoning_effort).toBe("max");

    const bodyUltra = { reasoning_effort: "ultra" };
    applyThinking("openai", "gpt-5.6-sol", bodyUltra, "codex");
    expect(bodyUltra.reasoning_effort).toBe("ultra");
  });

  it("clamps max and ultra to xhigh for generic openai provider", () => {
    const bodyMax = { reasoning_effort: "max" };
    applyThinking("openai", "gpt-5.6-sol", bodyMax, "openai");
    expect(bodyMax.reasoning_effort).toBe("xhigh");

    const bodyUltra = { reasoning_effort: "ultra" };
    applyThinking("openai", "gpt-5.6-sol", bodyUltra, "openai");
    expect(bodyUltra.reasoning_effort).toBe("xhigh");
  });

  it("passes TokenRouter reasoning_effort levels through natively without clamping max", () => {
    const bodyMax = { reasoning_effort: "max" };
    applyThinking("tokenrouter", "anthropic/claude-opus-5", bodyMax, "tokenrouter");
    expect(bodyMax.reasoning_effort).toBe("max");

    const bodyHigh = { reasoning_effort: "high" };
    applyThinking("tokenrouter", "anthropic/claude-opus-5", bodyHigh, "tokenrouter");
    expect(bodyHigh.reasoning_effort).toBe("high");
  });
});
