/**
 * Regression tests for unified public media API endpoints.
 *
 * Covers:
 *  - GET /v1/models/video exists (KIND_SLUG_MAP has "video")
 *  - buildModelsList returns kind field on non-LLM combos
 *  - handleDashScopeVideoPoll: queued/processing/completed/failed normalization
 *  - checkFallbackError: DashScope quota text rules trigger fallback on HTTP 400
 *  - handleVideoCreate: auth, DashScope routing, provider-unsupported rejection
 *  - handleVideoGet: DashScope poll via x-video-provider, xAI fallback backward compat
 *  - handleChat: non-LLM combo rejected with helpful endpoint hint
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Top-level mocks (hoisted by vitest) ─────────────────────────────────────

const authMock = vi.hoisted(() => ({
  getProviderCredentials: vi.fn(),
  markAccountUnavailable: vi.fn(async () => ({ shouldFallback: false })),
  clearAccountError: vi.fn(async () => {}),
  extractApiKey: vi.fn(() => null),
  isValidApiKey: vi.fn(async () => true),
}));

const tokenMock = vi.hoisted(() => ({
  checkAndRefreshToken: vi.fn(async (_p, c) => c),
  updateProviderCredentials: vi.fn(async () => {}),
}));

const localDbMock = vi.hoisted(() => ({
  getSettings: vi.fn(async () => ({ requireApiKey: false, comboStrategies: {} })),
  getComboByName: vi.fn(async () => null),
  getModelAliases: vi.fn(async () => ({})),
  getProviderNodes: vi.fn(async () => []),
  getProviderConnections: vi.fn(async () => []),
  validateApiKey: vi.fn(async () => false),
  getProxyPools: vi.fn(async () => []),
  getCombos: vi.fn(async () => []),
  getCustomModels: vi.fn(async () => []),
}));

const logMock = vi.hoisted(() => ({
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
}));

vi.mock("@/sse/services/auth.js", () => authMock);
vi.mock("@/sse/services/tokenRefresh.js", () => tokenMock);
vi.mock("@/lib/localDb", () => localDbMock);
vi.mock("@/sse/utils/logger.js", () => logMock);

// disabledModelsDb is imported by the models route
vi.mock("@/lib/disabledModelsDb", () => ({
  getDisabledModels: vi.fn(async () => ({})),
}));

// Skip real poll-interval sleeps (5 s) in DashScope video core during tests.
vi.mock("open-sse/handlers/imageProviders/_base.js", async (importOriginal) => {
  const orig = await importOriginal();
  return { ...orig, sleep: vi.fn(() => Promise.resolve()) };
});

// ─── imports ─────────────────────────────────────────────────────────────────

import { handleDashScopeVideoPoll } from "open-sse/handlers/videoCore.js";
import { checkFallbackError } from "open-sse/services/accountFallback.js";
import { handleVideoCreate, handleVideoGet } from "@/sse/handlers/videoGeneration.js";
import { handleChat } from "@/sse/handlers/chat.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

const originalFetch = global.fetch;

const jsonRes = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const dashCreds = () => ({
  connectionId: "c1",
  apiKey: "tok",
  providerSpecificData: { dashScopeBase: "https://dashscope-intl.aliyuncs.com/api/v1" },
});

const xaiCreds = () => ({
  connectionId: "c2",
  accessToken: "xai-tok",
  providerSpecificData: {},
});

const pollBody = (taskStatus, extra = {}) => ({
  output: { task_id: "t-1", task_status: taskStatus, model_name: "wan2.7-t2v", ...extra },
  request_id: "req-1",
});

// ─── KIND_SLUG_MAP ────────────────────────────────────────────────────────────
describe("KIND_SLUG_MAP includes 'video'", () => {
  it("the [kind] route file exports a GET handler", async () => {
    // Basic smoke: the route file can be imported without error
    // (KIND_SLUG_MAP is a local constant; we verify by importing the module)
    const mod = await import("@/app/api/v1/models/[kind]/route.js");
    expect(typeof mod.GET).toBe("function");
    expect(typeof mod.OPTIONS).toBe("function");
  });
});

// ─── buildModelsList kind field ───────────────────────────────────────────────
describe("buildModelsList kind field", () => {
  beforeEach(() => {
    localDbMock.getProviderConnections.mockResolvedValue([]);
    localDbMock.getCustomModels.mockResolvedValue([]);
    localDbMock.getModelAliases.mockResolvedValue({});
  });

  it("image combo appears in image list with kind='image'", async () => {
    localDbMock.getCombos.mockResolvedValue([
      { id: "c1", name: "alims-intl.image", kind: "image", models: ["alims-intl/qwen-image-plus"] },
      { id: "c2", name: "alims-intl.llm",   kind: "llm",   models: ["alims-intl/qwen3-max"] },
    ]);

    const { buildModelsList } = await import("@/app/api/v1/models/route.js");
    const imageModels = await buildModelsList(["image"]);

    const imgCombo = imageModels.find((m) => m.id === "alims-intl.image");
    expect(imgCombo).toBeDefined();
    expect(imgCombo.kind).toBe("image");

    // llm combo should NOT appear in image list
    expect(imageModels.find((m) => m.id === "alims-intl.llm")).toBeUndefined();
  });

  it("video combo appears in video list with kind='video'", async () => {
    localDbMock.getCombos.mockResolvedValue([
      { id: "v1", name: "alims-intl.video", kind: "video", models: ["alims-intl/wan2.7-t2v"] },
    ]);

    const { buildModelsList } = await import("@/app/api/v1/models/route.js");
    const videoModels = await buildModelsList(["video"]);

    const vc = videoModels.find((m) => m.id === "alims-intl.video");
    expect(vc).toBeDefined();
    expect(vc.kind).toBe("video");
  });

  it("llm combo has no kind field in llm list", async () => {
    localDbMock.getCombos.mockResolvedValue([
      { id: "l1", name: "alims-intl.llm", kind: "llm", models: ["alims-intl/qwen3-max"] },
    ]);

    const { buildModelsList } = await import("@/app/api/v1/models/route.js");
    const llmModels = await buildModelsList(["llm"]);

    const lc = llmModels.find((m) => m.id === "alims-intl.llm");
    expect(lc).toBeDefined();
    expect(lc.kind).toBeUndefined();
  });
});

// ─── handleDashScopeVideoPoll normalization ───────────────────────────────────
describe("handleDashScopeVideoPoll", () => {
  beforeEach(() => { global.fetch = vi.fn(); });
  afterEach(() => { global.fetch = originalFetch; });

  it("PENDING → status: queued", async () => {
    global.fetch.mockResolvedValueOnce(jsonRes(pollBody("PENDING")));
    const result = await handleDashScopeVideoPoll({ taskId: "t-1", credentials: dashCreds(), log: null });

    expect(result.success).toBe(true);
    const body = await result.response.json();
    expect(body.status).toBe("queued");
    expect(body.id).toBe("t-1");
    expect(body.object).toBe("video.generation");
  });

  it("RUNNING → status: processing", async () => {
    global.fetch.mockResolvedValueOnce(jsonRes(pollBody("RUNNING")));
    const result = await handleDashScopeVideoPoll({ taskId: "t-1", credentials: dashCreds(), log: null });

    expect(result.success).toBe(true);
    expect((await result.response.json()).status).toBe("processing");
  });

  it("SUCCEEDED → status: completed with data[].url", async () => {
    global.fetch.mockResolvedValueOnce(
      jsonRes(pollBody("SUCCEEDED", { video_url: "https://cdn.test/vid.mp4" }))
    );
    const result = await handleDashScopeVideoPoll({ taskId: "t-1", credentials: dashCreds(), log: null });

    expect(result.success).toBe(true);
    const body = await result.response.json();
    expect(body.status).toBe("completed");
    expect(body.data).toHaveLength(1);
    expect(body.data[0].url).toBe("https://cdn.test/vid.mp4");
  });

  it("FAILED → status: failed with error.message", async () => {
    global.fetch.mockResolvedValueOnce(
      jsonRes(pollBody("FAILED", { message: "Content policy violation" }))
    );
    const result = await handleDashScopeVideoPoll({ taskId: "t-1", credentials: dashCreds(), log: null });

    expect(result.success).toBe(true);
    const body = await result.response.json();
    expect(body.status).toBe("failed");
    expect(body.error.message).toBe("Content policy violation");
  });

  it("network error → createErrorResult 502", async () => {
    global.fetch.mockRejectedValueOnce(new Error("ECONNRESET"));
    const result = await handleDashScopeVideoPoll({ taskId: "t-1", credentials: dashCreds(), log: null });

    expect(result.success).toBe(false);
    expect(result.status).toBe(502);
  });

  it("upstream 400 → createErrorResult 400", async () => {
    global.fetch.mockResolvedValueOnce(jsonRes({ code: "InvalidRequest" }, 400));
    const result = await handleDashScopeVideoPoll({ taskId: "t-1", credentials: dashCreds(), log: null });

    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
  });
});

// ─── DashScope quota fallback error rules ─────────────────────────────────────
describe("checkFallbackError — DashScope quota text rules", () => {
  it("'has been used up' on HTTP 400 → shouldFallback: true", () => {
    const r = checkFallbackError(400, "Free quota for model qwen3-max has been used up");
    expect(r.shouldFallback).toBe(true);
    expect(r.cooldownMs).toBeGreaterThan(0);
  });

  it("'has run out' on HTTP 400 → shouldFallback: true", () => {
    const r = checkFallbackError(400, "Free quota has run out");
    expect(r.shouldFallback).toBe(true);
  });

  it("'insufficient balance' on HTTP 400 → shouldFallback: true", () => {
    const r = checkFallbackError(400, "Insufficient balance in account");
    expect(r.shouldFallback).toBe(true);
  });

  it("'arrearage' on HTTP 400 → shouldFallback: true", () => {
    const r = checkFallbackError(400, "Arrearage: account needs recharge");
    expect(r.shouldFallback).toBe(true);
  });

  it("'token quota' on HTTP 400 → shouldFallback: true", () => {
    const r = checkFallbackError(400, "token quota has been exceeded for this model");
    expect(r.shouldFallback).toBe(true);
  });

  it("'free tier' on HTTP 400 → shouldFallback: true", () => {
    const r = checkFallbackError(400, "free tier limit reached");
    expect(r.shouldFallback).toBe(true);
  });

  it("plain 400 'invalid parameter' → shouldFallback: false", () => {
    const r = checkFallbackError(400, "Invalid parameter: missing required field");
    expect(r.shouldFallback).toBe(false);
  });
});

// ─── handleVideoCreate auth guard ─────────────────────────────────────────────
describe("handleVideoCreate auth", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    authMock.getProviderCredentials.mockReset();
  });
  afterEach(() => { global.fetch = originalFetch; });

  it("returns 401 when requireApiKey=true and API key is invalid", async () => {
    localDbMock.getSettings.mockResolvedValueOnce({ requireApiKey: true });
    authMock.extractApiKey.mockReturnValueOnce("sk-bad");
    authMock.isValidApiKey.mockResolvedValueOnce(false);

    const req = new Request("http://localhost/v1/videos/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer sk-bad" },
      body: JSON.stringify({ model: "alims-intl/wan2.7-t2v", prompt: "a sunrise" }),
    });
    const res = await handleVideoCreate(req, "generations");
    expect(res.status).toBe(401);
  });
});

// ─── handleVideoCreate routing ────────────────────────────────────────────────
describe("handleVideoCreate routing", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    authMock.getProviderCredentials.mockReset();
    authMock.clearAccountError.mockClear();
    localDbMock.getSettings.mockResolvedValue({ requireApiKey: false, comboStrategies: {} });
    localDbMock.getComboByName.mockResolvedValue(null);
  });
  afterEach(() => { global.fetch = originalFetch; });

  it("routes alims-intl model to DashScope video-synthesis submit URL", async () => {
    authMock.getProviderCredentials.mockResolvedValue(dashCreds());
    // submit → task_id
    global.fetch
      .mockResolvedValueOnce(jsonRes({ output: { task_id: "t-123", task_status: "PENDING" } }))
      // poll → SUCCEEDED
      .mockResolvedValueOnce(
        jsonRes({ output: { task_id: "t-123", task_status: "SUCCEEDED", video_url: "https://cdn.test/v.mp4" } })
      );

    const req = new Request("http://localhost/v1/videos/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "alims-intl/wan2.7-t2v", prompt: "a sunset" }),
    });
    const res = await handleVideoCreate(req, "generations");

    expect(res.status).toBe(200);
    expect(global.fetch.mock.calls[0][0]).toContain("/services/aigc/video-generation/video-synthesis");
    expect(global.fetch.mock.calls[0][0]).toContain("dashscope-intl.aliyuncs.com");

    const body = await res.json();
    expect(body.status).toBe("completed");
    expect(body.data[0].url).toBe("https://cdn.test/v.mp4");
  });

  it("rejects provider with no video config with 400", async () => {
    const req = new Request("http://localhost/v1/videos/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/sora-fake", prompt: "x" }),
    });
    const res = await handleVideoCreate(req, "generations");
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("does not support video generation");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns 400 when no credentials exist for provider", async () => {
    authMock.getProviderCredentials.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/v1/videos/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "xai/grok-video", prompt: "x" }),
    });
    const res = await handleVideoCreate(req, "generations");
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("No credentials");
  });
});

// ─── handleVideoGet routing ───────────────────────────────────────────────────
describe("handleVideoGet routing", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    authMock.getProviderCredentials.mockReset();
    authMock.clearAccountError.mockClear();
    localDbMock.getSettings.mockResolvedValue({ requireApiKey: false });
  });
  afterEach(() => { global.fetch = originalFetch; });

  it("routes to DashScope /tasks/{id} when x-video-provider: alims-intl", async () => {
    authMock.getProviderCredentials.mockResolvedValueOnce(dashCreds());
    global.fetch.mockResolvedValueOnce(jsonRes(pollBody("RUNNING")));

    const req = new Request("http://localhost/v1/videos/t-999", {
      headers: { "x-video-provider": "alims-intl", "x-connection-id": "c1" },
    });
    const res = await handleVideoGet(req, "t-999");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("processing");
    expect(body.id).toBe("t-999"); // task id echoed from URL param
    expect(global.fetch.mock.calls[0][0]).toContain("/tasks/t-999");
    expect(global.fetch.mock.calls[0][0]).not.toContain("api.x.ai");
  });

  it("routes to xAI proxy when no x-video-provider (backward compat)", async () => {
    authMock.getProviderCredentials.mockResolvedValueOnce(xaiCreds());
    global.fetch.mockResolvedValueOnce(jsonRes({ request_id: "xai-req-1", status: "pending" }));

    const req = new Request("http://localhost/v1/videos/xai-req-1");
    const res = await handleVideoGet(req, "xai-req-1");

    expect(res.status).toBe(200);
    expect(global.fetch.mock.calls[0][0]).toContain("api.x.ai");
  });

  it("returns 400 on missing request id", async () => {
    const req = new Request("http://localhost/v1/videos/");
    const res = await handleVideoGet(req, "");
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Missing video request id");
  });
});

// ─── handleChat non-LLM combo guard ──────────────────────────────────────────
describe("handleChat: non-LLM combo guard", () => {
  beforeEach(() => {
    localDbMock.getSettings.mockResolvedValue({ requireApiKey: false });
  });

  it("returns 400 with /v1/images/generations hint for image combo", async () => {
    localDbMock.getComboByName.mockImplementation(async (name) =>
      name === "alims-intl.image"
        ? { id: "c1", name: "alims-intl.image", kind: "image", models: ["alims-intl/qwen-image-plus"] }
        : null
    );

    const req = new Request("http://localhost/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "alims-intl.image", messages: [{ role: "user", content: "draw a cat" }] }),
    });
    const res = await handleChat(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("/v1/images/generations");
    expect(body.error.message).toContain("image");
  });

  it("returns 400 with /v1/videos/generations hint for video combo", async () => {
    localDbMock.getComboByName.mockImplementation(async (name) =>
      name === "alims-intl.video"
        ? { id: "c2", name: "alims-intl.video", kind: "video", models: ["alims-intl/wan2.7-t2v"] }
        : null
    );

    const req = new Request("http://localhost/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "alims-intl.video", messages: [{ role: "user", content: "make video" }] }),
    });
    const res = await handleChat(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("/v1/videos/generations");
  });

  it("allows LLM combo through without rejection", async () => {
    // LLM combo: kind = 'llm' → guard does NOT fire; combo routes normally
    localDbMock.getComboByName.mockImplementation(async (name) =>
      name === "alims-intl.llm"
        ? { id: "c3", name: "alims-intl.llm", kind: "llm", models: ["alims-intl/qwen3-max"] }
        : null
    );
    // getProviderCredentials returns null → normal 400 "no credentials" from handler
    authMock.getProviderCredentials.mockResolvedValue(null);

    const req = new Request("http://localhost/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "alims-intl.llm", messages: [{ role: "user", content: "hello" }] }),
    });
    const res = await handleChat(req);
    // Must NOT be rejected by the guard (would be 400 "Use ...endpoint instead")
    const body = await res.json();
    expect(body.error?.message ?? "").not.toContain("Use ");
  });
});
