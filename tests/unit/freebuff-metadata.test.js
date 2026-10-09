import { describe, expect, it } from "vitest";
import freebuffRegistry from "../../open-sse/providers/registry/freebuff.js";
import { FREEBUFF_CATALOG, normalizeFreebuffModelId, calculateAvailableInputTokens } from "../../open-sse/services/freebuff/modelCatalog.js";

describe("Freebuff Model Metadata", () => {
  it("exports a standard 11-field schema in FREEBUFF_CATALOG", () => {
    for (const model of FREEBUFF_CATALOG) {
      expect(model).toHaveProperty("id");
      expect(model).toHaveProperty("contextLength");
      expect(model).toHaveProperty("effectiveContextLength");
      expect(model).toHaveProperty("upstreamMaxOutputTokens");
      expect(model).toHaveProperty("effectiveMaxOutputTokens");
      expect(model).toHaveProperty("defaultOutputReserveTokens");
      expect(model).toHaveProperty("contextPruningBudget");
      expect(model).toHaveProperty("supportsStreaming");
      expect(model).toHaveProperty("supportsTools");
      expect(model).toHaveProperty("availabilityStatus");
      expect(model).toHaveProperty("source");
      expect(model).toHaveProperty("verifiedAt");
      
      // Unknown limits should be null
      if (model.id === "solar-pro-4") {
        expect(model.upstreamMaxOutputTokens).toBeNull();
        expect(model.effectiveMaxOutputTokens).toBeNull();
        expect(model.supportsTools).toBe(false);
      }
    }
  });

  it("handles alias mapping correctly", () => {
    expect(normalizeFreebuffModelId("mimo-2.5")).toBe("mimo-v2.5");
    expect(normalizeFreebuffModelId("solar-pro")).toBe("solar-pro-4");
    expect(normalizeFreebuffModelId("freebuff/solar-pro")).toBe("solar-pro-4");
    expect(normalizeFreebuffModelId("unknown-model")).toBe("unknown-model");
  });

  it("calculates token budget accurately", () => {
    // mimo-v2.5 has contextPruningBudget 52428, reserve 4096
    const res = calculateAvailableInputTokens("mimo-v2.5", [
      { role: "user", content: "hello" }
    ]);
    expect(res.isEstimated).toBe(true);
    expect(res.budget).toBe(400000);
    // user + content "hello" (5 chars -> ceil(5/4)=2 tokens, role=1 token) -> 3 tokens
    expect(res.remaining).toBe(400000 - 2007 - 4096);
  });

  it("identifies paused/retired models", () => {
    const minimax = FREEBUFF_CATALOG.find(m => m.id === "minimax-m3");
    expect(minimax.availabilityStatus).toBe("paused");
    
    const luna = FREEBUFF_CATALOG.find(m => m.id === "gpt-5.6-luna");
    expect(luna.availabilityStatus).toBe("paused");
  });

  it("adds capabilities object to registry models", () => {
    const solar = freebuffRegistry.models.find(m => m.id === "solar-pro-4");
    expect(solar).toBeDefined();
    expect(solar.capabilities.contextWindow).toBe(500000);
    expect(solar.capabilities.maxOutput).toBeNull();
    expect(solar.capabilities.tools).toBe(false);
  });
});
