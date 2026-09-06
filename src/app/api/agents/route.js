"use server";

import { NextResponse } from "next/server";
import { getAllAgents } from "@/models";

export async function GET() {
  try {
    const agents = await getAllAgents();
    const list = Object.values(agents || {}).map(agent => ({
      id: agent.id,
      name: agent.name,
      platform: agent.platform,
      hostname: agent.hostname,
      version: agent.version,
      status: agent.status,
      lastSeenAt: agent.lastSeenAt,
      createdAt: agent.createdAt,
      revokedAt: agent.revokedAt,
      metadata: agent.metadata
    }));
    return NextResponse.json({ agents: list });
  } catch (error) {
    console.log("Error fetching agents:", error.message);
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
}