import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock proxyFetch for network calls
const fetchMock = vi.fn();
vi.mock("../../open-sse/utils/proxyFetch.js", () => ({
  proxyAwareFetch: (...args) => fetchMock(...args),
}));

import { getKiroUsage } from "../../open-sse/services/usage/kiro.js";
import { getOpenRouterUsage } from "../../open-sse/services/usage/openrouter.js";
import {
  getProviderCapability,
  hasQuotaSupport,
  getProviderRefreshInterval,
} from "../../open-sse/services/usageCapabilities.js";
import {
  getConnectionStatus,
  getAuthenticationStatus,
  getInferenceStatus,
  getQuotaStatus,
  sanitizeErrorMessage,
  formatTimeAgo,
  filterConnectionsByAccountStatus,
  sortVisibleConnections,
  parseQuotaData,
} from "../../src/app/(dashboard)/dashboard/usage/components/ProviderLimits/utils.js";

describe("Quota Tracker V2 - Capabilities & Discovery", () => {
  it("recognizes providers with Quota API", () => {
    const codexCap = getProviderCapability("codex");
    expect(codexCap.supportsQuotaApi).toBe(true);
    expect(hasQuotaSupport("codex")).toBe(true);
    expect(getProviderRefreshInterval("codex")).toBe(60000);

    const kiroCap = getProviderCapability("kiro");
    expect(kiroCap.supportsQuotaApi).toBe(true);
    expect(getProviderRefreshInterval("kiro")).toBe(120000);

    const claudeCap = getProviderCapability("claude");
    expect(claudeCap.supportsQuotaApi).toBe(true);
    expect(getProviderRefreshInterval("claude")).toBe(180000);
  });

  it("recognizes providers with rate-limit headers only", () => {
    const groqCap = getProviderCapability("groq");
    expect(groqCap.supportsQuotaApi).toBe(false);
    expect(groqCap.supportsRateLimitHeaders).toBe(true);
    expect(hasQuotaSupport("groq")).toBe(true);
  });

  it("recognizes providers with balance API", () => {
    const deepseekCap = getProviderCapability("deepseek");
    expect(deepseekCap.supportsBalanceApi).toBe(true);
    expect(hasQuotaSupport("deepseek")).toBe(true);

    const openrouterCap = getProviderCapability("openrouter");
    expect(openrouterCap.supportsBalanceApi).toBe(true);
    expect(hasQuotaSupport("openrouter")).toBe(true);
  });

  it("correctly identifies unsupported providers without failing", () => {
    const opencodeCap = getProviderCapability("opencode");
    expect(opencodeCap.supportsQuotaApi).toBe(false);
    expect(opencodeCap.supportsBalanceApi).toBe(false);
    expect(hasQuotaSupport("opencode")).toBe(false);

    const kilocodeCap = getProviderCapability("kilocode");
    expect(hasQuotaSupport("kilocode")).toBe(false);

    const unknownCap = getProviderCapability("custom-unknown-provider");
    expect(hasQuotaSupport("custom-unknown-provider")).toBe(false);
  });
});

describe("Quota Tracker V2 - Kiro Usage Diagnosis", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("handles successful GET GetUsageLimits", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        subscriptionInfo: { subscriptionTitle: "Kiro Pro" },
        usageBreakdownList: [
          {
            resourceType: "CREDIT",
            currentUsageWithPrecision: 10,
            usageLimitWithPrecision: 50,
          },
        ],
        nextDateReset: "2026-11-01T00:00:00Z",
      }),
    });

    const result = await getKiroUsage("valid-token", {
      authMethod: "builder-id",
      region: "us-east-1",
    });

    expect(result.status).toBe("AVAILABLE");
    expect(result.quotaStatus).toBe("AVAILABLE");
    expect(result.plan).toBe("Kiro Pro");
    expect(result.quotas.credit).toBeDefined();
    expect(result.quotas.credit.remaining).toBe(40);
  });

  it("handles successful POST GetUsageLimits when GET fails", async () => {
    // GET fails with 403
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ message: "GET forbidden" }),
    });
    // POST succeeds
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        subscriptionInfo: { subscriptionTitle: "Kiro Builder" },
        usageBreakdownList: [
          {
            resourceType: "CREDIT",
            currentUsageWithPrecision: 0,
            usageLimitWithPrecision: 50,
          },
        ],
      }),
    });

    const result = await getKiroUsage("valid-token", {
      authMethod: "builder-id",
      region: "us-east-1",
    });

    expect(result.status).toBe("AVAILABLE");
    expect(result.quotas.credit.remaining).toBe(50);
  });

  it("differentiates HTTP 401 token expired error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: "The security token included in the request is expired" }),
    });

    const result = await getKiroUsage("expired-token", {
      authMethod: "builder-id",
    });

    expect(result.quotaStatus).toBe("UNAVAILABLE");
    expect(result.authStatus).toBe("EXPIRED");
    expect(result.message).toContain("401");
  });

  it("differentiates HTTP 403 permission/profile mismatch without marking chat as broken", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ message: "The bearer token included in the request is invalid." }),
    });

    const result = await getKiroUsage("chat-working-token", {
      authMethod: "builder-id",
    });

    expect(result.quotaStatus).toBe("UNAVAILABLE");
    expect(result.authStatus).toBe("VALID");
    expect(result.message).toContain("Chat may still work");
    expect(result.reason).toContain("HTTP 403");
  });

  it("handles HTTP 429 rate limit with RATE_LIMITED status", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "Rate exceeded",
    });

    const result = await getKiroUsage("valid-token", {
      authMethod: "builder-id",
    });

    expect(result.quotaStatus).toBe("RATE_LIMITED");
    expect(result.authStatus).toBe("VALID");
    expect(result.message).toContain("rate-limited");
  });

  it("handles network failure and timeout gracefully with FETCH_ERROR", async () => {
    fetchMock.mockRejectedValue(new Error("Connection timed out after 10000ms"));

    const result = await getKiroUsage("valid-token", {
      authMethod: "builder-id",
    });

    expect(result.quotaStatus).toBe("FETCH_ERROR");
    expect(result.reason).toContain("timed out");
  });

  it("does not inject placeholder profileArn for API key flow", async () => {
    let capturedBody = null;
    fetchMock.mockImplementationOnce(async (url, opts) => {
      // attempt 1 GET fails
      return { ok: false, status: 403, text: async () => "" };
    });
    fetchMock.mockImplementationOnce(async (url, opts) => {
      // attempt 2 POST captures body
      capturedBody = JSON.parse(opts.body);
      return { ok: false, status: 403, text: async () => "" };
    });
    fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 403, text: async () => "" }));

    await getKiroUsage("api-key-token", {
      authMethod: "api_key",
    });

    expect(capturedBody).toBeDefined();
    expect(capturedBody.profileArn).toBeUndefined();
  });

  it("respects region in providerSpecificData", async () => {
    let requestedUrl = null;
    fetchMock.mockImplementation(async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({ usageBreakdownList: [] }),
      };
    });

    await getKiroUsage("valid-token", {
      authMethod: "builder-id",
      region: "eu-central-1",
    });

    expect(requestedUrl).toContain("codewhisperer.eu-central-1.amazonaws.com");
  });
});

describe("Quota Tracker V2 - Status Separation", () => {
  it("separates connection status (ENABLED vs DISABLED)", () => {
    expect(getConnectionStatus({ isActive: true })).toBe("ENABLED");
    expect(getConnectionStatus({ isActive: false })).toBe("DISABLED");
    expect(getConnectionStatus({})).toBe("ENABLED");
  });

  it("separates authentication status (VALID, EXPIRED, INVALID, UNKNOWN)", () => {
    // Valid
    expect(getAuthenticationStatus({ testStatus: "active" }, null)).toBe("VALID");
    expect(getAuthenticationStatus({}, { quotas: [{ name: "test", total: 10 }], source: "live" })).toBe("VALID");

    // Expired
    expect(getAuthenticationStatus({ expiresAt: "2020-01-01T00:00:00Z" }, null)).toBe("EXPIRED");

    // Invalid (401 error)
    expect(getAuthenticationStatus({ errorCode: 401 }, null)).toBe("INVALID");
    expect(getAuthenticationStatus({ lastError: "Token unauthorized: 401" }, null)).toBe("INVALID");

    // Unknown
    expect(getAuthenticationStatus({}, null)).toBe("UNKNOWN");
  });

  it("separates inference status (WORKING, FAILED, RATE_LIMITED, NOT_TESTED)", () => {
    expect(getInferenceStatus({ testStatus: "active" }, null)).toBe("WORKING");
    expect(getInferenceStatus({ testStatus: "error" }, null)).toBe("FAILED");
    expect(getInferenceStatus({ errorCode: 429 }, null)).toBe("RATE_LIMITED");
    expect(getInferenceStatus({ testStatus: "unknown" }, null)).toBe("NOT_TESTED");
    expect(getInferenceStatus({}, null)).toBe("NOT_TESTED");
  });

  it("separates quota status (AVAILABLE, UNAVAILABLE, UNSUPPORTED, STALE, FETCH_ERROR)", () => {
    expect(getQuotaStatus({}, { quotaStatus: "AVAILABLE" })).toBe("AVAILABLE");
    expect(getQuotaStatus({}, { quotaStatus: "UNSUPPORTED" })).toBe("UNSUPPORTED");
    expect(getQuotaStatus({}, { status: "UNSUPPORTED" })).toBe("UNSUPPORTED");
    expect(getQuotaStatus({}, { quotaStatus: "STALE", source: "stale" })).toBe("STALE");
    expect(getQuotaStatus({}, null, false, new Error("Failed"))).toBe("FETCH_ERROR");
  });
});

describe("Quota Tracker V2 - Caching & Last-known-good", () => {
  it("formats time ago properly", () => {
    const justNow = new Date().toISOString();
    expect(formatTimeAgo(justNow)).toBe("Just now");

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatTimeAgo(fiveMinAgo)).toBe("5m ago");

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(twoHoursAgo)).toBe("2h ago");

    expect(formatTimeAgo(null)).toBeNull();
  });

  it("preserves last-known-good quota as STALE during temporary error", () => {
    const cachedEntry = {
      quotas: [{ name: "credit", total: 50, used: 10, remaining: 40 }],
      quotaStatus: "AVAILABLE",
      source: "stale",
    };

    const status = getQuotaStatus({}, cachedEntry, false, new Error("Temporary network timeout"));
    expect(status).toBe("STALE");
  });
});

describe("Quota Tracker V2 - Security & Sanitization", () => {
  it("redacts bearer tokens, api keys, and long hashes from error messages", () => {
    const rawError = "Request failed with Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret and key sk-1234567890abcdef123456";
    const sanitized = sanitizeErrorMessage(rawError);

    expect(sanitized).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(sanitized).not.toContain("sk-1234567890abcdef123456");
    expect(sanitized).toContain("Bearer [REDACTED]");
  });

  it("handles null or empty error strings safely", () => {
    expect(sanitizeErrorMessage(null)).toBeNull();
    expect(sanitizeErrorMessage("")).toBeNull();
  });
});

describe("Quota Tracker V2 - Filters & Sorting", () => {
  const mockConnections = [
    { id: "conn-1", provider: "kiro", isActive: true, testStatus: "active" },
    { id: "conn-2", provider: "groq", isActive: false, testStatus: "unknown" },
    { id: "conn-3", provider: "codex", isActive: true, testStatus: "error", errorCode: 401 },
    { id: "conn-4", provider: "opencode", isActive: true, testStatus: "unknown" },
  ];

  const mockQuotaData = {
    "conn-1": { quotas: [{ name: "credit", total: 50, used: 10, remaining: 40 }], quotaStatus: "AVAILABLE" },
    "conn-2": { quotas: [], quotaStatus: "AVAILABLE" },
    "conn-3": { quotas: [], quotaStatus: "UNAVAILABLE", authStatus: "INVALID" },
    "conn-4": { quotas: [], quotaStatus: "UNSUPPORTED" },
  };

  it("filters by enabled / active", () => {
    const enabled = filterConnectionsByAccountStatus(mockConnections, mockQuotaData, "active");
    expect(enabled).toHaveLength(3);
    expect(enabled.map((c) => c.id)).toEqual(["conn-1", "conn-3", "conn-4"]);
  });

  it("filters by disabled / inactive", () => {
    const disabled = filterConnectionsByAccountStatus(mockConnections, mockQuotaData, "inactive");
    expect(disabled).toHaveLength(1);
    expect(disabled[0].id).toBe("conn-2");
  });

  it("filters by working", () => {
    const working = filterConnectionsByAccountStatus(mockConnections, mockQuotaData, "working");
    expect(working).toHaveLength(1);
    expect(working[0].id).toBe("conn-1");
  });

  it("filters by auth-error", () => {
    const authErrors = filterConnectionsByAccountStatus(mockConnections, mockQuotaData, "auth-error");
    expect(authErrors).toHaveLength(1);
    expect(authErrors[0].id).toBe("conn-3");
  });

  it("filters by quota-unsupported", () => {
    const unsupported = filterConnectionsByAccountStatus(mockConnections, mockQuotaData, "quota-unsupported");
    expect(unsupported).toHaveLength(1);
    expect(unsupported[0].id).toBe("conn-4");
  });

  it("sorts by remaining quota percentage ascending", () => {
    const conns = [
      { id: "c1", provider: "codex" },
      { id: "c2", provider: "kiro" },
    ];
    const data = {
      c1: { quotas: [{ used: 40, total: 50, remaining: 20 }] }, // 20%
      c2: { quotas: [{ used: 10, total: 50, remaining: 80 }] }, // 80%
    };

    const sortedAsc = sortVisibleConnections(conns, data, false, "all", "remaining-asc");
    expect(sortedAsc[0].id).toBe("c1");
    expect(sortedAsc[1].id).toBe("c2");

    const sortedDesc = sortVisibleConnections(conns, data, false, "all", "remaining-desc");
    expect(sortedDesc[0].id).toBe("c2");
    expect(sortedDesc[1].id).toBe("c1");
  });
});

describe("Quota Tracker V2 - OpenRouter Credits Handler", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("fetches and parses OpenRouter credits successfully", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          total_credits: 25.0,
          total_usage: 5.5,
        },
      }),
    });

    const res = await getOpenRouterUsage("valid-openrouter-key");
    expect(res.status).toBe("AVAILABLE");
    expect(res.quotas.credits).toBeDefined();
    expect(res.quotas.credits.total).toBe(25.0);
    expect(res.quotas.credits.used).toBe(5.5);
    expect(res.quotas.credits.remaining).toBe(19.5);
    expect(res.quotas.credits.unit).toBe("USD");
  });

  it("handles OpenRouter 401 unauthorized", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    const res = await getOpenRouterUsage("bad-key");
    expect(res.status).toBe("UNAVAILABLE");
    expect(res.authStatus).toBe("INVALID");
  });
});
