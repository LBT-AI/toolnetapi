import { NextResponse } from "next/server";
import { FreebuffService } from "@/lib/oauth/services/freebuff";
import { createProviderConnection, getProviderConnections, updateProviderConnection } from "@/models";
import { seedAccountCredentials } from "open-sse/services/freebuff/accountManager.js";

/**
 * POST /api/oauth/freebuff/import
 * Manually import a Freebuff auth token or credentials JSON snippet
 */
export async function POST(request) {
  try {
    const body = await request.json();
    let authToken = body.authToken?.trim();
    const customLabel = body.name?.trim();

    // Check if user pasted a JSON string containing credentials
    if (authToken && (authToken.startsWith("{") || authToken.startsWith("["))) {
      try {
        const parsed = JSON.parse(authToken);
        if (parsed.authToken) {
          authToken = parsed.authToken;
        } else if (parsed.default?.authToken) {
          authToken = parsed.default.authToken;
        }
      } catch {
        // Not valid JSON, use raw token
      }
    }

    if (!authToken) {
      return NextResponse.json(
        { error: "Freebuff auth token is required" },
        { status: 400 }
      );
    }

    const service = new FreebuffService();

    // Validate token by fetching user profile
    let userInfo;
    try {
      userInfo = await service.getUserInfo(authToken);
    } catch (err) {
      return NextResponse.json(
        { error: `Token validation failed: ${err.message}` },
        { status: 401 }
      );
    }

    const email = userInfo?.email || body.email?.trim() || null;
    const userId = userInfo?.id || body.userId?.trim() || null;
    const accountName =
      customLabel ||
      (email ? `Freebuff (${email})` : userId ? `Freebuff (${userId.slice(0, 8)})` : "Freebuff Account");

    // Check existing
    const existingConns = await getProviderConnections({ provider: "freebuff" });
    const existing = existingConns.find(
      (c) =>
        (email && c.email === email) ||
        (userId && c.providerSpecificData?.userId === userId) ||
        c.apiKey === authToken ||
        c.accessToken === authToken
    );

    let connection;
    if (existing) {
      await updateProviderConnection(existing.id, {
        accessToken: authToken,
        apiKey: authToken,
        isActive: true,
        email: email || existing.email,
        name: customLabel || existing.name || accountName,
        providerSpecificData: {
          ...(existing.providerSpecificData || {}),
          userId: userId || existing.providerSpecificData?.userId,
          fingerprintId: body.fingerprintId || existing.providerSpecificData?.fingerprintId,
          fingerprintHash: body.fingerprintHash || existing.providerSpecificData?.fingerprintHash,
          authMethod: "manual_token",
        },
        testStatus: "active",
      });
      connection = { id: existing.id, name: existing.name || accountName, email };
      try {
        seedAccountCredentials(existing.id, {
          default: {
            id: userId || existing.providerSpecificData?.userId || null,
            name: userInfo?.name || existing.providerSpecificData?.name || accountName,
            email: email || existing.email || null,
            authToken,
            fingerprintId: body.fingerprintId || existing.providerSpecificData?.fingerprintId || null,
            fingerprintHash: body.fingerprintHash || existing.providerSpecificData?.fingerprintHash || null,
          },
        });
      } catch (e) {
        console.warn("[Freebuff Import] Failed to seed credentials:", e.message);
      }
    } else {
      const created = await createProviderConnection({
        provider: "freebuff",
        authType: "oauth",
        name: accountName,
        email: email,
        accessToken: authToken,
        apiKey: authToken,
        expiresAt: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        providerSpecificData: {
          userId: userId || null,
          fingerprintId: body.fingerprintId || null,
          fingerprintHash: body.fingerprintHash || null,
          authMethod: "manual_token",
        },
        testStatus: "active",
      });
      connection = { id: created.id, name: created.name, email: created.email };
      try {
        seedAccountCredentials(created.id, {
          default: {
            id: userId || null,
            name: userInfo?.name || accountName,
            email: email || null,
            authToken,
            fingerprintId: body.fingerprintId || null,
            fingerprintHash: body.fingerprintHash || null,
          },
        });
      } catch (e) {
        console.warn("[Freebuff Import] Failed to seed credentials:", e.message);
      }
    }

    return NextResponse.json({
      success: true,
      connection,
      // Whitelist non-secret profile fields — never echo the raw upstream
      // payload back to the client.
      user: { id: userId, email, name: userInfo?.name ?? null },
    });
  } catch (error) {
    console.error("[Freebuff Import] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
