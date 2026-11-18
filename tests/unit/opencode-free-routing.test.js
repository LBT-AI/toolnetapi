import { describe, expect, it } from "vitest";
import { PROVIDER_MODELS, getModelTargetFormat } from "../../open-sse/config/providerModels.js";
import { getExecutor } from "../../open-sse/executors/index.js";
import { getCapabilitiesForModel } from "../../open-sse/providers/capabilities.js";
import { FILTERS } from "../../src/app/api/providers/suggested-models/filters.js";

const EXPECTED_MODELS = [
  { id: "beam-free", name: "Beam Free", contextLength: 1048576, maxOutputTokens: 131072, tools: true, reasoning: true, vision: false },
  { id: "iceman-free", name: "Iceman Free", contextLength: 262144, maxOutputTokens: 131072, tools: true, reasoning: true, vision: false },
  { id: "hy4-flash-free", name: "Hy4 flash Free", contextLength: 1048576, maxOutputTokens: 65536, tools: true, reasoning: true, vision: true },
  { id: "flint-40b-free", name: "Flint 40B Free", contextLength: 262144, maxOutputTokens: 65536, tools: true, reasoning: true, vision: false },
  { id: "longcat-2.5-free", name: "LongCat 2.5 Free", contextLength: 1000000, maxOutputTokens: 262144, tools: true, reasoning: true, vision: true },
  { id: "glm-5.3-flash-free", name: "GLM-5.3-Flash Free", tools: true, reasoning: true, vision: true },
  { id: "inkling-2-small-free", name: "Inkling 2 Small Free", contextLength: 1048576, maxOutputTokens: 131072, tools: true, reasoning: true, vision: true },
  { id: "mimo-v2.6-flash-free", name: "MiMo-V2.6-Flash Free", contextLength: 200000, maxOutputTokens: 32000, tools: true, reasoning: true, vision: true },
  { id: "deepseek-v4.1-flash-free", name: "DeepSeek V4.1 Flash Free", contextLength: 200000, maxOutputTokens: 32000, tools: true, reasoning: true, vision: true },
  { id: "nemotron-3.5-super-vl-free", name: "Nemotron 3.5 Super VL Free", contextLength: 1048576, maxOutputTokens: 131072, tools: true, reasoning: true, vision: true },
  { id: "nemotron-3.5-lightning-free", name: "Nemotron 3.5 Lightning Free", contextLength: 262144, maxOutputTokens: 262144, tools: true, reasoning: true, vision: false },
];

const CHAT_COMPLETIONS_MODELS = EXPECTED_MODELS.map((m) => m.id);

describe("OpenCode Free model catalog", () => {
  it("contains exactly 11 expected models", () => {
    const models = PROVIDER_MODELS.opencode || [];
    const ids = models.map((m) => m.id);
    expect(ids).toEqual(CHAT_COMPLETIONS_MODELS);
    expect(ids.length).toBe(11);
  });

  it("contains no duplicate model IDs", () => {
    const ids = (PROVIDER_MODELS.opencode || []).map((m) => m.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("matches model display names and IDs", () => {
    const models = PROVIDER_MODELS.opencode || [];
    for (const exp of EXPECTED_MODELS) {
      const found = models.find((m) => m.id === exp.id);
      expect(found).toBeDefined();
      expect(found.name).toBe(exp.name);
      if (exp.contextLength) expect(found.contextLength).toBe(exp.contextLength);
      if (exp.maxOutputTokens) expect(found.maxOutputTokens).toBe(exp.maxOutputTokens);
      expect(found.supportsTools).toBe(exp.tools);
      expect(found.supportsReasoning).toBe(exp.reasoning);
      if (exp.vision) expect(found.supportsVision).toBe(true);
    }
  });

  it("resolves capabilities correctly via getCapabilitiesForModel", () => {
    for (const exp of EXPECTED_MODELS) {
      const caps = getCapabilitiesForModel("opencode", exp.id);
      expect(caps.tools).toBe(exp.tools);
      expect(caps.reasoning).toBe(exp.reasoning);
      expect(caps.vision).toBe(exp.vision);
      if (exp.contextLength) expect(caps.contextWindow).toBe(exp.contextLength);
      if (exp.maxOutputTokens) expect(caps.maxOutput).toBe(exp.maxOutputTokens);
    }
  });
});

describe("OpenCode Free dynamic model filter", () => {
  it("blocks out-of-catalog models from appearing via modelsFetcher", () => {
    const input = [
      { id: "beam-free", name: "Beam Free" },
      { id: "big-pickle", name: "Big Pickle" },
      { id: "jev-1.13-free", name: "JEV 1.13 Free" },
      { id: "random-unauthorized-free", name: "Random Free" },
      { id: "hy4-flash-free", name: "Hy4 flash Free" },
    ];
    const filtered = FILTERS["opencode-free"](input);
    const filteredIds = filtered.map((m) => m.id);
    expect(filteredIds).toEqual(["beam-free", "hy4-flash-free"]);
    expect(filteredIds).not.toContain("big-pickle");
    expect(filteredIds).not.toContain("jev-1.13-free");
    expect(filteredIds).not.toContain("random-unauthorized-free");
  });
});

describe("OpenCode Free per-model targetFormat", () => {
  it("chat completion models have no targetFormat (defaults to openai)", () => {
    for (const m of CHAT_COMPLETIONS_MODELS) {
      expect(getModelTargetFormat("opencode", m)).toBeNull();
    }
  });
});

describe("OpenCode Free executor URL routing", () => {
  const executor = getExecutor("opencode");

  it("routes chat completion models to /zen/v1/chat/completions", () => {
    for (const m of CHAT_COMPLETIONS_MODELS) {
      expect(executor.buildUrl(m)).toBe("https://opencode.ai/zen/v1/chat/completions");
    }
  });
});

describe("OpenCode Free does not affect opencode-go", () => {
  it("opencode-go executor is separate and unchanged", () => {
    const goExecutor = getExecutor("opencode-go");
    expect(goExecutor.buildUrl("deepseek-v4-pro")).toBe("https://opencode.ai/zen/go/v1/chat/completions");
    expect(goExecutor.buildUrl("mimo-v2.5")).toBe("https://opencode.ai/zen/go/v1/chat/completions");
  });

  it("opencode-go model targetFormats unchanged", () => {
    expect(getModelTargetFormat("opencode-go", "deepseek-v4-pro")).toBeNull();
    expect(getModelTargetFormat("opencode-go", "mimo-v2.5")).toBeNull();
  });
});

describe("OpenCode Free /v1/models output", () => {
  it("outputs exactly the 11 OpenCode Free models with oc/ namespace", async () => {
    const { buildModelsList } = await import("@/app/api/v1/models/route.js");
    const list = await buildModelsList(["llm"]);
    const ocModels = list.filter((m) => m.owned_by === "oc" || m.id.startsWith("oc/"));
    const ocIds = ocModels.map((m) => m.id);
    expect(ocIds).toEqual(CHAT_COMPLETIONS_MODELS.map((id) => `oc/${id}`));
    expect(ocIds.length).toBe(11);
  });
});
