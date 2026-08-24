import { describe, it, expect, afterEach } from "vitest";
import { CLI_TOOLS } from "../../src/shared/constants/cliTools.js";
import REGISTRY from "../../open-sse/providers/registry/index.js";
import { GET, POST, DELETE } from "../../src/app/api/cli-tools/bobide-settings/route.js";

describe("Bob IDE Integration", () => {
  it("should define bobide in CLI_TOOLS constants with all free models", () => {
    expect(CLI_TOOLS.bobide).toBeDefined();
    expect(CLI_TOOLS.bobide.id).toBe("bobide");
    expect(CLI_TOOLS.bobide.name).toBe("IBM Bob IDE");
    expect(CLI_TOOLS.bobide.configType).toBe("custom");
    expect(CLI_TOOLS.bobide.defaultCommand).toBe("bob");
    expect(CLI_TOOLS.bobide.defaultModels.length).toBe(14);

    const modelIds = CLI_TOOLS.bobide.defaultModels.map((m) => m.id);
    expect(modelIds).toContain("granite-code-3b");
    expect(modelIds).toContain("granite-code-8b");
    expect(modelIds).toContain("granite-code-20b");
    expect(modelIds).toContain("granite-code-34b");
    expect(modelIds).toContain("codestral-22b");
    expect(modelIds).toContain("mistral-7b");
    expect(modelIds).toContain("o3");
    expect(modelIds).toContain("claude-4-opus");
    expect(modelIds).toContain("claude-3-5-sonnet");
    expect(modelIds).toContain("gpt-4o");
    expect(modelIds).toContain("gpt-4o-mini");
    expect(modelIds).toContain("claude-3-5-haiku");
    expect(modelIds).toContain("claude-3-haiku");
    expect(modelIds).toContain("gemini-1.5-flash");
  });

  it("should contain bobide in open-sse provider REGISTRY with all 14 free models", () => {
    const found = REGISTRY.find((p) => p.id === "bobide");
    expect(found).toBeDefined();
    expect(found.models.length).toBeGreaterThanOrEqual(14);
    expect(found.models.some((m) => m.id === "granite-code-3b")).toBe(true);
    expect(found.models.some((m) => m.id === "granite-code-8b")).toBe(true);
    expect(found.models.some((m) => m.id === "granite-code-20b")).toBe(true);
    expect(found.models.some((m) => m.id === "granite-code-34b")).toBe(true);
    expect(found.models.some((m) => m.id === "codestral-22b")).toBe(true);
    expect(found.models.some((m) => m.id === "mistral-7b")).toBe(true);
    expect(found.models.some((m) => m.id === "o3")).toBe(true);
    expect(found.models.some((m) => m.id === "claude-4-opus")).toBe(true);
    expect(found.models.some((m) => m.id === "claude-3-5-sonnet")).toBe(true);
    expect(found.models.some((m) => m.id === "gpt-4o")).toBe(true);
    expect(found.models.some((m) => m.id === "gpt-4o-mini")).toBe(true);
    expect(found.models.some((m) => m.id === "claude-3-5-haiku")).toBe(true);
    expect(found.models.some((m) => m.id === "claude-3-haiku")).toBe(true);
    expect(found.models.some((m) => m.id === "gemini-1.5-flash")).toBe(true);
  });

  describe("bobide-settings API handlers", () => {
    afterEach(async () => {
      try {
        await DELETE();
      } catch {
        // ignore
      }
    });

    it("handles POST to save custom models and settings", async () => {
      const mockReq = {
        json: async () => ({
          baseUrl: "http://127.0.0.1:20128",
          apiKey: "sk-test-key",
          models: ["granite-code-3b", "claude-3-5-sonnet"],
          activeModel: "granite-code-3b",
        }),
      };

      const res = await POST(mockReq);
      const data = await res.json();
      expect(data.success).toBe(true);

      const getRes = await GET();
      const getData = await getRes.json();
      expect(getData.installed).toBe(true);
      expect(getData.hasToolNetAPI).toBe(true);
      expect(getData.settings.customModels.length).toBe(2);
      expect(getData.settings["bob.api.baseUrl"]).toBe("http://127.0.0.1:20128/v1");
      expect(getData.settings["bob.api.apiKey"]).toBe("sk-test-key");
    });

    it("handles DELETE to remove ToolNet API settings", async () => {
      const mockReq = {
        json: async () => ({
          baseUrl: "http://127.0.0.1:20128",
          apiKey: "sk-test-key",
          models: ["granite-code-3b"],
        }),
      };
      await POST(mockReq);

      const delRes = await DELETE();
      const delData = await delRes.json();
      expect(delData.success).toBe(true);

      const getRes = await GET();
      const getData = await getRes.json();
      expect(getData.hasToolNetAPI).toBe(false);
      expect(getData.settings["bob.api.baseUrl"]).toBeUndefined();
    });
  });
});
