// Ensure proxyFetch is loaded to patch globalThis.fetch
import "open-sse/index.js";

import { getProviderConnectionById, updateProviderConnection } from "@/lib/localDb";
import { getUsageForProvider } from "open-sse/services/usage.js";
import { getExecutor } from "open-sse/executors/index.js";
import { resolveConnectionProxyConfig } from "@/lib/network/connectionProxy";
import {
  getProviderCapability,
  hasQuotaSupport,
  getProviderRefreshInterval,
} from "open-sse/services/usageCapabilities.js";

// Server-side in-flight promise deduplication map: connectionId -> Promise<Response>
const inFlightRequests = new Map();

// Server-side quota cache: connectionId -> { data, timestamp, cachedAt }
const serverQuotaCache = new Map();

// Detect auth-expired messages returned by usage providers instead of throwing
const AUTH_EXPIRED_PATTERNS = ["expired", "authentication", "unauthorized", "401", "re-authorize"];
function isAuthExpiredMessage(usage) {
  if (!usage?.message) return false;
  const msg = usage.message.toLowerCase();
  return AUTH_EXPIRED_PATTERNS.some((p) => msg.includes(p));
}

export function sanitizeErrorMessage(errorStr) {
  if (typeof errorStr !== "string" || !errorStr.trim()) return null;
  return errorStr
    .replace(/bearer\s+[a-zA-Z0-9_\-.]+/gi, "Bearer [REDACTED]")
    .replace(/sk-[a-zA-Z0-9_\-]{16,}/gi, "sk-[REDACTED]")
    .replace(/gh[pousr]_[a-zA-Z0-9_]{16,}/gi, "[REDACTED]")
    .replace(/(api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token)[:=]\s*([a-zA-Z0-9_\-.]+)/gi, "$1=[REDACTED]")
    .replace(/[a-zA-Z0-9_\-.]{32,}/g, (m) => `${m.slice(0, 4)}***${m.slice(-4)}`);
}

/**
 * Refresh credentials using executor and update database
 * @param {boolean} force - Skip needsRefresh check and always attempt refresh
 * @returns Promise<{ connection, refreshed: boolean }>
 */
export async function refreshAndUpdateCredentials(connection, force = false, proxyOptions = null) {
  const executor = getExecutor(connection.provider);

  const credentials = {
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
    idToken: connection.idToken,
    expiresAt: connection.expiresAt || connection.tokenExpiresAt,
    lastRefreshAt: connection.lastRefreshAt,
    connectionId: connection.id,
    providerSpecificData: connection.providerSpecificData,
    copilotToken: connection.providerSpecificData?.copilotToken,
    copilotTokenExpiresAt: connection.providerSpecificData?.copilotTokenExpiresAt,
  };

  const needsRefresh = force || executor.needsRefresh(credentials);
  if (!needsRefresh) {
    return { connection, refreshed: false };
  }

  const refreshResult = await executor.refreshCredentials(credentials, console, proxyOptions);
  if (!refreshResult) {
    if (connection.accessToken) {
      return { connection, refreshed: false };
    }
    throw new Error("Failed to refresh credentials. Please re-authorize the connection.");
  }

  const now = new Date().toISOString();
  const updateData = {
    updatedAt: now,
  };

  if (refreshResult.accessToken) {
    updateData.accessToken = refreshResult.accessToken;
  }
  if (refreshResult.refreshToken) {
    updateData.refreshToken = refreshResult.refreshToken;
  }
  if (refreshResult.idToken) {
    updateData.idToken = refreshResult.idToken;
  }
  if (refreshResult.lastRefreshAt) {
    updateData.lastRefreshAt = refreshResult.lastRefreshAt;
  }
  if (refreshResult.expiresIn) {
    updateData.expiresAt = new Date(Date.now() + refreshResult.expiresIn * 1000).toISOString();
    updateData.expiresIn = refreshResult.expiresIn;
  } else if (refreshResult.expiresAt) {
    updateData.expiresAt = refreshResult.expiresAt;
  }

  const providerSpecificUpdates = {
    ...(refreshResult.providerSpecificData || {}),
    ...(refreshResult.copilotToken ? { copilotToken: refreshResult.copilotToken } : {}),
    ...(refreshResult.copilotTokenExpiresAt ? { copilotTokenExpiresAt: refreshResult.copilotTokenExpiresAt } : {}),
  };
  if (Object.keys(providerSpecificUpdates).length > 0) {
    updateData.providerSpecificData = {
      ...(connection.providerSpecificData || {}),
      ...providerSpecificUpdates,
    };
  }

  await updateProviderConnection(connection.id, updateData);

  const updatedConnection = {
    ...connection,
    ...updateData,
    providerSpecificData: updateData.providerSpecificData || connection.providerSpecificData,
  };

  return {
    connection: updatedConnection,
    refreshed: true,
  };
}

/**
 * Core usage fetch implementation
 */
async function fetchConnectionUsage(connectionId, force) {
  const connection = await getProviderConnectionById(connectionId);
  if (!connection) {
    return {
      status: 404,
      body: { error: "Connection not found" },
    };
  }

  const provider = connection.provider;
  const capability = getProviderCapability(provider);
  const cacheTtlMs = Math.min(getProviderRefreshInterval(provider), 60000);

  // Return server cache if fresh and not forced
  if (!force) {
    const cached = serverQuotaCache.get(connectionId);
    if (cached && Date.now() - cached.timestamp < cacheTtlMs) {
      return {
        status: 200,
        body: {
          ...cached.data,
          source: "cached",
          cachedAt: cached.cachedAt,
          capability,
        },
      };
    }
  }

  // If provider has no quota/balance/rate-limit capability, return UNSUPPORTED
  if (!hasQuotaSupport(provider)) {
    return {
      status: 200,
      body: {
        status: "UNSUPPORTED",
        quotaStatus: "UNSUPPORTED",
        authStatus: connection.isActive === false ? "UNKNOWN" : (connection.testStatus === "active" ? "VALID" : "UNKNOWN"),
        source: "unsupported",
        message: `Quota API not supported for ${provider}`,
        capability,
        quotas: {},
      },
    };
  }

  const isOAuth = connection.authType === "oauth";

  // Resolve connection proxy config
  const proxyConfig = await resolveConnectionProxyConfig(connection.providerSpecificData);
  const proxyOptions = {
    connectionProxyEnabled: proxyConfig.connectionProxyEnabled === true,
    connectionProxyUrl: proxyConfig.connectionProxyUrl || "",
    connectionNoProxy: proxyConfig.connectionNoProxy || "",
    vercelRelayUrl: proxyConfig.vercelRelayUrl || "",
    strictProxy: false,
  };

  let activeConnection = connection;

  // Refresh credentials only for OAuth connections with refresh token
  if (isOAuth && connection.refreshToken) {
    try {
      const result = await refreshAndUpdateCredentials(activeConnection, false, proxyOptions);
      activeConnection = result.connection;
    } catch (refreshError) {
      return {
        status: 401,
        body: {
          status: "UNAVAILABLE",
          quotaStatus: "UNAVAILABLE",
          authStatus: "EXPIRED",
          source: "live",
          error: `Credential refresh failed: ${refreshError.message}`,
          message: `Credential refresh failed: ${refreshError.message}`,
          capability,
          quotas: {},
        },
      };
    }
  }

  // Fetch usage from provider
  let usage = await getUsageForProvider(activeConnection, proxyOptions, { force });

  // If provider returned an auth-expired message instead of throwing, force refresh once
  if (isOAuth && isAuthExpiredMessage(usage) && activeConnection.refreshToken) {
    try {
      const retryResult = await refreshAndUpdateCredentials(activeConnection, true, proxyOptions);
      activeConnection = retryResult.connection;
      usage = await getUsageForProvider(activeConnection, proxyOptions, { force });
    } catch {
      // Ignore retry failure, usage will reflect original auth error
    }
  }

  const hasValidQuotas = usage && typeof usage === "object" && (
    (usage.quotas && Object.keys(usage.quotas).length > 0) ||
    usage.status === "AVAILABLE" ||
    usage.quotaStatus === "AVAILABLE"
  );

  const nowIso = new Date().toISOString();

  // If fetch succeeded, update cache
  if (hasValidQuotas) {
    const successData = {
      ...usage,
      status: usage.status || "AVAILABLE",
      quotaStatus: usage.quotaStatus || "AVAILABLE",
      source: "live",
      lastSuccessfulFetch: nowIso,
      capability,
    };
    serverQuotaCache.set(connectionId, {
      data: successData,
      timestamp: Date.now(),
      cachedAt: nowIso,
    });
    return {
      status: 200,
      body: successData,
    };
  }

  // If fetch failed but we have a last-known-good cached quota, return STALE
  const staleCached = serverQuotaCache.get(connectionId);
  if (staleCached?.data?.quotas && Object.keys(staleCached.data.quotas).length > 0) {
    return {
      status: 200,
      body: {
        ...staleCached.data,
        status: "STALE",
        quotaStatus: "STALE",
        source: "stale",
        lastSuccessfulFetch: staleCached.cachedAt,
        message: sanitizeErrorMessage(usage?.message) || "Quota API temporarily unavailable",
        reason: sanitizeErrorMessage(usage?.reason) || "Quota API temporarily unavailable",
        capability,
      },
    };
  }

  // Return live error/unavailable result
  return {
    status: 200,
    body: {
      ...usage,
      message: sanitizeErrorMessage(usage?.message) || usage?.message,
      reason: sanitizeErrorMessage(usage?.reason) || usage?.reason,
      status: usage.status || "UNAVAILABLE",
      quotaStatus: usage.quotaStatus || "UNAVAILABLE",
      source: "live",
      capability,
    },
  };
}

/**
 * GET /api/usage/[connectionId] - Get usage data for a specific connection
 */
export async function GET(request, { params }) {
  try {
    const { connectionId } = await params;
    const force = new URL(request.url).searchParams.get("force") === "1";

    // Request deduplication: return existing in-flight promise if one is already running
    if (inFlightRequests.has(connectionId)) {
      const existing = await inFlightRequests.get(connectionId);
      return Response.json(existing.body, { status: existing.status });
    }

    const fetchPromise = fetchConnectionUsage(connectionId, force);
    inFlightRequests.set(connectionId, fetchPromise);

    try {
      const result = await fetchPromise;
      return Response.json(result.body, { status: result.status });
    } finally {
      inFlightRequests.delete(connectionId);
    }
  } catch (error) {
    const safeError = sanitizeErrorMessage(error?.message) || "Failed to fetch usage";
    return Response.json(
      {
        status: "FETCH_ERROR",
        quotaStatus: "FETCH_ERROR",
        error: safeError,
        message: safeError,
        quotas: {},
      },
      { status: 500 }
    );
  }
}
