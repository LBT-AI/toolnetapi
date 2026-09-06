"use server";

import { NextResponse } from "next/server";
import { getAgent, revokeAgent, deleteAgent } from "@/models";

export async function GET(request, { params }) {
  try {
    const agent = await getAgent(params.id);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    const { tokenHash, ...safeAgent } = agent;
    return NextResponse.json(safeAgent);
  } catch (error) {
    console.log("Error fetching agent:", error.message);
    return NextResponse.json({ error: "Failed to fetch agent" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const purge = searchParams.get("purge") === "true";

    if (purge) {
      await deleteAgent(params.id);
    } else {
      await revokeAgent(params.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("Error deleting agent:", error.message);
    return NextResponse.json({ error: "Failed to delete agent" }, { status: 500 });
  }
}