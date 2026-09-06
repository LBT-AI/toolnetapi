import { NextResponse } from "next/server";
import { freebuffWorkerPool } from "open-sse/services/freebuff/workerPool.js";

export async function POST(request) {
  try {
    const body = await request.json();
    const connectionId = body?.connectionId;
    if (!connectionId) {
      return NextResponse.json({ error: "connectionId is required" }, { status: 400 });
    }

    const worker = freebuffWorkerPool.restartWorker(connectionId);
    return NextResponse.json({
      success: true,
      status: freebuffWorkerPool.getWorkerStatus(connectionId),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
