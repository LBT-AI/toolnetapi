import { describe, it, expect } from "vitest";
import { normalizeGroqModelId } from "open-sse/services/groqNormalize.js";
import {
  selectGroqHealthCheckModel,
  STATIC_GROQ_MODELS,
  resolveGroqModels,
} from "open-sse/services/groqModels.js";
import { getCapabilitiesForModel } from "open-sse/providers/capabilities.js";
import groqProvider from "open-sse/providers/registry/groq.js";
import { getProviderModels, getModelUpstreamId } from "open-sse/config/providerModels.js";

describe("Groq Models & Normalization", () => {
  it("normalizes Groq model IDs correctly", () => {
    // Model IDs that should NOT have groq/ prefix upstream
    expect(normalizeGroqModelId("groq/qwen/qwen3.8-27b")).toBe("qwen/qwen3.8-27b");
    expect(normalizeGroqModelId("qwen/qwen3.8-27b")).toBe("qwen/qwen3.8-27b");
    expect(normalizeGroqModelId("groq/openai/gpt-oss-120b")).toBe("openai/gpt-oss-120b");
    expect(normalizeGroqModelId("openai/gpt-oss-120b")).toBe("openai/gpt-oss-120b");
    expect(normalizeGroqModelId("groq/whisper-large-v3")).toBe("whisper-large-v3");

    // Model IDs that MUST have groq/ prefix upstream
    expect(normalizeGroqModelId("compound")).toBe("groq/compound");
    expect(normalizeGroqModelId("groq/compound")).toBe("groq/compound");
    expect(normalizeGroqModelId("compound-mini")).toBe("groq/compound-mini");
    expect(normalizeGroqModelId("groq/compound-mini")).toBe("groq/compound-mini");

    // Preserves thinking suffix
    expect(normalizeGroqModelId("groq/qwen/qwen3.8-27b(high)")).toBe("qwen/qwen3.8-27b(high)");
    expect(normalizeGroqModelId("compound(low)")).toBe("groq/compound(low)");
  });

  it("selects health check model according to preference order", () => {
    const models1 = [
      { id: "whisper-large-v3" },
      { id: "openai/gpt-oss-120b" },
      { id: "qwen/qwen3.8-27b" },
    ];
    // Highest preference is qwen/qwen3.8-27b
    expect(selectGroqHealthCheckModel(models1)).toBe("qwen/qwen3.8-27b");

    const models2 = [
      { id: "whisper-large-v3" },
      { id: "openai/gpt-oss-120b" },
      { id: "openai/gpt-oss-20b" },
    ];
    // Next preference is openai/gpt-oss-20b
    expect(selectGroqHealthCheckModel(models2)).toBe("openai/gpt-oss-20b");

    const models3 = [
      { id: "whisper-large-v3" },
      { id: "openai/gpt-oss-120b" },
    ];
    // Third preference is openai/gpt-oss-120b
    expect(selectGroqHealthCheckModel(models3)).toBe("openai/gpt-oss-120b");

    // Falls back to another valid text model, excluding whisper/prompt-guard
    const models4 = [
      { id: "whisper-large-v3" },
      { id: "meta-llama/llama-prompt-guard-2-86m" },
      { id: "allam-2-7b" },
    ];
    expect(selectGroqHealthCheckModel(models4)).toBe("allam-2-7b");
  });

  it("returns capabilities for Groq models", () => {
    const qwenCaps = getCapabilitiesForModel("groq", "qwen/qwen3.8-27b");
    expect(qwenCaps.vision).toBe(true);
    expect(qwenCaps.tools).toBe(true);
    expect(qwenCaps.reasoning).toBe(true);
    expect(qwenCaps.contextWindow).toBe(131042);
    expect(qwenCaps.maxOutput).toBe(16384);

    const gpt120bCaps = getCapabilitiesForModel("groq", "openai/gpt-oss-120b");
    expect(gpt120bCaps.tools).toBe(true);
    expect(gpt120bCaps.reasoning).toBe(true);
    expect(gpt120bCaps.contextWindow).toBe(131072);
    expect(gpt120bCaps.maxOutput).toBe(65536);

    const compoundCaps = getCapabilitiesForModel("groq", "groq/compound");
    expect(compoundCaps.contextWindow).toBe(131072);
  });

  it("registry contains active models and excludes decommissioned ones", () => {
    const modelIds = groqProvider.models.map((m) => m.id);
    expect(modelIds).toContain("qwen/qwen3.8-27b");
    expect(modelIds).toContain("openai/gpt-oss-20b");
    expect(modelIds).toContain("openai/gpt-oss-120b");
    expect(modelIds).toContain("compound");
    expect(modelIds).toContain("compound-mini");

    // Decommissioned models must NOT be in registry
    expect(modelIds).not.toContain("llama-3.3-70b-versatile");
    expect(modelIds).not.toContain("llama-3.1-8b-instant");
    expect(modelIds).not.toContain("qwen/qwen3.6-27b");
  });

  it("providerModels resolves upstream IDs correctly", () => {
    const models = getProviderModels("groq");
    expect(models.length).toBeGreaterThan(0);

    const upstream = getModelUpstreamId("groq", "groq/qwen/qwen3.8-27b");
    expect(upstream).toBe("qwen/qwen3.8-27b");

    const upstreamCompound = getModelUpstreamId("groq", "compound");
    expect(upstreamCompound).toBe("groq/compound");
  });
});
