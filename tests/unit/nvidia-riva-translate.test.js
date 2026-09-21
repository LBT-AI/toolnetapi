import { describe, it, expect } from "vitest";
import { PROVIDER_MODELS, getModelsByProviderId, isValidModel, getModelUpstreamId, findModelName } from "../../open-sse/config/providerModels.js";
import { getCapabilitiesForModel } from "../../open-sse/providers/capabilities.js";
import { getModelInfoCore } from "../../open-sse/services/model.js";

describe("NVIDIA Riva Translate models", () => {
  it("includes Riva-Translate-4B-Instruct-v2 and Riva-Translate-1.6B in PROVIDER_MODELS.nvidia", () => {
    const models = PROVIDER_MODELS.nvidia || [];
    const riva4b = models.find((m) => m.id === "nvidia/riva-translate-4b-instruct-v2");
    const riva16b = models.find((m) => m.id === "nvidia/riva-translate-1.6b");

    expect(riva4b).toBeDefined();
    expect(riva4b).toMatchObject({
      id: "nvidia/riva-translate-4b-instruct-v2",
      name: "Riva Translate 4B Instruct v2",
      contextLength: 8192,
    });

    expect(riva16b).toBeDefined();
    expect(riva16b).toMatchObject({
      id: "nvidia/riva-translate-1.6b",
      name: "Riva Translate 1.6B",
      contextLength: 4096,
    });
  });

  it("exposes both models through getModelsByProviderId('nvidia')", () => {
    const models = getModelsByProviderId("nvidia");
    expect(models.some((m) => m.id === "nvidia/riva-translate-4b-instruct-v2")).toBe(true);
    expect(models.some((m) => m.id === "nvidia/riva-translate-1.6b")).toBe(true);
  });

  it("validates model IDs in various formats (with prefix, without prefix, case-insensitive, slug-tolerant)", () => {
    // 4B variants
    expect(isValidModel("nvidia", "nvidia/riva-translate-4b-instruct-v2")).toBe(true);
    expect(isValidModel("nvidia", "riva-translate-4b-instruct-v2")).toBe(true);
    expect(isValidModel("nvidia", "Riva-Translate-4B-Instruct-v2")).toBe(true);
    expect(isValidModel("nvidia", "nvidia/Riva-Translate-4B-Instruct-v2")).toBe(true);

    // 1.6B variants
    expect(isValidModel("nvidia", "nvidia/riva-translate-1.6b")).toBe(true);
    expect(isValidModel("nvidia", "riva-translate-1.6b")).toBe(true);
    expect(isValidModel("nvidia", "Riva-Translate-1.6B")).toBe(true);
    expect(isValidModel("nvidia", "Riva Translate 1.6B")).toBe(true);
    expect(isValidModel("nvidia", "nvidia/Riva Translate 1.6B")).toBe(true);
  });

  it("resolves correct upstream model ID for NVIDIA NIM API calls", () => {
    expect(getModelUpstreamId("nvidia", "nvidia/riva-translate-4b-instruct-v2")).toBe("nvidia/riva-translate-4b-instruct-v2");
    expect(getModelUpstreamId("nvidia", "riva-translate-4b-instruct-v2")).toBe("nvidia/riva-translate-4b-instruct-v2");
    expect(getModelUpstreamId("nvidia", "Riva-Translate-4B-Instruct-v2")).toBe("nvidia/riva-translate-4b-instruct-v2");

    expect(getModelUpstreamId("nvidia", "nvidia/riva-translate-1.6b")).toBe("nvidia/riva-translate-1.6b");
    expect(getModelUpstreamId("nvidia", "riva-translate-1.6b")).toBe("nvidia/riva-translate-1.6b");
    expect(getModelUpstreamId("nvidia", "Riva-Translate-1.6B")).toBe("nvidia/riva-translate-1.6b");
    expect(getModelUpstreamId("nvidia", "Riva Translate 1.6B")).toBe("nvidia/riva-translate-1.6b");
  });

  it("finds human-readable model names", () => {
    expect(findModelName("nvidia", "nvidia/riva-translate-4b-instruct-v2")).toBe("Riva Translate 4B Instruct v2");
    expect(findModelName("nvidia", "Riva-Translate-4B-Instruct-v2")).toBe("Riva Translate 4B Instruct v2");
    expect(findModelName("nvidia", "nvidia/riva-translate-1.6b")).toBe("Riva Translate 1.6B");
    expect(findModelName("nvidia", "Riva Translate 1.6B")).toBe("Riva Translate 1.6B");
  });

  it("returns correct capabilities for Riva Translate models", () => {
    const caps4b = getCapabilitiesForModel("nvidia", "nvidia/riva-translate-4b-instruct-v2");
    expect(caps4b.reasoning).toBe(false);
    expect(caps4b.contextWindow).toBe(8192);

    const caps16b = getCapabilitiesForModel("nvidia", "nvidia/riva-translate-1.6b");
    expect(caps16b.reasoning).toBe(false);
    expect(caps16b.contextWindow).toBe(4096);
  });

  it("routes aliases and bare model names to nvidia provider", async () => {
    const res4b = await getModelInfoCore("riva-translate-4b-instruct-v2");
    expect(res4b.provider).toBe("nvidia");

    const res16b = await getModelInfoCore("riva-translate-1.6b");
    expect(res16b.provider).toBe("nvidia");
  });
});
