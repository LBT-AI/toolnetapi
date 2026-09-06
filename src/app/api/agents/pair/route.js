"use server";

import { NextResponse } from "next/server";
import { verifyPairingCode, consumePairingCode, createAgent } from "@/models";
import crypto from "crypto";

export async function POST(request) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({ error: "Pairing code required" }, { status: 400 });
    }

    const pairingData = await verifyPairingCode(code);
    if (!pairingData) {
      return NextResponse.json({ error: "Invalid pairing code" }, { status: 404 });
    }
    if (pairingData.error) {
      return NextResponse.json({ error: pairingData.error }, { status: 400 });
    }

    const agentId = crypto.randomUUID();
    const agentToken = crypto.randomBytes(32).toString("hex");

    await consumePairingCode(code, agentId, agentToken);

    const agent = await createAgent({
      agentId,
      agentToken,
      deviceInfo: pairingData.deviceInfo
    });

    return NextResponse.json({ agentId, agentToken });
  } catch (error) {
    console.log("Error verifying pairing code:", error.message);
    return NextResponse.json({ error: "Failed to verify pairing code" }, { status: 500 });
  }
}