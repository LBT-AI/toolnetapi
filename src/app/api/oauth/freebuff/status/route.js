import { NextResponse } from "next/server";
import { FreebuffService } from "@/lib/oauth/services/freebuff";
import { createProviderConnection, getProviderConnections, updateProviderConnection } from "@/models";

/**
 * GET /api/oauth/freebuff/status
 * Poll login status for a pending Freebuff browser login.
 * Once confirmed, automatically creates or updates the connection.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fingerprintId = searchParams.get("fingerprintId");
    const fingerprintHash = searchParams.get("fingerprintHash");
    const expiresAt = searchParams.get("expiresAt");
    const customLabel = searchParams.get("label")?.trim();

    if (!fingerprintId || !fingerprintHash) {
      return NextResponse.json(
        { error: "fingerprintId and fingerprintHash are required" },
        { status: 400 }
      );
    }

    const service = new FreebuffService();
    const result = await service.pollLoginStatus({
      fingerprintId,
      fingerprintHash,
      expiresAt: expiresAt ? Number(expiresAt) : undefined,
    });

    if (result.status === "pending") {
      return NextResponse.json({ status: "pending" });
    }

    if (result.status === "error") {
      return NextResponse.json(
        { status: "error", error: result.error || "Login failed" },
        { status: 400 }
      );
    }

    if (result.status === "success" && result.user) {
      const user = result.user;
      const email = user.email || null;
      const accountName =
        customLabel ||
        (user.name && email
          ? `${user.name} (${email})`
          : email || user.name || `Freebuff ${user.id?.slice(0, 8) || "Account"}`);

      // Check if connection with this email or userId already exists
      const existingConns = await getProviderConnections({ provider: "freebuff" });
      const existing = existingConns.find(
        (c) =>
          (email && c.email === email) ||
          (user.id && c.providerSpecificData?.userId === user.id) ||
          c.apiKey === user.authToken ||
          c.accessToken === user.authToken
      );

      let connection;
      if (existing) {
        // Update existing connection with new token
        await updateProviderConnection(existing.id, {
          accessToken: user.authToken,
          apiKey: user.authToken,
          isActive: true,
          email: email || existing.email,
          name: customLabel || existing.name || accountName,
          providerSpecificData: {
            ...(existing.providerSpecificData || {}),
            userId: user.id || existing.providerSpecificData?.userId,
            name: user.name || existing.providerSpecificData?.name,
            fingerprintId: user.fingerprintId || fingerprintId,
            fingerprintHash: user.fingerprintHash || fingerprintHash,
            authMethod: "browser_login",
          },
          testStatus: "active",
        });
        connection = { id: existing.id, name: accountName, email };
      } else {
        // Create new connection
        const created = await createProviderConnection({
          provider: "freebuff",
          authType: "oauth",
          name: accountName,
          email: email,
          accessToken: user.authToken,
          apiKey: user.authToken,
          expiresAt: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
          providerSpecificData: {
            userId: user.id || null,
            name: user.name || null,
            fingerprintId: user.fingerprintId || fingerprintId,
            fingerprintHash: user.fingerprintHash || fingerprintHash,
            authMethod: "browser_login",
          },
          testStatus: "active",
        });
        connection = { id: created.id, name: created.name, email: created.email };
      }

      return NextResponse.json({
        status: "success",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        connection,
      });
    }

    return NextResponse.json({ status: "pending" });
  } catch (error) {
    console.error("[Freebuff Status] Polling error:", error);
    return NextResponse.json(
      { status: "error", error: error.message || "Failed to check login status" },
      { status: 500 }
    );
  }
}
