import { describe, expect, it } from "vitest";
import REGISTRY from "../../open-sse/providers/registry/index.js";
import { FREE_TIER_PROVIDERS, AI_PROVIDERS } from "../../src/shared/constants/providers.js";
import { PROVIDER_MODELS } from "../../open-sse/config/providerModels.js";
import { CLI_TOOLS } from "../../src/shared/constants/cliTools.js";

describe("Freebuff provider registration", () => {
  it("exists in the main REGISTRY as a freeTier category provider", () => {
    const freebuff = REGISTRY.find((p) => p.id === "freebuff");
    expect(freebuff).toBeTruthy();
    expect(freebuff.category).toBe("freeTier");
    expect(freebuff.hasFree).toBe(true);
    expect(freebuff.alias).toBe("fb");
    expect(freebuff.display.name).toBe("Freebuff");
    expect(freebuff.display.color).toBe("#54A967");
    expect(freebuff.display.website).toBe("https://freebuff.com");
  });

  it("is included in FREE_TIER_PROVIDERS and AI_PROVIDERS for dashboard", () => {
    expect(FREE_TIER_PROVIDERS.freebuff).toBeTruthy();
    expect(FREE_TIER_PROVIDERS.freebuff.id).toBe("freebuff");
    expect(FREE_TIER_PROVIDERS.freebuff.name).toBe("Freebuff");
    expect(AI_PROVIDERS.freebuff).toBeTruthy();
  });

  it("exposes expected Freebuff models in PROVIDER_MODELS", () => {
    const models = PROVIDER_MODELS.freebuff || [];
    const ids = models.map((m) => m.id);
    expect(ids).toContain("deepseek-v4-flash");
    expect(ids).toContain("glm-5.3-flash");
    expect(ids).toContain("gpt-5.6-luna");
    expect(ids).toContain("mimo-2.5");
    expect(ids).toContain("solar-pro-4");
    expect(ids).toContain("gemini-3.1-flash-lite");
    expect(ids).toContain("deepseek-v4-flash-0731");
    expect(ids).toContain("mimo-v2.5");
  });

  it("registers freebuff alias in PROVIDER_MODELS", () => {
    expect(PROVIDER_MODELS.fb).toBeDefined();
    expect(PROVIDER_MODELS.fb).toEqual(PROVIDER_MODELS.freebuff);
  });

  it("is configured in CLI_TOOLS for terminal setup", () => {
    expect(CLI_TOOLS.freebuff).toBeDefined();
    expect(CLI_TOOLS.freebuff.name).toBe("Freebuff CLI");
    expect(CLI_TOOLS.freebuff.image).toBe("/providers/freebuff.png");
  });
});
