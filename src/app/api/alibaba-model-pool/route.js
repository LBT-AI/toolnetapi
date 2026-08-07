import { NextResponse } from "next/server";
import {
  getAlibabaModelPools,
  upsertAlibabaModelPool,
  deleteAlibabaModelPool,
  ALIBABA_GROUP_NAMES,
  DEFAULT_QUOTA_LIMIT,
  DEFAULT_QUOTA_PERIOD_DAYS,
} from "@/lib/localDb";
import { getProviderConnections } from "@/lib/localDb";
import {
  getPoolStatus,
  resetConnectionCooldowns,
  getModelUsageInDays,
} from "@/lib/alibaba/modelPool.js";

export const dynamic = "force-dynamic";

// GET /api/alibaba-model-pool?connectionId=xxx[&status=1]
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get("connectionId");
    const withStatus = searchParams.get("status") === "1";

    const filter = {};
    if (connectionId) filter.connectionId = connectionId;

    const pools = await getAlibabaModelPools(filter);
    let status = null;
    let usage = null;
    if (connectionId) {
      if (withStatus) status = await getPoolStatus(connectionId);
      usage = await getModelUsageInDays("alims-intl", 0);
    }

    return NextResponse.json({
      pools,
      status,
      usage,
      groupNames: ALIBABA_GROUP_NAMES,
      defaults: { quotaLimit: DEFAULT_QUOTA_LIMIT, quotaPeriodDays: DEFAULT_QUOTA_PERIOD_DAYS },
    });
  } catch (error) {
    console.error("Error fetching Alibaba model pools:", error);
    return NextResponse.json({ error: "Failed to fetch model pools" }, { status: 500 });
  }
}

// POST /api/alibaba-model-pool
// Body: { connectionId, groupName, models: string[], quotaLimit?, quotaPeriodDays? }
export async function POST(request) {
  try {
    const body = await request.json();
    const { connectionId, groupName, models } = body;
    const quotaLimit = body.quotaLimit ?? DEFAULT_QUOTA_LIMIT;
    const quotaPeriodDays = body.quotaPeriodDays ?? DEFAULT_QUOTA_PERIOD_DAYS;

    if (!connectionId) {
      return NextResponse.json({ error: "connectionId is required" }, { status: 400 });
    }
    if (!groupName || !ALIBABA_GROUP_NAMES.includes(groupName)) {
      return NextResponse.json(
        { error: `groupName must be one of: ${ALIBABA_GROUP_NAMES.join(", ")}` },
        { status: 400 }
      );
    }
    if (!Array.isArray(models)) {
      return NextResponse.json({ error: "models must be an array" }, { status: 400 });
    }
    const cleanModels = [...new Set(models.map(m => String(m).trim()).filter(Boolean))];
    if (cleanModels.length === 0) {
      return NextResponse.json({ error: "models must contain at least one model" }, { status: 400 });
    }

    // Validate connectionId belongs to alims-intl
    const connections = await getProviderConnections({ provider: "alims-intl" });
    const conn = connections.find(c => c.id === connectionId);
    if (!conn) {
      return NextResponse.json({ error: "Connection not found or not an Alibaba Studio connection" }, { status: 404 });
    }

    const pool = await upsertAlibabaModelPool(connectionId, groupName, cleanModels, { quotaLimit, quotaPeriodDays });
    return NextResponse.json({ pool }, { status: 201 });
  } catch (error) {
    console.error("Error upserting Alibaba model pool:", error);
    return NextResponse.json({ error: "Failed to save model pool" }, { status: 500 });
  }
}

// DELETE /api/alibaba-model-pool?id=xxx
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const ok = await deleteAlibabaModelPool(id);
    if (!ok) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting Alibaba model pool:", error);
    return NextResponse.json({ error: "Failed to delete model pool" }, { status: 500 });
  }
}

// PATCH /api/alibaba-model-pool?connectionId=xxx&action=reset-cooldowns
export async function PATCH(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const connectionId = searchParams.get("connectionId");

    if (action === "reset-cooldowns") {
      if (!connectionId) {
        return NextResponse.json({ error: "connectionId is required" }, { status: 400 });
      }
      resetConnectionCooldowns(connectionId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error("Error in Alibaba model pool action:", error);
    return NextResponse.json({ error: "Failed to run action" }, { status: 500 });
  }
}
