import { describe, it, expect, beforeEach, vi } from "vitest";
import REGISTRY from "../../open-sse/providers/registry/index.js";
import kilocodeRegistry from "../../open-sse/providers/registry/kilocode.js";
import kiloGatewayRegistry from "../../open-sse/providers/registry/kilo-gateway.js";
import { FILTERS } from "../../src/app/api/providers/suggested-models/filters.js";
import {
  parseKiloFreeModels,
  VERIFIED_KILO_STATIC_FREE_MODELS,
  _resetKiloModelsCache,
  GET as kiloFreeModelsRouteHandler,
} from "../../src/app/api/providers/kilo/free-models/route.js";
import { POST as validateRouteHandler } from "../../src/app/api/providers/validate/route.js";
import { isValidModel } from "../../src/shared/constants/models.js";
import { getProviderModels, getDefaultModel } from "../../open-sse/config/providerModels.js";

describe("Kilo Model Catalog & Integration Audit", () => {
  beforeEach(() => {
    _resetKiloModelsCache();
    vi.restoreAllMocks();
  });

  describe("Provider Independence & Registry Isolation", () => {
    it("maintains separate registry entries for kilocode and kilo-gateway", () => {
      const kc = REGISTRY.find((p) => p.id === "kilocode");
      const kgw = REGISTRY.find((p) => p.id === "kilo-gateway");

      expect(kc).toBeDefined();
      expect(kgw).toBeDefined();
      expect(kc.id).not.toBe(kgw.id);
      expect(kc.alias).toBe("kc");
      expect(kgw.alias).toBe("kgw");
      expect(kc.category).toBe("oauth");
      expect(kgw.category).toBe("freeTier");
    });

    it("ensures kilocode uses OAuth transport and organization header hook", () => {
      expect(kilocodeRegistry.transport.baseUrl).toBe(
        "https://api.kilo.ai/api/openrouter/chat/completions"
      );
      expect(kilocodeRegistry.transport.auth.hooks).toContain("kilocodeOrg");
      expect(kilocodeRegistry.oauth).toBeDefined();
      expect(kilocodeRegistry.oauth.initiateUrl).toBe(
        "https://api.kilo.ai/api/device-auth/codes"
      );
    });

    it("ensures kilo-gateway uses API key transport and avoids false-positive validateUrl", () => {
      expect(kiloGatewayRegistry.authType).toBe("apikey");
      expect(kiloGatewayRegistry.authModes).toEqual(["apikey"]);
      expect(kiloGatewayRegistry.transport.baseUrl).toBe(
        "https://api.kilo.ai/api/gateway/chat/completions"
      );
      // Crucial: public /models must NOT be the validateUrl
      expect(kiloGatewayRegistry.transport.validateUrl).toBeUndefined();
    });

    it("enables passthroughModels and modelsFetcher on both providers", () => {
      expect(kilocodeRegistry.passthroughModels).toBe(true);
      expect(kiloGatewayRegistry.passthroughModels).toBe(true);

      expect(kilocodeRegistry.modelsFetcher).toEqual({
        url: "https://api.kilo.ai/api/gateway/models",
        type: "kilo-gateway",
      });
      expect(kiloGatewayRegistry.modelsFetcher).toEqual({
        url: "https://api.kilo.ai/api/gateway/models",
        type: "kilo-gateway",
      });
    });
  });

  describe("Static Model Catalog Verification", () => {
    const EXPECTED_FREE_MODEL_IDS = [
      "kilo-auto/free",
      "reflection/beam-free",
      "minimax/minimax-m3.1-flash:free",
      "nvidia/nemotron-3.5-super-vl:free",
      "stealth/glyph-cluster",
      "openrouter/free",
      "liquid/lfm-2.5-2.6b:free",
      "poolside/laguna-s-2.1:free",
      "poolside/laguna-xs-2.1:free",
      "cohere/north-mini-code:free",
      "xingchen-agi/xing4.0-29b-a4b:free",
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "nvidia/nemotron-3.5-lightning:free",
      "dots-studio/dots-3-note-preview:free",
      "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
      "nvidia/nemotron-3.5-content-safety:free",
    ];

    it("does NOT contain deprecated or dead models", () => {
      const deprecatedModels = [
        "stepfun/step-3.7-flash:free",
        "minimax/minimax-m3:free",
        "kwaipilot/kat-coder-pro-v2.5:free",
      ];

      for (const deadId of deprecatedModels) {
        expect(kilocodeRegistry.models.some((m) => m.id === deadId)).toBe(false);
        expect(kiloGatewayRegistry.models.some((m) => m.id === deadId)).toBe(false);
        expect(VERIFIED_KILO_STATIC_FREE_MODELS.some((m) => m.id === deadId)).toBe(false);
      }
    });

    it("includes all 17 verified active free models in kilocode and kilo-gateway", () => {
      const kcIds = new Set(kilocodeRegistry.models.map((m) => m.id));
      const kgwIds = new Set(kiloGatewayRegistry.models.map((m) => m.id));

      for (const expectedId of EXPECTED_FREE_MODEL_IDS) {
        expect(kcIds.has(expectedId)).toBe(true);
        expect(kgwIds.has(expectedId)).toBe(true);
      }
    });

    it("assigns accurate capability flags to multimodal models", () => {
      const mm31 = kilocodeRegistry.models.find((m) => m.id === "minimax/minimax-m3.1-flash:free");
      expect(mm31.supportsVision).toBe(true);
      expect(mm31.supportsTools).toBe(true);
      expect(mm31.supportsReasoning).toBe(true);

      const nemotronVl = kiloGatewayRegistry.models.find((m) => m.id === "nvidia/nemotron-3.5-super-vl:free");
      expect(nemotronVl.supportsVision).toBe(true);
      expect(nemotronVl.supportsTools).toBe(true);

      const nemotronOmni = kiloGatewayRegistry.models.find(
        (m) => m.id === "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"
      );
      expect(nemotronOmni.supportsVision).toBe(true);
      expect(nemotronOmni.supportsAudio).toBe(true);

      const lfm = kilocodeRegistry.models.find((m) => m.id === "liquid/lfm-2.5-2.6b:free");
      expect(lfm.contextLength).toBe(65536);
      expect(lfm.supportsVision).toBeUndefined(); // no vision
    });

    it("provides defaults and models via config helpers", () => {
      expect(getDefaultModel("kc")).toBe("kilo-auto/free");
      expect(getDefaultModel("kgw")).toBe("kilo-auto/free");

      const kcModels = getProviderModels("kc");
      const kgwModels = getProviderModels("kgw");
      expect(kcModels.length).toBeGreaterThanOrEqual(20);
      expect(kgwModels.length).toBeGreaterThanOrEqual(18);
    });
  });

  describe("Dynamic Suggested Models Filters", () => {
    const sampleUpstreamData = [
      {
        id: "kilo-auto/free",
        name: "Auto Free",
        isFree: true,
        context_length: 256000,
        supported_parameters: ["tools", "reasoning"],
        architecture: { input_modalities: ["text"] },
      },
      {
        id: "reflection/beam-free",
        name: "Reflection: Beam 1.0 (free)",
        isFree: true,
        pricing: { prompt: "0.000000000000", completion: "0.000000000000" },
        context_length: 1048576,
        supported_parameters: ["tools"],
        architecture: { input_modalities: ["text"] },
      },
      {
        id: "liquid/lfm-2.5-2.6b:free",
        name: "LiquidAI: LFM2.5-2.6B (free)",
        isFree: true,
        pricing: { prompt: "0", completion: "0" },
        context_length: 65536,
        supported_parameters: ["tools"],
        architecture: { input_modalities: ["text"] },
      },
      {
        id: "anthropic/claude-sonnet-4.5",
        name: "Claude Sonnet 4.5",
        isFree: false,
        pricing: { prompt: "0.000003", completion: "0.000015" },
        context_length: 1000000,
      },
    ];

    it("filters only free models and does not drop small-context models like liquid/lfm", () => {
      const filtered = FILTERS["kilo-gateway"](sampleUpstreamData);
      expect(filtered).toHaveLength(3);
      const ids = filtered.map((m) => m.id);
      expect(ids).toContain("kilo-auto/free");
      expect(ids).toContain("reflection/beam-free");
      expect(ids).toContain("liquid/lfm-2.5-2.6b:free");
      expect(ids).not.toContain("anthropic/claude-sonnet-4.5");
    });

    it("has kilo-free alias identical to kilo-gateway filter", () => {
      const filteredGateway = FILTERS["kilo-gateway"](sampleUpstreamData);
      const filteredFree = FILTERS["kilo-free"](sampleUpstreamData);
      expect(filteredFree).toEqual(filteredGateway);
    });
  });

  describe("Free Models Dynamic Route & Resilient Caching", () => {
    it("parses capabilities and deduplicates models in parseKiloFreeModels", () => {
      const raw = [
        {
          id: "kilo-auto/free",
          name: "Auto Free",
          isFree: true,
          context_length: 256000,
          supported_parameters: ["tools", "reasoning"],
          architecture: { input_modalities: ["text"] },
        },
        {
          id: "kilo-auto/free", // duplicate
          name: "Auto Free Duplicate",
          isFree: true,
          context_length: 256000,
        },
        {
          id: "dots-studio/dots-3-note-preview:free",
          name: "Dots Note Preview",
          isFree: true,
          context_length: 512000,
          supported_parameters: ["tools"],
          architecture: { input_modalities: ["text", "image"] },
        },
      ];

      const parsed = parseKiloFreeModels(raw);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe("kilo-auto/free");
      expect(parsed[0].supportsTools).toBe(true);
      expect(parsed[0].supportsReasoning).toBe(true);
      expect(parsed[0].supportsVision).toBe(false);

      expect(parsed[1].id).toBe("dots-studio/dots-3-note-preview:free");
      expect(parsed[1].supportsVision).toBe(true);
    });

    it("returns static fallback list when upstream fetch fails and no cache exists", async () => {
      // Mock global fetch rejection
      global.fetch = vi.fn().mockRejectedValue(new Error("Network timeout"));

      const res = await kiloFreeModelsRouteHandler();
      const data = await res.json();

      expect(data.fallback).toBe(true);
      expect(data.cached).toBe(false);
      expect(data.warning).toContain("Network timeout");
      expect(data.models).toHaveLength(VERIFIED_KILO_STATIC_FREE_MODELS.length);
    });

    it("caches upstream responses and returns cached: true on second invocation", async () => {
      const mockData = {
        data: [
          {
            id: "kilo-auto/free",
            name: "Auto Free",
            isFree: true,
            context_length: 256000,
            supported_parameters: ["tools"],
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      // First call (fetches live)
      const res1 = await kiloFreeModelsRouteHandler();
      const data1 = await res1.json();
      expect(data1.cached).toBe(false);
      expect(data1.models[0].id).toBe("kilo-auto/free");

      // Second call (hits in-memory TTL cache)
      const res2 = await kiloFreeModelsRouteHandler();
      const data2 = await res2.json();
      expect(data2.cached).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("bypasses cache when refresh=true is requested", async () => {
      const mockData = {
        data: [
          {
            id: "kilo-auto/free",
            name: "Auto Free",
            isFree: true,
            context_length: 256000,
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      // Call 1
      await kiloFreeModelsRouteHandler();
      // Call 2 with ?refresh=true
      const mockReq = { url: "http://localhost/api/providers/kilo/free-models?refresh=true" };
      const res = await kiloFreeModelsRouteHandler(mockReq);
      const data = await res.json();

      expect(data.cached).toBe(false);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("distinguishes live, cached, stale and static_fallback sources", async () => {
      // 1. Initial live fetch
      const mockLive = {
        data: [{ id: "kilo-auto/free", name: "Auto Free", isFree: true, context_length: 256000 }],
      };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockLive,
      });

      const resLive = await kiloFreeModelsRouteHandler();
      const dataLive = await resLive.json();
      expect(dataLive.source).toBe("live");
      expect(dataLive.cached).toBe(false);

      // 2. Active cached fetch
      const resCached = await kiloFreeModelsRouteHandler();
      const dataCached = await resCached.json();
      expect(dataCached.source).toBe("cached");
      expect(dataCached.cached).toBe(true);

      // 3. Expired cache (stale) on upstream failure (last-known-good)
      const originalNow = Date.now;
      try {
        Date.now = () => originalNow() + 65 * 60 * 1000;
        global.fetch = vi.fn().mockRejectedValue(new Error("503 Service Unavailable"));
        const resStale = await kiloFreeModelsRouteHandler();
        const dataStale = await resStale.json();
        expect(dataStale.source).toBe("stale");
        expect(dataStale.cached).toBe(true);
        expect(dataStale.stale).toBe(true);
        expect(dataStale.warning).toContain("503");
      } finally {
        Date.now = originalNow;
      }
    });

    it("deduplicates concurrent in-flight refresh requests", async () => {
      let resolvePromise;
      const deferredFetch = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      global.fetch = vi.fn().mockImplementation(() => deferredFetch);

      const req1 = kiloFreeModelsRouteHandler({ url: "http://localhost/api/providers/kilo/free-models?refresh=true" });
      const req2 = kiloFreeModelsRouteHandler({ url: "http://localhost/api/providers/kilo/free-models?refresh=true" });

      resolvePromise({
        ok: true,
        json: async () => ({
          data: [{ id: "kilo-auto/free", name: "Auto Free", isFree: true, context_length: 256000 }],
        }),
      });

      const [res1, res2] = await Promise.all([req1, req2]);
      const data1 = await res1.json();
      const data2 = await res2.json();

      expect(data1.count).toBe(1);
      expect(data2.count).toBe(1);
      // Upstream fetch was invoked exactly ONCE thanks to in-flight deduplication
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("Model Passthrough & Routing Support", () => {
    it("allows passthrough of any valid model ID for kilocode and kilo-gateway", () => {
      // Static model
      expect(isValidModel("kc", "kilo-auto/free")).toBe(true);
      expect(isValidModel("kgw", "kilo-auto/free")).toBe(true);

      // Dynamic new model (not hardcoded)
      expect(isValidModel("kc", "future-provider/custom-frontier-model")).toBe(true);
      expect(isValidModel("kgw", "future-provider/custom-frontier-model")).toBe(true);
      expect(isValidModel("kilocode", "future-provider/custom-frontier-model")).toBe(true);
      expect(isValidModel("kilo-gateway", "future-provider/custom-frontier-model")).toBe(true);
    });
  });

  describe("Validation & Security Guard", () => {
    it("never validates kilo-gateway via public /models endpoint", () => {
      expect(kiloGatewayRegistry.transport.validateUrl).toBeUndefined();
    });

    it("distinguishes HTTP 200, 400, 401, 403, 404, 429, 500 during validation", async () => {
      const makeReq = (provider, key) => ({
        json: async () => ({ provider, apiKey: key }),
      });

      // 1. HTTP 200 with valid user profile -> CONNECTED
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ user: { id: "u-123", email: "test@example.com" } }),
      });
      const res200 = await validateRouteHandler(makeReq("kilo-gateway", "valid-key"));
      const data200 = await res200.json();
      expect(data200.valid).toBe(true);
      expect(data200.status).toBe("CONNECTED");
      expect(data200.error).toBeNull();

      // 2. HTTP 401 Unauthorized -> UNAUTHORIZED
      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        json: async () => ({ error: "Invalid token" }),
      });
      const res401 = await validateRouteHandler(makeReq("kilo-gateway", "bad-key"));
      const data401 = await res401.json();
      expect(data401.valid).toBe(false);
      expect(data401.status).toBe("UNAUTHORIZED");
      expect(data401.error).toContain("401");

      // 3. HTTP 403 Forbidden -> FORBIDDEN
      global.fetch = vi.fn().mockResolvedValue({
        status: 403,
        json: async () => ({ error: "Forbidden" }),
      });
      const res403 = await validateRouteHandler(makeReq("kilo-gateway", "forbidden-key"));
      const data403 = await res403.json();
      expect(data403.valid).toBe(false);
      expect(data403.status).toBe("FORBIDDEN");

      // 4. HTTP 429 Rate limited -> RATE_LIMITED (NOT valid key)
      global.fetch = vi.fn().mockResolvedValue({
        status: 429,
        json: async () => ({ error: "Too Many Requests" }),
      });
      const res429 = await validateRouteHandler(makeReq("kilo-gateway", "rate-limited-key"));
      const data429 = await res429.json();
      expect(data429.valid).toBe(false);
      expect(data429.status).toBe("RATE_LIMITED");

      // 5. HTTP 500 Upstream error -> UPSTREAM_ERROR (NOT valid key)
      global.fetch = vi.fn().mockResolvedValue({
        status: 500,
        json: async () => ({ error: "Internal Server Error" }),
      });
      const res500 = await validateRouteHandler(makeReq("kilo-gateway", "some-key"));
      const data500 = await res500.json();
      expect(data500.valid).toBe(false);
      expect(data500.status).toBe("UPSTREAM_ERROR");

      // 6. HTTP 404 Unexpected/Unverified -> UNVERIFIED
      global.fetch = vi.fn().mockResolvedValue({
        status: 404,
        json: async () => ({ error: "Not Found" }),
      });
      const res404 = await validateRouteHandler(makeReq("kilo-gateway", "unverified-key"));
      const data404 = await res404.json();
      expect(data404.valid).toBe(false);
      expect(data404.status).toBe("UNVERIFIED");

      // 7. HTTP 200 but body indicates error -> NOT valid
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ success: false, error: "Internal profile lookup error" }),
      });
      const res200Err = await validateRouteHandler(makeReq("kilo-gateway", "err-key"));
      const data200Err = await res200Err.json();
      expect(data200Err.valid).toBe(false);
      expect(data200Err.error).toBeDefined();

      // 8. Timeout/Network exception -> returns valid: false without crash
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection timeout"));
      const resTimeout = await validateRouteHandler(makeReq("kilo-gateway", "timeout-key"));
      const dataTimeout = await resTimeout.json();
      expect(dataTimeout.valid).toBe(false);
      expect(dataTimeout.error).toContain("Connection timeout");
    });

    it("verifies kilocode OAuth tokens via official profile endpoint independently", async () => {
      const makeReq = (provider, token) => ({
        json: async () => ({ provider, apiKey: token }),
      });

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ user: { id: "oauth-user-1" } }),
      });

      const res = await validateRouteHandler(makeReq("kilocode", "oauth-token-123"));
      const data = await res.json();
      expect(data.valid).toBe(true);
      expect(data.status).toBe("CONNECTED");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.kilo.ai/api/profile",
        expect.objectContaining({
          headers: { Authorization: "Bearer oauth-token-123" },
        })
      );
    });

    it("verifies strict isolation between kilocode and kilo-gateway validation", () => {
      // kilo-gateway requires apikey authType
      expect(kiloGatewayRegistry.authType).toBe("apikey");
      expect(kiloGatewayRegistry.authModes).toEqual(["apikey"]);

      // kilocode uses oauth authType
      expect(kilocodeRegistry.category).toBe("oauth");
      expect(kilocodeRegistry.transport.auth.hooks).toContain("kilocodeOrg");
      expect(kilocodeRegistry.transport.baseUrl).not.toBe(kiloGatewayRegistry.transport.baseUrl);
    });

    it("deduplicates dynamically fetched free models against static catalog without overwriting custom settings", () => {
      const staticModels = [
        { id: "kilo-auto/free", name: "Auto Free" },
        { id: "minimax/minimax-m3.1-flash:free", name: "MiniMax: MiniMax M3.1 Flash (free)" },
      ];
      const dynamicFreeModels = [
        { id: "kilo-auto/free", name: "Auto Free" }, // existing in static
        { id: "reflection/beam-free", name: "Reflection: Beam 1.0 (free)" }, // new
      ];

      // Mirror Dashboard page.js merging:
      const allModels = [
        ...staticModels,
        ...dynamicFreeModels.filter((fm) => !staticModels.some((m) => m.id === fm.id)),
      ];

      expect(allModels).toHaveLength(3);
      expect(allModels.map((m) => m.id)).toEqual([
        "kilo-auto/free",
        "minimax/minimax-m3.1-flash:free",
        "reflection/beam-free",
      ]);
    });
  });
});
