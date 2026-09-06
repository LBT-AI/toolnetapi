"use server";

import { NextResponse } from "next/server";
import { createPairingCode } from "@/models";

export async function POST(request) {
  try {
    const body = await request.json();
    const { hostname, platform, deviceName } = body;

    if (!hostname || !platform) {
      return NextResponse.json(
        { error: "hostname and platform required" },
        { status: 400 }
      );
    }

    const result = await createPairingCode({ hostname, platform, deviceName });
    return NextResponse.json(result);
  } catch (error) {
    console.log("Error creating pairing code:", error.message);
    return NextResponse.json({ error: "Failed to create pairing code" }, { status: 500 });
  }
}