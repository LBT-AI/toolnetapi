import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  resolveKiroIdentity,
  extractKiroClaims,
} from "../../src/lib/oauth/providerHelpers.js";
import kiro from "../../src/lib/oauth/providers/kiro.js";

function makeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

describe("Kiro Account Identity and Duplicate Protection", () => {
  let tempDir;
  let createProviderConnection;
  let getProviderConnections;
  let updateProviderConnection;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "toolnet-kiro-test-"));
    process.env.DATA_DIR = tempDir;
    global._dbAdapter = null;
    vi.resetModules();

    const repos = await import("../../src/lib/db/repos/connectionsRepo.js");
    createProviderConnection = repos.createProviderConnection;
    getProviderConnections = repos.getProviderConnections;
    updateProviderConnection = repos.updateProviderConnection;
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // 1. Token contains email -> connection displays email/name
  it("Case 1: Token contains email -> connection displays email/name", async () => {
    const jwt = makeJwt({ email: "kiro-user@example.com", sub: "sub-123" });
    const identity = resolveKiroIdentity({ access_token: jwt });

    expect(identity.email).toBe("kiro-user@example.com");
    expect(identity.displayName).toBe("kiro-user@example.com");

    const mapped = kiro.mapTokens({
      access_token: jwt,
      refresh_token: "mock-refresh-1",
      expires_in: 3600,
      _clientId: "cid-1",
      _clientSecret: "csec-1",
    });

    expect(mapped.email).toBe("kiro-user@example.com");
    expect(mapped.name).toBe("kiro-user@example.com");

    const conn = await createProviderConnection({
      provider: "kiro",
      authType: "oauth",
      ...mapped,
      testStatus: "active",
    });

    expect(conn.email).toBe("kiro-user@example.com");
    expect(conn.name).toBe("kiro-user@example.com");
    expect(conn.name).not.toMatch(/^Account \d+$/);
  });

  // 2. Login with existing email -> no new connection created, credentials refreshed
  it("Case 2: Login with existing email -> no new connection created, credentials refreshed", async () => {
    const jwt1 = makeJwt({ email: "alice@example.com", sub: "sub-alice" });
    const firstConn = await createProviderConnection({
      provider: "kiro",
      authType: "oauth",
      accessToken: jwt1,
      refreshToken: "refresh-v1",
      email: "alice@example.com",
      name: "alice@example.com",
      expiresAt: "2026-09-05T20:00:00.000Z",
      providerSpecificData: {
        identityKey: "email:alice@example.com",
        authMethod: "builder-id",
      },
    });

    expect(firstConn._isDuplicate).toBeFalsy();

    const allBefore = await getProviderConnections({ provider: "kiro" });
    expect(allBefore.length).toBe(1);

    // Repeated login with same email but new tokens
    const jwt2 = makeJwt({ email: "alice@example.com", sub: "sub-alice" });
    const dupConn = await createProviderConnection({
      provider: "kiro",
      authType: "oauth",
      accessToken: jwt2,
      refreshToken: "refresh-v2",
      email: "alice@example.com",
      name: "alice@example.com",
      expiresAt: "2026-09-05T21:00:00.000Z",
      providerSpecificData: {
        identityKey: "email:alice@example.com",
        authMethod: "builder-id",
      },
    });

    expect(dupConn._isDuplicate).toBe(true);
    expect(dupConn.updatedExisting).toBe(true);
    expect(dupConn.id).toBe(firstConn.id);
    expect(dupConn.refreshToken).toBe("refresh-v2");

    const allAfter = await getProviderConnections({ provider: "kiro" });
    expect(allAfter.length).toBe(1);
    expect(allAfter[0].refreshToken).toBe("refresh-v2");
  });

  // 3. Token without email but with profileArn -> deduplicate by profileArn
  it("Case 3: Token without email but with profileArn -> deduplicate by profileArn", async () => {
    const arn = "arn:aws:codewhisperer:us-east-1:123456789012:profile/prof-alpha";
    const mapped1 = kiro.mapTokens({
      access_token: "opaque-access-1",
      refresh_token: "opaque-refresh-1",
      expires_in: 3600,
      profile_arn: arn,
      _clientId: "cid-1",
      _clientSecret: "csec-1",
      _authMethod: "idc",
    });

    expect(mapped1.email).toBeNull();
    expect(mapped1.providerSpecificData.profileArn).toBe(arn);
    expect(mapped1.providerSpecificData.identityKey).toBe(`arn:${arn}`);

    const conn1 = await createProviderConnection({
      provider: "kiro",
      authType: "oauth",
      ...mapped1,
    });

    expect(conn1._isDuplicate).toBeFalsy();

    // Second login with same profileArn
    const mapped2 = kiro.mapTokens({
      access_token: "opaque-access-2",
      refresh_token: "opaque-refresh-2",
      expires_in: 3600,
      profile_arn: arn,
      _clientId: "cid-2",
      _clientSecret: "csec-2",
      _authMethod: "idc",
    });

    const conn2 = await createProviderConnection({
      provider: "kiro",
      authType: "oauth",
      ...mapped2,
    });

    expect(conn2._isDuplicate).toBe(true);
    expect(conn2.id).toBe(conn1.id);
    expect(conn2.accessToken).toBe("opaque-access-2");

    const all = await getProviderConnections({ provider: "kiro" });
    expect(all.length).toBe(1);
  });

  // 4. Token with different profileArn -> creates separate connection
  it("Case 4: Token with different profileArn -> creates separate connection", async () => {
    const arnA = "arn:aws:codewhisperer:us-east-1:123456789012:profile/prof-A";
    const arnB = "arn:aws:codewhisperer:us-east-1:123456789012:profile/prof-B";

    const connA = await createProviderConnection({
      provider: "kiro",
      authType: "oauth",
      accessToken: "token-A",
      refreshToken: "ref-A",
      providerSpecificData: {
        profileArn: arnA,
        identityKey: `arn:${arnA}`,
        authMethod: "idc",
      },
    });

    const connB = await createProviderConnection({
      provider: "kiro",
      authType: "oauth",
      accessToken: "token-B",
      refreshToken: "ref-B",
      providerSpecificData: {
        profileArn: arnB,
        identityKey: `arn:${arnB}`,
        authMethod: "idc",
      },
    });

    expect(connA.id).not.toBe(connB.id);
    expect(connB._isDuplicate).toBeFalsy();

    const all = await getProviderConnections({ provider: "kiro" });
    expect(all.length).toBe(2);
  });

  // 5. Duplicate login updates existing connection's tokens (accessToken, refreshToken, expiresAt)
  it("Case 5: Duplicate login updates existing connection's tokens (accessToken, refreshToken, expiresAt)", async () => {
    const original = await createProviderConnection({
      provider: "kiro",
      authType: "oauth",
      accessToken: "initial-access",
      refreshToken: "initial-refresh",
      expiresAt: "2026-09-05T10:00:00.000Z",
      email: "update-test@example.com",
      providerSpecificData: {
        identityKey: "email:update-test@example.com",
        authMethod: "builder-id",
      },
    });

    const updated = await createProviderConnection({
      provider: "kiro",
      authType: "oauth",
      accessToken: "fresh-access",
      refreshToken: "fresh-refresh",
      expiresAt: "2026-09-05T12:00:00.000Z",
      email: "update-test@example.com",
      providerSpecificData: {
        identityKey: "email:update-test@example.com",
        authMethod: "builder-id",
      },
    });

    expect(updated._isDuplicate).toBe(true);
    expect(updated.id).toBe(original.id);
    expect(updated.accessToken).toBe("fresh-access");
    expect(updated.refreshToken).toBe("fresh-refresh");
    expect(updated.expiresAt).toBe("2026-09-05T12:00:00.000Z");

    const fetched = await getProviderConnections({ provider: "kiro" });
    expect(fetched.length).toBe(1);
    expect(fetched[0].accessToken).toBe("fresh-access");
    expect(fetched[0].refreshToken).toBe("fresh-refresh");
    expect(fetched[0].expiresAt).toBe("2026-09-05T12:00:00.000Z");
  });

  // 6. Duplicate login preserves existing connection's proxy, priority, isActive
  it("Case 6: Duplicate login preserves existing connection's proxy, priority, isActive", async () => {
    // Other connection so priority list has multiple items
    await createProviderConnection({
      provider: "kiro",
      authType: "oauth",
      accessToken: "other-access",
      refreshToken: "other-refresh",
      email: "other@example.com",
      name: "Other Account",
    });

    const initial = await createProviderConnection({
      provider: "kiro",
      authType: "oauth",
      accessToken: "orig-access",
      refreshToken: "orig-refresh",
      email: "proxy-preserve@example.com",
      name: "Custom Work Account",
      isActive: false,
      proxyPoolId: "pool-special-1",
      providerSpecificData: {
        identityKey: "email:proxy-preserve@example.com",
        accountLabel: "Custom Work Account",
        proxyPoolId: "pool-special-1",
        connectionProxyUrl: "http://my-proxy:8080",
        connectionProxyEnabled: true,
        authMethod: "builder-id",
      },
    });

    const initialPriority = initial.priority;
    expect(initialPriority).toBe(2);
    expect(initial.isActive).toBe(false);
    expect(initial.name).toBe("Custom Work Account");

    // Incoming duplicate login without proxy info or custom priority
    const duplicate = await createProviderConnection({
      provider: "kiro",
      authType: "oauth",
      accessToken: "new-access",
      refreshToken: "new-refresh",
      email: "proxy-preserve@example.com",
      providerSpecificData: {
        identityKey: "email:proxy-preserve@example.com",
        authMethod: "builder-id",
      },
    });

    expect(duplicate._isDuplicate).toBe(true);
    expect(duplicate.id).toBe(initial.id);
    // Preserved settings
    expect(duplicate.priority).toBe(initialPriority);
    expect(duplicate.isActive).toBe(false);
    expect(duplicate.name).toBe("Custom Work Account");
    expect(duplicate.proxyPoolId).toBe("pool-special-1");
    expect(duplicate.providerSpecificData.proxyPoolId).toBe("pool-special-1");
    expect(duplicate.providerSpecificData.connectionProxyUrl).toBe("http://my-proxy:8080");
    expect(duplicate.providerSpecificData.connectionProxyEnabled).toBe(true);

    // Updated tokens
    expect(duplicate.accessToken).toBe("new-access");
    expect(duplicate.refreshToken).toBe("new-refresh");
  });

  // 7. Legacy connection with "Account 1" format remains compatible and displays properly
  it("Case 7: Legacy connection with 'Account 1' format remains compatible and displays properly", async () => {
    // Simulate legacy connection as currently found in SQLite
    const legacy = await createProviderConnection({
      provider: "kiro",
      authType: "oauth",
      name: "Account 1",
      email: null,
      priority: 1,
      accessToken: "aoaAAAAAGqcGxIZ...",
      refreshToken: "aorAAAAAGsCNfIT...",
      providerSpecificData: {
        authMethod: "builder-id",
        region: "us-east-1",
        startUrl: "https://view.awsapps.com/start",
        profileArn: null,
      },
    });

    expect(legacy.name).toBe("Account 1");
    expect(legacy.email).toBeNull();

    const conns = await getProviderConnections({ provider: "kiro" });
    expect(conns.length).toBe(1);
    expect(conns[0].name).toBe("Account 1");

    // Test ConnectionRow display computation logic for legacy row:
    const kiroAuthMethod = conns[0].providerSpecificData?.authMethod || conns[0].authMethod;
    let authLabel = "OAuth";
    if (conns[0].provider === "kiro" && kiroAuthMethod === "builder-id") {
      authLabel = "AWS Builder ID";
    }

    expect(authLabel).toBe("AWS Builder ID");

    // Display name: Account 1 preserved when no email/label/profileArn exists
    const accountLabel = conns[0].providerSpecificData?.accountLabel;
    const email = conns[0].email;
    const profileArn = conns[0].providerSpecificData?.profileArn;
    const rawName = conns[0].name;

    const displayName = accountLabel || email || profileArn || rawName || `Account ${conns[0].priority}`;
    expect(displayName).toBe("Account 1");
  });

  // 8. No sensitive tokens in API response or logs
  it("Case 8: No sensitive tokens in API response or logs", async () => {
    vi.doMock("next/server", () => ({
      NextResponse: {
        json(body, init = {}) {
          return {
            status: init.status || 200,
            json: async () => body,
          };
        },
      },
    }));

    vi.doMock("@/lib/oauth/providers", () => ({
      pollForToken: vi.fn().mockResolvedValue({
        success: true,
        tokens: {
          accessToken: "SECRET_ACCESS_TOKEN_XYZ",
          refreshToken: "SECRET_REFRESH_TOKEN_XYZ",
          expiresIn: 3600,
          email: "safe-response@example.com",
          name: "safe-response@example.com",
          providerSpecificData: {
            clientId: "SECRET_CLIENT_ID",
            clientSecret: "SECRET_CLIENT_SECRET",
            authMethod: "builder-id",
            identityKey: "email:safe-response@example.com",
          },
        },
      }),
    }));

    const routeModule = await import("../../src/app/api/oauth/[provider]/[action]/route.js");
    const POST = routeModule.POST;

    const req = new Request("http://localhost/api/oauth/kiro/poll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceCode: "dev-code-123",
        extraData: { _clientId: "cid", _clientSecret: "csec" },
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ provider: "kiro", action: "poll" }) });
    const responseData = await res.json();

    expect(responseData.success).toBe(true);
    expect(responseData.connection).toBeDefined();
    expect(responseData.connection.email).toBe("safe-response@example.com");
    expect(responseData.connection.displayName).toBe("safe-response@example.com");

    // Stringify response and verify NO secrets leaked
    const responseJsonString = JSON.stringify(responseData);
    expect(responseJsonString).not.toContain("SECRET_ACCESS_TOKEN_XYZ");
    expect(responseJsonString).not.toContain("SECRET_REFRESH_TOKEN_XYZ");
    expect(responseJsonString).not.toContain("SECRET_CLIENT_SECRET");
    expect(responseJsonString).not.toContain("SECRET_CLIENT_ID");
    expect(responseData.connection.accessToken).toBeUndefined();
    expect(responseData.connection.refreshToken).toBeUndefined();
  });
});
