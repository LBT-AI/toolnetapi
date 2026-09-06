"use server";

import { NextResponse } from "next/server";
import { getAgent } from "@/models";

export async function POST(request, { params }) {
  try {
    const agent = await getAgent(params.id);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    if (agent.revokedAt) {
      return NextResponse.json({ error: "Agent revoked" }, { status: 403 });
    }

    const body = await request.json();
    const { command, payload } = body;

    if (!command) {
      return NextResponse.json({ error: "command required" }, { status: 400 });
    }

    const commandId = global.__toolnetQueueCommand(params.id, command, payload);

    return NextResponse.json({ commandId, queued: true });
  } catch (error) {
    console.log("Error sending command:", error.message);
    return NextResponse.json({ error: "Failed to send command" }, { status: 500 });
  }
}