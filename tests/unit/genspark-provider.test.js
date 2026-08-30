import { describe, expect, it } from "vitest";

import REGISTRY from "../../open-sse/providers/registry/index.js";
import { PROVIDERS, PROVIDER_MODELS, PROVIDER_MEDIA } from "../../open-sse/providers/index.js";
import { getImageAdapter } from "../../open-sse/handlers/imageProviders/index.js";
import { parseModel } from "../../open-sse/services/model.js";
import { handleGensparkVideoCore, handleGensparkVideoPoll } from "../../open-sse/handlers/videoCore.js";

describe("Genspark Provider", () => {
  const entry = REGISTRY.find((e) => e.id === "genspark");

  it("is registered as an apikey provider", () => {
    expect(entry).toBeDefined();
    expect(entry.category).toBe("apikey");
    expect(entry.authType).toBe("apikey");
    expect(entry.alias).toBe("genspark");
    expect(entry.aliases).toContain("gsk");
    expect(PROVIDERS["genspark"]).toBeDefined();
  });

  it("has correct transport and verification endpoint", () => {
    expect(PROVIDERS["genspark"].validateUrl).toBe("https://www.genspark.ai/api/tool_cli/me");
    expect(PROVIDERS["genspark"].baseUrl).toBe("https://www.genspark.ai/api/llm_proxy/v1/chat/completions");
  });

  it("configures media services for image and video only", () => {
    expect(entry.serviceKinds).toEqual(expect.arrayContaining(["llm", "image", "video"]));
    // Audio is not wired yet — must not be advertised until a real handler exists.
    expect(entry.serviceKinds).not.toContain("audio");
    expect(PROVIDER_MEDIA["genspark"].imageConfig.baseUrl).toBe("https://www.genspark.ai/api/tool_cli/image_generation");
    expect(PROVIDER_MEDIA["genspark"].videoConfig.baseUrl).toBe("https://www.genspark.ai/api/tool_cli/video_generation");
    expect(PROVIDER_MEDIA["genspark"].videoConfig.pollUrl).toBe("https://www.genspark.ai/api/tool_cli/task_status");
  });

  it("exposes properly categorized models with kinds", () => {
    const models = PROVIDER_MODELS["genspark"] || [];
    expect(models.length).toBeGreaterThanOrEqual(30);

    const chatModels = models.filter((m) => m.kind === "llm" || !m.kind);
    expect(chatModels.map((m) => m.id)).toEqual(expect.arrayContaining([
      "claude-opus-4-6-1m",
      "claude-sonnet-4-6",
      "claude-haiku-4-5",
      "gpt-5.4-mini",
      "grok-4.5",
      "kimi-k2p6",
      "minimax-m3",
      "gemini-3.1-pro-preview",
    ]));

    const imageModels = models.filter((m) => m.kind === "image");
    expect(imageModels.map((m) => m.id)).toEqual(expect.arrayContaining([
      "nano-banana-pro",
      "nano-banana-2",
      "nano-banana-2-flash-lite",
      "gpt-image-2",
      "fal-ai/bytedance/seedream/v5/pro",
      "xai/grok-imagine-image",
      "qwen-image-3",
      "fal-ai/flux-2-pro",
    ]));

    const videoModels = models.filter((m) => m.kind === "video");
    expect(videoModels.length).toBeGreaterThanOrEqual(14);
    expect(videoModels.map((m) => m.id)).toEqual(expect.arrayContaining([
      "kling/v3",
      "kling/o3",
      "gemini/veo3.1",
      "minimax/h3",
      "wan/v2.7",
      "vidu/q3",
      "runway/gen4_turbo",
      "pixverse/v6",
      "fal-ai/bytedance/seedance-2.0",
      "xai/grok-imagine-video",
      "alibaba/happy-horse",
      "wan/v3.0",
    ]));

    const audioModels = models.filter((m) => m.kind === "audio");
    expect(audioModels).toEqual([]);
  });

  it("resolves model prefixes correctly with subpath models", () => {
    expect(parseModel("genspark/kling/v3")).toEqual({
      provider: "genspark",
      model: "kling/v3",
      isAlias: false,
      providerAlias: "genspark",
    });

    expect(parseModel("gsk/nano-banana-pro")).toEqual({
      provider: "genspark",
      model: "nano-banana-pro",
      isAlias: false,
      providerAlias: "gsk",
    });

    expect(parseModel("genspark/fal-ai/bytedance/seedance-2.0")).toEqual({
      provider: "genspark",
      model: "fal-ai/bytedance/seedance-2.0",
      isAlias: false,
      providerAlias: "genspark",
    });
  });

  it("wires image adapter correctly", async () => {
    const adapter = getImageAdapter("genspark");
    expect(adapter).toBeDefined();
    expect(adapter.buildUrl()).toBe("https://www.genspark.ai/api/tool_cli/image_generation");

    const headers = adapter.buildHeaders({ apiKey: "gsk_test_123" });
    expect(headers["X-Api-Key"]).toBe("gsk_test_123");
    expect(headers["X-GSK-CLI-Caps"]).toBeDefined();

    const body = adapter.buildBody("genspark/nano-banana-pro", { prompt: "a cute cat", size: "1k" });
    expect(body.query).toBe("a cute cat");
    expect(body.model).toBe("nano-banana-pro");
    expect(body.image_size).toBe("1k");

    const ndjsonResp = {
      text: async () => '{"version": 1, "heartbeat": 1}\n{"version": 1, "status": "ok", "data": {"image_url": "https://img.genspark.ai/abc.png"}}',
    };
    const parsed = await adapter.parseResponse(ndjsonResp);
    expect(parsed.data.image_url).toBe("https://img.genspark.ai/abc.png");

    const normalized = adapter.normalize(parsed, "a cute cat");
    expect(normalized.data[0].url).toBe("https://img.genspark.ai/abc.png");
  });

  it("exports video core handlers", () => {
    expect(typeof handleGensparkVideoCore).toBe("function");
    expect(typeof handleGensparkVideoPoll).toBe("function");
  });

  it("keeps every registry id unique", () => {
    const ids = REGISTRY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
