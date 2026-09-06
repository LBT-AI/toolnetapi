import { NextResponse } from "next/server";
import { KiroService } from "@/lib/oauth/services/kiro";
import { createProviderConnection } from "@/models";

/**
 * POST /api/oauth/kiro/import
 * Import and validate refresh token from Kiro IDE.
 * For IDC (organization) tokens, accepts clientId/clientSecret/region so the
 * token can be refreshed via the regional AWS OIDC endpoint.
 */
export async function POST(request) {
  try {
    const { refreshToken, clientId, clientSecret, region, authMethod, profileArn } = await request.json();

    if (!refreshToken || typeof refreshToken !== "string") {
      return NextResponse.json(
        { error: "Refresh token is required" },
        { status: 400 }
      );
    }

    const kiroService = new KiroService();
    const isIdc = !!(clientId && clientSecret);

    // For IDC tokens, refresh via the regional OIDC endpoint with client credentials.
    // For social/builder-id tokens, use the standard social refresh endpoint.
    const providerSpecificData = isIdc
      ? { clientId, clientSecret, region: region || "us-east-1", authMethod: "idc" }
      : {};

    const tokenData = await kiroService.refreshToken(refreshToken.trim(), providerSpecificData);

    const { resolveKiroIdentity } = await import("@/lib/oauth/providers");
    const identity = resolveKiroIdentity({
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken || refreshToken.trim(),
      profileArn: resolvedProfileArn,
    }, {
      email,
      authMethod: resolvedAuthMethod,
    });

    const connection = await createProviderConnection({
      provider: "kiro",
      authType: "oauth",
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken || refreshToken.trim(),
      expiresAt: new Date(Date.now() + (tokenData.expiresIn || 3600) * 1000).toISOString(),
      email: identity.email || email || null,
      name: identity.displayName,
      providerSpecificData: {
        profileArn: resolvedProfileArn,
        identityKey: identity.identityKey,
        authMethod: resolvedAuthMethod,
        provider: providerLabel,
        ...(isIdc ? { clientId, clientSecret, region: region || "us-east-1" } : {}),
      },
      testStatus: "active",
    });

    const isDuplicate = !!(connection._isDuplicate || connection.updatedExisting);
    return NextResponse.json({
      success: true,
      duplicate: isDuplicate,
      updatedExisting: isDuplicate,
      connection: {
        id: connection.id,
        provider: connection.provider,
        email: connection.email,
        displayName: connection.name || connection.email,
      },
    });
  } catch (error) {
    console.log("Kiro import token error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
