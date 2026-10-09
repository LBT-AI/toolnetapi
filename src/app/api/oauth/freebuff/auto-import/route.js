import { NextResponse } from "next/server";
import { FreebuffService } from "@/lib/oauth/services/freebuff";
import { createProviderConnection, getProviderConnections, updateProviderConnection } from "@/models";
import { seedAccountCredentials } from "open-sse/services/freebuff/accountManager.js";

/**
 * GET /api/oauth/freebuff/auto-import
 * List account metadata detected from ~/.config/manicode/credentials.json.
 * NEVER returns authToken / fingerprintHash — the UI only needs name/email/id/profileKey.
 */
export async function GET() {
  try {
    const service = new FreebuffService();
    const { found, accounts, configPath } = await service.readLocalCredentials();
    const safeAccounts = accounts.map((acc) => ({
      profileKey: acc.profileKey,
      id: acc.id || null,
      name: acc.name || acc.profileKey,
      email: acc.email || null,
    }));
    return NextResponse.json({ found, accounts: safeAccounts, configPath });
  } catch (error) {
    return NextResponse.json({ found: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/oauth/freebuff/auto-import
 * Import all or specific account from detected CLI credentials
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const profileKey = body.profileKey; // optional: import specific profile

    const service = new FreebuffService();
    const { found, accounts } = await service.readLocalCredentials();

    if (!found || accounts.length === 0) {
      return NextResponse.json(
        { error: "No local Freebuff CLI credentials found. Run 'freebuff login' first." },
        { status: 404 }
      );
    }

    const toImport = profileKey
      ? accounts.filter((a) => a.profileKey === profileKey)
      : accounts;

    if (toImport.length === 0) {
      return NextResponse.json({ error: `Account profile '${profileKey}' not found` }, { status: 404 });
    }

    const existingConns = await getProviderConnections({ provider: "freebuff" });
    const imported = [];

    for (const acc of toImport) {
      const email = acc.email || null;
      const name = acc.name && email ? `${acc.name} (${email})` : email || acc.name || `Freebuff ${acc.id?.slice(0, 8) || "CLI"}`;

      // A local credentials file only proves the CLI logged in once — verify the
      // token against Freebuff before marking the connection Active. Unverified
      // accounts are still imported (usable via the PTY) but not labelled Active.
      let verified = false;
      let verifyError = null;
      try {
        const profile = await service.getUserInfo(acc.authToken);
        verified = !!profile;
      } catch (err) {
        verifyError = err.message || "Token validation failed";
      }
      const testStatus = verified ? "active" : "unknown";
      const verificationFields = verified
        ? { testStatus }
        : { testStatus, lastError: verifyError, lastErrorAt: new Date().toISOString() };

      const existing = existingConns.find(
        (c) =>
          (email && c.email === email) ||
          (acc.id && c.providerSpecificData?.userId === acc.id) ||
          c.apiKey === acc.authToken ||
          c.accessToken === acc.authToken
      );

      if (existing) {
        await updateProviderConnection(existing.id, {
          accessToken: acc.authToken,
          apiKey: acc.authToken,
          isActive: true,
          email: email || existing.email,
          name: existing.name || name,
          providerSpecificData: {
            ...(existing.providerSpecificData || {}),
            userId: acc.id || existing.providerSpecificData?.userId,
            name: acc.name || existing.providerSpecificData?.name,
            fingerprintId: acc.fingerprintId || existing.providerSpecificData?.fingerprintId,
            fingerprintHash: acc.fingerprintHash || existing.providerSpecificData?.fingerprintHash,
            authMethod: "cli_import",
          },
          ...verificationFields,
        });
        imported.push({ id: existing.id, name: existing.name || name, email, updated: true, testStatus });
        try {
          seedAccountCredentials(existing.id, {
            default: {
              id: acc.id || existing.providerSpecificData?.userId || null,
              name: acc.name || existing.providerSpecificData?.name || name,
              email: email || existing.email || null,
              authToken: acc.authToken,
              fingerprintId: acc.fingerprintId || existing.providerSpecificData?.fingerprintId || null,
              fingerprintHash: acc.fingerprintHash || existing.providerSpecificData?.fingerprintHash || null,
            },
          });
        } catch (e) {
          console.warn("[Freebuff Auto-Import] Failed to seed credentials:", e.message);
        }
      } else {
        const created = await createProviderConnection({
          provider: "freebuff",
          authType: "oauth",
          name,
          email,
          accessToken: acc.authToken,
          apiKey: acc.authToken,
          expiresAt: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
          providerSpecificData: {
            userId: acc.id || null,
            name: acc.name || null,
            fingerprintId: acc.fingerprintId || null,
            fingerprintHash: acc.fingerprintHash || null,
            authMethod: "cli_import",
          },
          ...verificationFields,
        });
        imported.push({ id: created.id, name: created.name, email: created.email, created: true, testStatus });
        try {
          seedAccountCredentials(created.id, {
            default: {
              id: acc.id || null,
              name: acc.name || name,
              email: email || null,
              authToken: acc.authToken,
              fingerprintId: acc.fingerprintId || null,
              fingerprintHash: acc.fingerprintHash || null,
            },
          });
        } catch (e) {
          console.warn("[Freebuff Auto-Import] Failed to seed credentials:", e.message);
        }
      }
    }

    return NextResponse.json({
      success: true,
      importedCount: imported.length,
      connections: imported,
    });
  } catch (error) {
    console.error("[Freebuff Auto-Import] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
