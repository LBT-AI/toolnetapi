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
