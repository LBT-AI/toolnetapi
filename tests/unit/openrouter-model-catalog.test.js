import { describe, it, expect } from "vitest";
import REGISTRY from "../../open-sse/providers/registry/index.js";
import openrouterRegistry from "../../open-sse/providers/registry/openrouter.js";
import { FILTERS } from "../../src/app/api/providers/suggested-models/filters.js";
import { isValidModel, getModelsByProviderId } from "../../src/shared/constants/models.js";

describe("OpenRouter Model Catalog & Integration Audit", () => {
  describe("Provider Registry & Transport", () => {
    it("ensures openrouter is registered with correct priority, category, and alias", () => {
      const reg = REGISTRY.find((p) => p.id === "openrouter");
      expect(reg).toBeDefined();
      expect(reg.id).toBe("openrouter");
      expect(reg.alias).toBe("openrouter");
      expect(reg.aliases).toContain("or");
      expect(reg.category).toBe("freeTier");
      expect(reg.authType).toBe("apikey");
      expect(reg.transport.baseUrl).toBe("https://openrouter.ai/api/v1/chat/completions");
      expect(reg.passthroughModels).toBe(true);
    });

    it("has modelsFetcher configured with openrouter-free filter", () => {
      expect(openrouterRegistry.modelsFetcher).toEqual({
        url: "https://openrouter.ai/api/v1/models",
        type: "openrouter-free",
      });
    });
  });

  describe("Model Catalog Verification", () => {
    it("contains all active verified OpenRouter free models", () => {
      const models = openrouterRegistry.models;
      const freeModelIds = [
        "openrouter/free",
        "recursive/flint-v1.0:free",
        "xingchen-agi/xing4.0-29b-a4b:free",
        "nvidia/nemotron-3.5-super-vl:free",
        "dots-studio/dots-3-note-preview:free",
        "liquid/lfm-2.5-2.6b:free",
        "nvidia/nemotron-3.5-lightning:free",
        "thinkingmachines/inkling-small:free",
        "thinkingmachines/inkling:free",
        "poolside/laguna-s-2.1:free",
        "poolside/laguna-xs-2.1:free",
        "cohere/north-mini-code:free",
        "nvidia/nemotron-3.5-content-safety:free",
        "nvidia/nemotron-3-ultra-550b-a55b:free",
        "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
        "google/gemma-4-26b-a4b-it:free",
        "google/gemma-4-31b-it:free",
        "google/lyria-3-pro-preview",
        "google/lyria-3-clip-preview",
        "nvidia/nemotron-3-super-120b-a12b:free",
      ];

      for (const id of freeModelIds) {
        const found = models.find((m) => m.id === id);
        expect(found, `Expected free model ${id} to exist in OpenRouter catalog`).toBeDefined();
        expect(found.isFree).toBe(true);
      }
    });

    it("contains popular flagship LLM models (Claude, GPT, Gemini, DeepSeek, Llama, Qwen, MiniMax, Mistral)", () => {
      const models = openrouterRegistry.models;
      const flagshipIds = [
        "anthropic/claude-sonnet-5.5",
        "anthropic/claude-opus-5.5",
        "anthropic/claude-haiku-5.5",
        "openai/gpt-4o",
        "openai/gpt-4o-mini",
        "openai/o1",
        "openai/o3",
        "openai/o3-mini",
        "deepseek/deepseek-chat",
        "deepseek/deepseek-v4.1-flash",
        "google/gemini-2.5-pro",
        "google/gemini-2.5-flash",
        "meta-llama/llama-3.3-70b-instruct",
        "qwen/qwen-2.5-72b-instruct",
        "minimax/minimax-m3.1-flash",
        "mistralai/mistral-large-2407",
      ];

      for (const id of flagshipIds) {
        const found = models.find((m) => m.id === id);
        expect(found, `Expected flagship model ${id} to exist in OpenRouter catalog`).toBeDefined();
        expect(found.contextLength).toBeGreaterThan(0);
      }
    });

    it("preserves multimodal embeddings, TTS, and image generation models", () => {
      const models = openrouterRegistry.models;
      const embeddings = models.filter((m) => m.kind === "embedding");
      const tts = models.filter((m) => m.kind === "tts");
      const images = models.filter((m) => m.kind === "image");

      expect(embeddings.length).toBeGreaterThanOrEqual(7);
      expect(tts.length).toBeGreaterThanOrEqual(3);
      expect(images.length).toBeGreaterThanOrEqual(4);
    });

    it("exposes models via getModelsByProviderId", () => {
      const providerModels = getModelsByProviderId("openrouter");
      expect(providerModels.length).toBeGreaterThan(40);
      expect(providerModels.some((m) => m.id === "openrouter/free")).toBe(true);
      expect(providerModels.some((m) => m.id === "openai/gpt-4o")).toBe(true);
    });

    it("allows passthrough of arbitrary models for openrouter", () => {
      expect(isValidModel("openrouter", "any/custom-future-model")).toBe(true);
    });
  });

  describe("Dynamic Suggested Models Filter", () => {
    it("filters free models without dropping models with context < 200k", () => {
      const rawApiModels = [
        {
          id: "liquid/lfm-2.5-2.6b:free",
          name: "LiquidAI LFM 2.5",
          context_length: 65536,
          pricing: { prompt: "0", completion: "0" },
          supported_parameters: ["tools", "reasoning"],
          architecture: { input_modalities: ["text"] },
        },
        {
          id: "nvidia/nemotron-3.5-super-vl:free",
          name: "Nemotron Super VL",
          context_length: 1000000,
          pricing: { prompt: "0", completion: "0" },
          supported_parameters: ["tools", "reasoning"],
          architecture: { input_modalities: ["text", "image"] },
        },
        {
          id: "expensive/paid-model",
          name: "Expensive Model",
          context_length: 200000,
          pricing: { prompt: "0.001", completion: "0.002" },
        },
      ];

      const result = FILTERS["openrouter-free"](rawApiModels);
      expect(result.length).toBe(2);
      expect(result[0].id).toBe("nvidia/nemotron-3.5-super-vl:free");
      expect(result[0].supportsVision).toBe(true);
      expect(result[0].supportsTools).toBe(true);
      expect(result[0].supportsReasoning).toBe(true);

      expect(result[1].id).toBe("liquid/lfm-2.5-2.6b:free");
      expect(result[1].contextLength).toBe(65536);
      expect(result[1].supportsVision).toBe(false);
    });
  });
});
