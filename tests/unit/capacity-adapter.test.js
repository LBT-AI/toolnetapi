import { describe, it, expect } from "vitest";
import { detectRequiredCapabilities } from "../../open-sse/services/combo.js";
import {
  augmentModelsWithCapacityAdapter,
  stripHistoryForContext,
  getCapacityAdapterConfig,
} from "../../open-sse/services/capacityAdapter.js";

describe("detectRequiredCapabilities", () => {
  it("detects vision from image_url in current user turn", () => {
    const body = {
      messages: [
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi" },
        { role: "user", content: [{ type: "image_url", image_url: { url: "https://example.com/a.png" } }] },
      ],
    };
    const caps = detectRequiredCapabilities(body);
    expect(caps.has("vision")).toBe(true);
    expect(caps.has("audioInput")).toBe(false);
  });

  it("detects audioInput from audio mime in current user turn", () => {
    const body = {
      messages: [
        { role: "user", content: [{ type: "input_audio", input_audio: { data: "...", format: "mp3" } }] },
      ],
    };
    const caps = detectRequiredCapabilities(body);
    expect(caps.has("audioInput")).toBe(true);
  });

  it("ignores media in older turns (only scans current user turn)", () => {
    const body = {
      messages: [
        { role: "user", content: [{ type: "image_url", image_url: { url: "https://example.com/old.png" } }] },
        { role: "assistant", content: "I see the image" },
        { role: "user", content: "What is 2 + 2?" },
      ],
    };
    const caps = detectRequiredCapabilities(body);
    expect(caps.has("vision")).toBe(false);
  });
});

describe("Capacity Adapter Defaults & Fallbacks", () => {
  it("defaults vision and audioInput to enabled, pdf and videoInput to disabled", () => {
    const settings = { capacityAdapter: {} };
    const vision = getCapacityAdapterConfig("vision", settings);
    const audio = getCapacityAdapterConfig("audioInput", settings);
    const pdf = getCapacityAdapterConfig("pdf", settings);
    const video = getCapacityAdapterConfig("videoInput", settings);

    expect(vision.enabled).toBe(true);
    expect(audio.enabled).toBe(true);
    expect(pdf.enabled).toBe(false);
    expect(video.enabled).toBe(false);
  });

  it("augments models for vision request when original model lacks vision", () => {
    const settings = { capacityAdapter: { vision: { enabled: true, models: ["oc/mimo-v2.5-free"] } } };
    const originalModels = ["deepseek/deepseek-chat"];
    const requiredCaps = new Set(["vision"]);
    const augmented = augmentModelsWithCapacityAdapter(originalModels, requiredCaps, settings);

    expect(augmented).toContain("oc/mimo-v2.5-free");
    expect(augmented[0]).toBe("oc/mimo-v2.5-free");
  });

  it("does not augment if original model already satisfies capabilities", () => {
    const settings = { capacityAdapter: { vision: { enabled: true, models: ["oc/mimo-v2.5-free"] } } };
    const originalModels = ["openai/gpt-4o"];
    const requiredCaps = new Set(["vision"]);
    const augmented = augmentModelsWithCapacityAdapter(originalModels, requiredCaps, settings);

    expect(augmented).toEqual(originalModels);
  });

  it("prevents infinite recursion when adapter model is already present", () => {
    const settings = { capacityAdapter: { vision: { enabled: true, models: ["oc/mimo-v2.5-free"] } } };
    const modelsWithAdapter = ["oc/mimo-v2.5-free", "deepseek/deepseek-chat"];
    const requiredCaps = new Set(["vision"]);
    const augmented = augmentModelsWithCapacityAdapter(modelsWithAdapter, requiredCaps, settings);

    expect(augmented).toEqual(modelsWithAdapter);
  });
});

describe("stripHistoryForContext", () => {
  it("preserves system prompt and current user turn while trimming middle assistant/user turns", () => {
    const messages = [
      { role: "system", content: "You are a helpful assistant" },
      ...Array.from({ length: 50 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Long text turn ${i} `.repeat(500),
      })),
      { role: "user", content: [{ type: "image_url", image_url: { url: "https://example.com/current.png" } }] },
    ];
    const body = { messages };
    const stripped = stripHistoryForContext(body, 4096);

    expect(stripped.messages[0].role).toBe("system");
    const lastMsg = stripped.messages[stripped.messages.length - 1];
    expect(lastMsg.role).toBe("user");
    expect(lastMsg.content[0].type).toBe("image_url");
    expect(stripped.messages.length).toBeLessThan(messages.length);
  });
});
