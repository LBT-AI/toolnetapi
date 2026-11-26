import { describe, it, expect } from "vitest";
import xiaomiTokenPlan from "../../open-sse/providers/registry/xiaomi-tokenplan.js";

describe("Xiaomi MiMo Token Plan catalog", () => {
  const models = new Map(xiaomiTokenPlan.models.map((model) => [model.id, model]));

  it("exposes current MiMo V2.6 chat models and V2.5 ASR", () => {
    expect(models.has("mimo-v2.6-pro")).toBe(true);
    expect(models.has("mimo-v2.6-flash")).toBe(true);
    expect(models.get("mimo-v2.5-asr")).toMatchObject({ kind: "stt", params: ["language"] });
  });

  it("preserves existing ToolNet Claude-native alias for saved configurations", () => {
    expect(models.get("mimo-v2.5-pro-claude")).toMatchObject({
      targetFormat: "claude",
      upstreamModelId: "mimo-v2.5-pro",
    });
  });
});
