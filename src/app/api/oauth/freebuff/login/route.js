import { NextResponse } from "next/server";
import { FreebuffService } from "@/lib/oauth/services/freebuff";

/**
 * POST /api/oauth/freebuff/login
 * GET /api/oauth/freebuff/login
 * Request a fresh Freebuff browser login URL and session tokens
 */
export async function POST() {
  try {
    const service = new FreebuffService();
    const loginData = await service.requestLoginCode();
    return NextResponse.json({
      success: true,
      ...loginData,
    });
  } catch (error) {
    console.error("[Freebuff Login] Failed to generate login code:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate Freebuff login URL" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}
