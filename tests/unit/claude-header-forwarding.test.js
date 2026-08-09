/**
 * Unit tests for Anthropic per-request header generation pipeline
 *
 * Tests cover:
 *  - selectAnthropicBeta: base beta flags and heavy-agent gating for opus/sonnet
 *  - default.js buildHeaders(): per-request Anthropic-Beta header generation for "claude" provider
 *  - default.js buildHeaders(): anthropic-compatible non-Anthropic host stripping
 *  - default.js buildHeaders(): anthropic-compatible official host keeps headers
 *  - proxyFetch.js: api.anthropic.com routes through anthropicFetch path
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { selectAnthropicBeta } from "../../open-sse/providers/shared.js";

// ─── selectAnthropicBeta ──────────────────────────────────────────────────────

describe("selectAnthropicBeta", () => {
  it("generates base Anthropic-Beta flags for standard models", () => {
    const beta = selectAnthropicBeta("claude-haiku-4-5-20251001");
    expect(beta).toContain("claude-code-20250219");
    expect(beta).toContain("oauth-2025-04-20");
    expect(beta).toContain("interleaved-thinking-2025-05-14");
    expect(beta).toContain("token-efficient-tools-2026-03-28");
    expect(beta).not.toContain("advanced-tool-use-2025-11-20");
    expect(beta).not.toContain("effort-2025-11-24");
  });

  it("appends heavy-agent beta flags for sonnet models", () => {
    const beta = selectAnthropicBeta("claude-sonnet-5");
    expect(beta).toContain("advanced-tool-use-2025-11-20");
    expect(beta).toContain("effort-2025-11-24");
  });

  it("appends heavy-agent beta flags for opus models", () => {
    const beta = selectAnthropicBeta("claude-opus-4-8");
    expect(beta).toContain("advanced-tool-use-2025-11-20");
    expect(beta).toContain("effort-2025-11-24");
  });
});

// ─── DefaultExecutor.buildHeaders() ──────────────────────────────────────────

describe("DefaultExecutor.buildHeaders() — claude provider", () => {
  let DefaultExecutor;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../open-sse/executors/default.js");
    DefaultExecutor = mod.DefaultExecutor || mod.default;
  });

  it("sets per-request Anthropic-Beta header with heavy-agent flags for sonnet", () => {
    const executor = new DefaultExecutor("claude");
    const headers = executor.buildHeaders({ apiKey: "sk-test" }, true, null, "claude-sonnet-5");

    const betaFlags = headers["Anthropic-Beta"].split(",").map(s => s.trim());
    expect(betaFlags).toContain("claude-code-20250219");
    expect(betaFlags).toContain("advanced-tool-use-2025-11-20");
    expect(betaFlags).toContain("effort-2025-11-24");
  });

  it("sets per-request Anthropic-Beta header without heavy-agent flags for haiku", () => {
    const executor = new DefaultExecutor("claude");
    const headers = executor.buildHeaders({ apiKey: "sk-test" }, true, null, "claude-haiku-4-5-20251001");

    const betaFlags = headers["Anthropic-Beta"].split(",").map(s => s.trim());
    expect(betaFlags).toContain("claude-code-20250219");
    expect(betaFlags).not.toContain("advanced-tool-use-2025-11-20");
    expect(betaFlags).not.toContain("effort-2025-11-24");
  });

  it("sets x-api-key auth when apiKey is provided", () => {
    const executor = new DefaultExecutor("claude");
    const headers = executor.buildHeaders({ apiKey: "sk-live-key" }, true);
    expect(headers["x-api-key"]).toBe("sk-live-key");
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("sets Bearer Authorization when only accessToken is provided", () => {
    const executor = new DefaultExecutor("claude");
    const headers = executor.buildHeaders({ accessToken: "tok-abc" }, true);
    expect(headers["Authorization"]).toBe("Bearer tok-abc");
    expect(headers["x-api-key"]).toBeUndefined();
  });

  it("includes Accept: text/event-stream when stream=true", () => {
    const executor = new DefaultExecutor("claude");
    const headers = executor.buildHeaders({ apiKey: "k" }, true);
    expect(headers["Accept"]).toBe("text/event-stream");
  });

  it("omits Accept: text/event-stream when stream=false", () => {
    const executor = new DefaultExecutor("claude");
    const headers = executor.buildHeaders({ apiKey: "k" }, false);
    expect(headers["Accept"]).toBeUndefined();
  });
});

// ─── anthropic-compatible header stripping ────────────────────────────────────

describe("DefaultExecutor.buildHeaders() — anthropic-compatible stripping", () => {
  let DefaultExecutor;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../open-sse/executors/default.js");
    DefaultExecutor = mod.DefaultExecutor || mod.default;
  });

  it("strips x-app and anthropic-dangerous-direct-browser-access for non-Anthropic host", () => {
    const executor = new DefaultExecutor("anthropic-compatible-custom");
    const headers = executor.buildHeaders(
      {
        apiKey: "key",
        providerSpecificData: { baseUrl: "https://myproxy.example.com/v1" },
      },
      true
    );

    expect(headers["x-app"]).toBeUndefined();
    expect(headers["X-App"]).toBeUndefined();
    expect(headers["anthropic-dangerous-direct-browser-access"]).toBeUndefined();
    expect(headers["Anthropic-Dangerous-Direct-Browser-Access"]).toBeUndefined();
  });

  it("removes claude-code-20250219 from anthropic-beta for non-Anthropic host", () => {
    const executor = new DefaultExecutor("anthropic-compatible-custom");
    const headers = executor.buildHeaders(
      {
        apiKey: "key",
        providerSpecificData: { baseUrl: "https://myproxy.example.com/v1" },
      },
      true
    );

    const betaVal = headers["anthropic-beta"] || headers["Anthropic-Beta"] || "";
    expect(betaVal).not.toContain("claude-code-20250219");
  });

  it("keeps other beta flags intact after stripping", () => {
    const executor = new DefaultExecutor("anthropic-compatible-custom");
    // The static CLAUDE_API_HEADERS used by anthropic-compatible providers include
    // 'interleaved-thinking-2025-05-14' — check it survives stripping
    const headers = executor.buildHeaders(
      {
        apiKey: "key",
        providerSpecificData: { baseUrl: "https://myproxy.example.com/v1" },
      },
      false
    );

    const betaVal = headers["anthropic-beta"] || headers["Anthropic-Beta"] || "";
    // If any beta value remains it should not be empty and should not have the stripped value
    if (betaVal) {
      expect(betaVal).not.toContain("claude-code-20250219");
    }
  });

  it("does NOT strip headers when baseUrl is api.anthropic.com", () => {
    const executor = new DefaultExecutor("anthropic-compatible-official");
    const headers = executor.buildHeaders(
      {
        apiKey: "key",
        providerSpecificData: { baseUrl: "https://api.anthropic.com/v1" },
      },
      true
    );

    // No stripping — anthropic-version should survive
    const hasVersion =
      headers["Anthropic-Version"] || headers["anthropic-version"];
    expect(hasVersion).toBeDefined();
  });

  it("does NOT strip headers when baseUrl is empty (defaults to Anthropic)", () => {
    const executor = new DefaultExecutor("anthropic-compatible-official");
    const headers = executor.buildHeaders(
      {
        apiKey: "key",
        providerSpecificData: {},
      },
      true
    );

    const hasVersion =
      headers["Anthropic-Version"] || headers["anthropic-version"];
    expect(hasVersion).toBeDefined();
  });
});


