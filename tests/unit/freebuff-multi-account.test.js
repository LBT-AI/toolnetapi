import { describe, expect, it, vi } from "vitest";
import { FreebuffService } from "../../src/lib/oauth/services/freebuff.js";
import freebuffProvider from "../../src/lib/oauth/providers/freebuff.js";
import { CLI_FREE_PROVIDERS } from "../../src/shared/constants/providers.js";

describe("Freebuff Multi-Account Auth & Service", () => {
  it("registers freebuff in CLI_FREE_PROVIDERS with cliSession auth type", () => {
    const provider = CLI_FREE_PROVIDERS.freebuff;
    expect(provider).toBeDefined();
    expect(provider.hasFree).toBe(true);
    expect(provider.authType).toBe("cliSession");
  });

  it("instantiates FreebuffService and generates enhanced fingerprint ID", () => {
    const service = new FreebuffService();
    const fpId = service.generateFingerprintId();
    expect(fpId).toMatch(/^enhanced-[A-Za-z0-9_-]+$/);
  });

  it("reads local credentials if present or gracefully returns empty when missing", async () => {
    const service = new FreebuffService();
    const creds = await service.readLocalCredentials();
    expect(creds).toBeDefined();
    expect(creds.configPath).toContain("credentials.json");
    expect(Array.isArray(creds.accounts)).toBe(true);
    if (creds.found) {
      expect(creds.accounts.length).toBeGreaterThan(0);
      expect(creds.accounts[0].authToken).toBeDefined();
    }
  });

  it("handles pollLoginStatus when pending (HTTP 401)", async () => {
    const service = new FreebuffService();
    const mockFetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
    });
    global.fetch = mockFetch;

    const result = await service.pollLoginStatus({
      fingerprintId: "test-fp",
      fingerprintHash: "test-hash",
      expiresAt: 123456789,
    });

    expect(result.status).toBe("pending");
  });

  it("handles pollLoginStatus when success (HTTP 200 with user)", async () => {
    const service = new FreebuffService();
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        user: {
          id: "usr_123",
          name: "Test User",
          email: "test@freebuff.com",
          authToken: "fb_token_xyz",
        },
      }),
    });
    global.fetch = mockFetch;

    const result = await service.pollLoginStatus({
      fingerprintId: "test-fp",
      fingerprintHash: "test-hash",
    });

    expect(result.status).toBe("success");
    expect(result.user.email).toBe("test@freebuff.com");
    expect(result.user.authToken).toBe("fb_token_xyz");
  });

  it("implements freebuffProvider device flow contract", async () => {
    expect(freebuffProvider.flowType).toBe("device_code");
    expect(typeof freebuffProvider.requestDeviceCode).toBe("function");
    expect(typeof freebuffProvider.pollToken).toBe("function");
    expect(typeof freebuffProvider.mapTokens).toBe("function");

    const mapped = freebuffProvider.mapTokens({
      accessToken: "token_123",
      email: "user@test.com",
      name: "User Test",
      userId: "u_1",
    });
    expect(mapped.accessToken).toBe("token_123");
    expect(mapped.email).toBe("user@test.com");
    expect(mapped.providerSpecificData.userId).toBe("u_1");
  });
});
