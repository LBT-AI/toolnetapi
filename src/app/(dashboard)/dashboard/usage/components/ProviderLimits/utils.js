import { getModelsByProviderId } from "open-sse/config/providerModels.js";

// ─── Constants ───────────────────────────────────────────────────────────────
export const QUOTA_CACHE_KEY = "quotaCacheData";
export const REFRESH_INTERVAL_MS = 60000;
// Claude usage/quota endpoint rate-limits; poll it less often than other providers
export const CLAUDE_REFRESH_INTERVAL_MS = 180000;
export const KIRO_REFRESH_INTERVAL_MS = 120000;
export const DEPLETED_QUOTA_THRESHOLD = 5;
export const AUTO_REFRESH_STORAGE_KEY = "quotaAutoRefresh";
export const CONNECTIONS_PAGE_SIZE = 20;
export const ACCOUNT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
export const ACCOUNT_PAGE_SIZE_MAX = 500;
export const ACCOUNT_FILTER_OPTIONS = [
  { value: "all", label: "All accounts" },
  { value: "active", label: "Enabled" },
  { value: "inactive", label: "Disabled" },
  { value: "working", label: "Working" },
  { value: "auth-error", label: "Auth Error" },
  { value: "quota-available", label: "Quota Available" },
  { value: "quota-unavailable", label: "Quota Unavailable" },
  { value: "quota-unsupported", label: "Quota Unsupported" },
];
export const QUOTA_SORT_OPTIONS = [
  { value: "default", label: "Default order" },
  { value: "remaining-asc", label: "% Quota: Low to High" },
  { value: "remaining-desc", label: "% Quota: High to Low" },
  { value: "reset-earliest", label: "Reset: Earliest First" },
  { value: "error-first", label: "Status: Errors First" },
];

// ─── Pure helpers ─────────────────────────────────────────────────────────────
export function getConnectionLabel(connection) {
  return connection.name?.trim()
    || connection.email?.trim()
    || connection.displayName?.trim()
    || null;
}

export function getConnectionStatus(connection) {
  return (connection.isActive ?? true) ? "ENABLED" : "DISABLED";
}

export function getAuthenticationStatus(connection, quotaEntry) {
  if (connection.isActive === false) {
    return "DISABLED";
  }

  if (quotaEntry?.authStatus) {
    return quotaEntry.authStatus;
  }

  const expiryTime = connection.expiresAt || connection.tokenExpiresAt;
  if (expiryTime) {
    const expiresMs = new Date(expiryTime).getTime();
    if (Number.isFinite(expiresMs) && expiresMs < Date.now()) {
      return "EXPIRED";
    }
  }

  const errorText = String(connection.lastError || "").toLowerCase();
  const errorCode = connection.errorCode;

  if (
    errorCode === 401 ||
    errorText.includes("401") ||
    errorText.includes("unauthorized") ||
    errorText.includes("token expired") ||
    errorText.includes("invalid_grant") ||
    errorText.includes("re-authorize")
  ) {
    return "INVALID";
  }

  if (connection.testStatus === "active" || connection.testStatus === "success") {
    return "VALID";
  }

  if (quotaEntry?.quotas?.length > 0 && quotaEntry?.source === "live") {
    return "VALID";
  }

  return "UNKNOWN";
}

export function getInferenceStatus(connection, quotaEntry) {
  const errorText = String(connection.lastError || "").toLowerCase();
  const errorCode = connection.errorCode;

  if (
    errorCode === 429 ||
    errorText.includes("429") ||
    errorText.includes("rate limit") ||
    errorText.includes("too many requests") ||
    quotaEntry?.quotaStatus === "RATE_LIMITED"
  ) {
    return "RATE_LIMITED";
  }

  if (
    connection.testStatus === "error" ||
    connection.testStatus === "unavailable" ||
    (errorCode && errorCode >= 500) ||
    errorText.includes("500") ||
    errorText.includes("502") ||
    errorText.includes("503") ||
    errorText.includes("internal server error")
  ) {
    return "FAILED";
  }

  if (connection.testStatus === "active" || connection.testStatus === "success") {
    return "WORKING";
  }

  if (connection.consecutiveUseCount > 0 && !connection.lastError) {
    return "WORKING";
  }

  if (connection.testStatus === "unknown" || !connection.testStatus) {
    return "NOT_TESTED";
  }

  return "UNKNOWN";
}

export function getQuotaStatus(connection, quotaEntry, isLoading = false, error = null) {
  if (isLoading) {
    return "LOADING";
  }

  if (error) {
    if (quotaEntry?.source === "stale") {
      return "STALE";
    }
    return "FETCH_ERROR";
  }

  if (quotaEntry?.quotaStatus) {
    return quotaEntry.quotaStatus;
  }

  if (quotaEntry?.status === "UNSUPPORTED") {
    return "UNSUPPORTED";
  }

  if (quotaEntry?.source === "stale") {
    return "STALE";
  }

  if (quotaEntry?.quotas?.length > 0) {
    return "AVAILABLE";
  }

  if (quotaEntry?.message) {
    const msg = quotaEntry.message.toLowerCase();
    if (msg.includes("not supported") || msg.includes("not implemented")) {
      return "UNSUPPORTED";
    }
    return "UNAVAILABLE";
  }

  return "UNAVAILABLE";
}

export function sanitizeErrorMessage(errorStr) {
  if (typeof errorStr !== "string" || !errorStr.trim()) return null;
  return errorStr
    .replace(/bearer\s+[a-zA-Z0-9_\-.]+/gi, "Bearer [REDACTED]")
    .replace(/sk-[a-zA-Z0-9_\-]{16,}/gi, "sk-[REDACTED]")
    .replace(/gh[pousr]_[a-zA-Z0-9_]{16,}/gi, "[REDACTED]")
    .replace(/[a-zA-Z0-9_\-.]{32,}/g, (m) => `${m.slice(0, 4)}***${m.slice(-4)}`);
}

export function formatTimeAgo(dateValue) {
  if (!dateValue) return null;
  const timeMs = new Date(dateValue).getTime();
  if (!Number.isFinite(timeMs)) return null;

  const diffSec = Math.max(0, Math.floor((Date.now() - timeMs) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function getConnectionQuotaRemaining(connection, quotaData) {
  const quota = quotaData[connection.id]?.quotas?.[0];
  if (!quota) return Number.POSITIVE_INFINITY;
  if (typeof quota.remainingPercentage === "number") return quota.remainingPercentage;
  if (typeof quota.remaining === "number") return quota.remaining;
  if (quota.total && typeof quota.used === "number") {
    return calculatePercentage(quota.used, quota.total);
  }
  return Number.POSITIVE_INFINITY;
}

export function filterConnectionsByAccountStatus(connections, quotaData, filter) {
  if (!filter || filter === "all") return connections;

  return connections.filter((conn) => {
    const isEnabled = conn.isActive !== false;
    const quota = quotaData[conn.id];

    if (filter === "active" || filter === "enabled") return isEnabled;
    if (filter === "inactive" || filter === "disabled") return !isEnabled;
    if (filter === "working") {
      return getInferenceStatus(conn, quota) === "WORKING";
    }
    if (filter === "auth-error") {
      const auth = getAuthenticationStatus(conn, quota);
      return auth === "EXPIRED" || auth === "INVALID";
    }
    if (filter === "quota-available") {
      return getQuotaStatus(conn, quota) === "AVAILABLE";
    }
    if (filter === "quota-unavailable") {
      const qStatus = getQuotaStatus(conn, quota);
      return qStatus === "UNAVAILABLE" || qStatus === "FETCH_ERROR";
    }
    if (filter === "quota-unsupported") {
      return getQuotaStatus(conn, quota) === "UNSUPPORTED";
    }
    return true;
  });
}

export function sortVisibleConnections(
  connections,
  quotaData,
  expiringFirst,
  providerFilter,
  quotaSortMode,
) {
  if (quotaSortMode === "remaining-asc" || quotaSortMode === "remaining-desc") {
    return [...connections].sort((a, b) => {
      const remainingA = getConnectionQuotaRemaining(a, quotaData);
      const remainingB = getConnectionQuotaRemaining(b, quotaData);
      const remainingDiff =
        quotaSortMode === "remaining-asc"
          ? remainingA - remainingB
          : remainingB - remainingA;
      if (remainingDiff !== 0) return remainingDiff;
      return (getConnectionLabel(a) || "").localeCompare(
        getConnectionLabel(b) || "",
      );
    });
  }

  if (quotaSortMode === "reset-earliest" || expiringFirst) {
    const getEarliestResetTime = (connection) => {
      const resetTimes = (quotaData[connection.id]?.quotas || [])
        .map((quota) =>
          quota.resetAt
            ? new Date(quota.resetAt).getTime()
            : Number.POSITIVE_INFINITY,
        )
        .filter((time) => Number.isFinite(time));
      return resetTimes.length > 0
        ? Math.min(...resetTimes)
        : Number.POSITIVE_INFINITY;
    };

    return [...connections].sort((a, b) => {
      const expiryDiff = getEarliestResetTime(a) - getEarliestResetTime(b);
      if (expiryDiff !== 0) return expiryDiff;
      return (
        (a.provider || "").localeCompare(b.provider || "") ||
        (getConnectionLabel(a) || "").localeCompare(getConnectionLabel(b) || "")
      );
    });
  }

  if (quotaSortMode === "error-first") {
    const hasError = (c) => {
      const q = quotaData[c.id];
      const auth = getAuthenticationStatus(c, q);
      const inf = getInferenceStatus(c, q);
      const quotaSt = getQuotaStatus(c, q);
      return (
        auth === "EXPIRED" ||
        auth === "INVALID" ||
        inf === "FAILED" ||
        quotaSt === "FETCH_ERROR" ||
        quotaSt === "UNAVAILABLE"
      );
    };

    return [...connections].sort((a, b) => {
      const errA = hasError(a) ? 0 : 1;
      const errB = hasError(b) ? 0 : 1;
      if (errA !== errB) return errA - errB;
      return (a.provider || "").localeCompare(b.provider || "");
    });
  }

  return connections;
}

export function buildLoadingState(connections) {
  const nextLoadingState = {};
  connections.forEach((connection) => {
    nextLoadingState[connection.id] = true;
  });
  return nextLoadingState;
}

export function filterQuotaStateByConnections(state, connections) {
  const visibleIds = new Set(connections.map((connection) => connection.id));
  return Object.fromEntries(
    Object.entries(state).filter(([id]) => visibleIds.has(id)),
  );
}

export function getConnectionsPageRange(pagination) {
  if (!pagination.total) {
    return { start: 0, end: 0 };
  }
  const start = (pagination.page - 1) * pagination.pageSize + 1;
  const end = Math.min(pagination.page * pagination.pageSize, pagination.total);
  return { start, end };
}

export function getConnectionsEmptyMessage(totals, providerFilter, accountFilter) {
  if (!totals.eligibleConnections) {
    return {
      icon: "cloud_off",
      title: "No Providers Connected",
      description:
        "Connect to providers with OAuth to track your API quota limits and usage.",
    };
  }
  if (!totals.providerFilteredConnections) {
    return {
      icon: "filter_alt_off",
      title: "No Accounts Match Current Filters",
      description:
        providerFilter === "all"
          ? "Try changing the account status filter to see more quota trackers."
          : `No ${accountFilter === "inactive" ? "turned off" : accountFilter === "active" ? "active" : "matching"} accounts found for ${providerFilter}.`,
    };
  }
  return {
    icon: "filter_alt_off",
    title: "No Accounts On This Page",
    description:
      "Try moving to another page or refreshing the current filters.",
  };
}

export function sortRequestFromExpiringFirst(expiringFirst) {
  return expiringFirst ? "expiring" : "priority";
}

export function getPageSizeLabel(pageSize, isCustomPageSize) {
  return isCustomPageSize ? `Custom: ${pageSize} / page` : `${pageSize} / page`;
}

export function getConnectionsPaginationSummary(pagination) {
  const { start, end } = getConnectionsPageRange(pagination);
  return `Showing ${start}-${end} of ${pagination.total}`;
}

export function getSafePagination(pagination, fallbackPageSize) {
  return (
    pagination || {
      page: 1,
      pageSize: fallbackPageSize,
      total: 0,
      totalPages: 1,
    }
  );
}

export function getSafeTotals(totals, fallbackTotal = 0) {
  return (
    totals || {
      eligibleConnections: fallbackTotal,
      providerFilteredConnections: fallbackTotal,
    }
  );
}

export function shouldResetPage(previousValue, nextValue) {
  return previousValue !== nextValue;
}

export function getPaginationPageValue(dataPagination, fallbackPage) {
  return dataPagination?.page || fallbackPage;
}

export function getProviderOptions(dataProviderOptions) {
  return dataProviderOptions || [];
}

export async function reconcileConnectionsPage(fetchConnections, targetPage) {
  return await fetchConnections(targetPage);
}

export function getQuotaCache() {
  if (typeof window === "undefined") return {};
  try {
    const cached = window.localStorage.getItem(QUOTA_CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch (error) {
    console.error("Error reading quota cache:", error);
    return {};
  }
}

export function setQuotaCache(connectionId, quotaEntry) {
  if (typeof window === "undefined") return;
  try {
    const cache = getQuotaCache();
    cache[connectionId] = {
      ...quotaEntry,
      cachedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(QUOTA_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error("Error writing quota cache:", error);
  }
}

/**
 * Format ISO date string to countdown format (inspired by vscode-antigravity-cockpit)
 * @param {string|Date} date - ISO date string or Date object
 * @returns {string} Formatted countdown (e.g., "2d 5h 30m", "4h 40m", "15m") or "-"
 */
export function formatResetTime(date) {
  if (!date) return "-";

  try {
    const resetDate = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diffMs = resetDate - now;

    if (diffMs <= 0) return "-";

    const totalMinutes = Math.ceil(diffMs / (1000 * 60));
    
    // < 60 minutes: show only minutes
    if (totalMinutes < 60) {
      return `${totalMinutes}m`;
    }
    
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    
    // < 24 hours: show hours and minutes
    if (totalHours < 24) {
      return `${totalHours}h ${remainingMinutes}m`;
    }
    
    // >= 24 hours: show days, hours, and minutes
    const days = Math.floor(totalHours / 24);
    const remainingHours = totalHours % 24;
    return `${days}d ${remainingHours}h ${remainingMinutes}m`;
  } catch (error) {
    return "-";
  }
}

/**
 * Get Tailwind color class based on percentage
 * @param {number} percentage - Remaining percentage (0-100)
 * @returns {string} Color name: "green" | "yellow" | "red"
 */
export function getStatusColor(percentage) {
  if (percentage > 70) return "green";
  if (percentage >= 30) return "yellow";
  return "red"; // 0-29% including 0% (out of quota) - show red
}

/**
 * Get status emoji based on percentage
 * @param {number} percentage - Remaining percentage (0-100)
 * @returns {string} Emoji: "🟢" | "🟡" | "🔴"
 */
export function getStatusEmoji(percentage) {
  if (percentage > 70) return "🟢";
  if (percentage >= 30) return "🟡";
  return "🔴"; // 0-29% including 0% (out of quota) - show red
}

/**
 * Calculate remaining percentage
 * @param {number} used - Used amount
 * @param {number} total - Total amount
 * @returns {number} Remaining percentage (0-100)
 */
export function calculatePercentage(used, total) {
  if (!total || total === 0) return 0;
  if (!used || used < 0) return 100;
  if (used >= total) return 0;

  return Math.round(((total - used) / total) * 100);
}

/**
 * Get remaining percentage from a normalized quota row
 * @param {Object} quota - Normalized quota object
 * @returns {number} Remaining percentage (0-100)
 */
export function getRemainingPercentage(quota) {
  if (quota?.remaining !== undefined) {
    return Math.max(0, Math.round(quota.remaining));
  }

  if (quota?.remainingPercentage !== undefined) {
    return Math.round(quota.remainingPercentage);
  }

  return calculatePercentage(quota?.used, quota?.total);
}

export function getQuotaVisibilityKey(quota) {
  if (!quota || typeof quota !== "object") return "";
  return String(quota.modelKey || quota.name || "").trim();
}

/**
 * Trim hidden quota keys to only those matching currently valid quotas.
 * Stale or obsolete model keys are dropped.
 */
export function trimHiddenQuotaKeys(hidden = [], quotas = []) {
  if (!Array.isArray(hidden) || hidden.length === 0) return [];
  const validKeys = new Set(quotas.map(getQuotaVisibilityKey).filter(Boolean));
  return [...new Set(hidden.map((k) => String(k).trim()).filter((k) => validKeys.has(k)))];
}

function getProviderHiddenQuotaSet(provider, quotaVisibility, quotas = []) {
  const hidden = quotaVisibility?.[provider]?.hidden;
  if (!Array.isArray(hidden) || hidden.length === 0) return new Set();
  const trimmed = quotas.length > 0 ? trimHiddenQuotaKeys(hidden, quotas) : hidden;
  return new Set(trimmed.map(String));
}

export function filterQuotasByVisibility(provider, quotas = [], quotaVisibility = {}) {
  if (!Array.isArray(quotas) || quotas.length === 0) return [];
  const hidden = getProviderHiddenQuotaSet(provider, quotaVisibility, quotas);
  if (hidden.size === 0) return quotas;
  return quotas.filter((quota) => !hidden.has(getQuotaVisibilityKey(quota)));
}

export function getHiddenQuotaRows(provider, quotas = [], quotaVisibility = {}) {
  if (!Array.isArray(quotas) || quotas.length === 0) return [];
  const hidden = getProviderHiddenQuotaSet(provider, quotaVisibility, quotas);
  if (hidden.size === 0) return [];
  return quotas.filter((quota) => hidden.has(getQuotaVisibilityKey(quota)));
}

/**
 * Parse provider-specific quota structures into normalized array
 * @param {string} provider - Provider name (github, antigravity, codex, kiro, claude)
 * @param {Object} data - Raw quota data from provider
 * @returns {Array<Object>} Normalized quota objects with { name, used, total, resetAt }
 */
export function parseQuotaData(provider, data) {
  if (!data || typeof data !== "object") return [];

  const normalizedQuotas = [];

  try {
    switch (provider.toLowerCase()) {
      case "github":
        if (data.quotas) {
          Object.entries(data.quotas).forEach(([name, quota]) => {
            normalizedQuotas.push({
              name,
              used: quota.used || 0,
              total: quota.total || 0,
              resetAt: quota.resetAt || null,
            });
          });
        }
        break;

      case "antigravity":
        if (data.quotas) {
          const entries = Object.entries(data.quotas);
          const geminiModels = entries.filter(([k]) => k.startsWith("gemini-") && !k.includes("image"));
          const claudeModels = entries.filter(([k]) => k.startsWith("claude-"));
          const imageModels = entries.filter(([k]) => k.includes("image"));
          const otherModels = entries.filter(([k]) => !k.startsWith("gemini-") && !k.startsWith("claude-") && !k.includes("image"));

          if (geminiModels.length > 0) {
            const rep = geminiModels.reduce((min, cur) =>
              (cur[1].remainingPercentage ?? 100) < (min[1].remainingPercentage ?? 100) ? cur : min
            )[1];
            normalizedQuotas.push({
              name: "Gemini (Flash / Pro)",
              modelKey: "gemini",
              used: rep.used || 0,
              total: rep.total || 0,
              resetAt: rep.resetAt || null,
              remainingPercentage: rep.remainingPercentage,
            });
          }

          if (claudeModels.length > 0) {
            const rep = claudeModels.reduce((min, cur) =>
              (cur[1].remainingPercentage ?? 100) < (min[1].remainingPercentage ?? 100) ? cur : min
            )[1];
            normalizedQuotas.push({
              name: "Claude (Sonnet / Opus)",
              modelKey: "claude",
              used: rep.used || 0,
              total: rep.total || 0,
              resetAt: rep.resetAt || null,
              remainingPercentage: rep.remainingPercentage,
            });
          }

          imageModels.forEach(([modelKey, quota]) => {
            normalizedQuotas.push({
              name: quota.displayName || modelKey,
              modelKey,
              used: quota.used || 0,
              total: quota.total || 0,
              resetAt: quota.resetAt || null,
              remainingPercentage: quota.remainingPercentage,
            });
          });

          otherModels.forEach(([modelKey, quota]) => {
            normalizedQuotas.push({
              name: quota.displayName || modelKey,
              modelKey,
              used: quota.used || 0,
              total: quota.total || 0,
              resetAt: quota.resetAt || null,
              remainingPercentage: quota.remainingPercentage,
            });
          });
        }
        break;

      case "codex":
        if (data.quotas) {
          Object.entries(data.quotas).forEach(([quotaType, quota]) => {
            normalizedQuotas.push({
              name: quotaType,
              used: quota.used || 0,
              total: quota.total || 0,
              remaining: quota.remaining,
              resetAt: quota.resetAt || null,
            });
          });
        }
        break;

      case "kiro":
        if (data.quotas) {
          Object.entries(data.quotas).forEach(([quotaType, quota]) => {
            normalizedQuotas.push({
              name: quotaType,
              used: quota.used || 0,
              total: quota.total || 0,
              resetAt: quota.resetAt || null,
            });
          });
        }
        break;

      case "qoder":
        // Qoder ships a `user` quota and (optionally) an `organization`
        // quota, both with same shape: {total, used, remaining, unit, resetAt}.
        // Skip an organization bucket when its total is 0 — most personal
        // Qoder accounts won't have one and rendering "0/0" is misleading.
        // Don't forward Qoder's `remaining` field: it's an absolute credit
        // count, but getRemainingPercentage / QuotaTable interpret
        // `remaining` as a 0-100 percentage and would render 348 credits
        // as "348%". The percentage is computed from used/total instead.
        if (data.quotas) {
          Object.entries(data.quotas).forEach(([quotaType, quota]) => {
            if (quotaType === "organization" && (!quota || (Number(quota.total) || 0) === 0)) {
              return;
            }
            normalizedQuotas.push({
              name: quotaType === "user" ? "Personal" : quotaType === "organization" ? "Organization" : quotaType,
              used: quota.used || 0,
              total: quota.total || 0,
              unit: quota.unit,
              resetAt: quota.resetAt || null,
            });
          });
        }
        break;

      case "claude":
        if (data.message) {
          // Handle error message case
          normalizedQuotas.push({
            name: "error",
            used: 0,
            total: 0,
            resetAt: null,
            message: data.message,
          });
        } else if (data.quotas) {
          Object.entries(data.quotas).forEach(([name, quota]) => {
            normalizedQuotas.push({
              name,
              used: quota.used || 0,
              total: quota.total || 0,
              remaining: quota.remaining !== undefined ? quota.remaining : Math.max(0, (quota.total || 100) - (quota.used || 0)),
              remainingPercentage: quota.remainingPercentage !== undefined ? quota.remainingPercentage : calculatePercentage(quota.used, quota.total),
              resetAt: quota.resetAt || null,
            });
          });
        }
        break;

      case "vercel-ai-gateway":
        // Vercel returns currency credit balance, not request quotas.
        // The 'Remaining (USD)' row needs explicit remainingPercentage because
        // its used/total values would otherwise compute the wrong direction
        // (e.g. used=95.5 / total=100 → 4% instead of 96%).
        if (data.quotas) {
          Object.entries(data.quotas).forEach(([name, quota]) => {
            normalizedQuotas.push({
              name,
              used: quota.used || 0,
              total: quota.total || 0,
              resetAt: quota.resetAt || null,
              remainingPercentage: quota.remainingPercentage,
            });
          });
        }
        break;

      case "codebuddy-cn":
        // CodeBuddy CN mixes recurring refill packs ("Monthly"/"Weekly"/...)
        // with one-shot bonus packs ("Bonus Pack N"). Forward `recurring`
        // so the UI can show "Expires in" for bonus packs (whose resetAt is
        // a hard expiry, not a refresh) instead of "Reset in".
        if (data.quotas) {
          Object.entries(data.quotas).forEach(([name, quota]) => {
            normalizedQuotas.push({
              name,
              used: quota.used || 0,
              total: quota.total || 0,
              resetAt: quota.resetAt || null,
              recurring: quota.recurring !== false,
            });
          });
        }
        break;

      case "kimi":
        if (data.quotas) {
          Object.entries(data.quotas).forEach(([name, quota]) => {
            normalizedQuotas.push({
              name,
              used: quota.used || 0,
              total: quota.total || 0,
              resetAt: quota.resetAt || null,
              remainingPercentage: quota.remainingPercentage,
            });
          });
        }
        break;

      case "groq":
        // Requests/Tokens rate-limit windows from response headers — absolute
        // used/total (calculatePercentage derives the bar), like Codex/Kiro.
        if (data.quotas) {
          Object.entries(data.quotas).forEach(([name, quota]) => {
            normalizedQuotas.push({
              name,
              used: quota.used || 0,
              total: quota.total || 0,
              resetAt: quota.resetAt || null,
            });
          });
        }
        break;

      case "deepseek":
      case "ollama":
        if (data.quotas) {
          Object.entries(data.quotas).forEach(([name, quota]) => {
            normalizedQuotas.push({
              name,
              used: quota.used || 0,
              total: quota.total || 0,
              resetAt: quota.resetAt || null,
              remainingPercentage: quota.remainingPercentage,
            });
          });
        }
        break;

      case "openrouter":
        if (data.quotas) {
          Object.entries(data.quotas).forEach(([name, quota]) => {
            normalizedQuotas.push({
              name: quota.name || name,
              used: quota.used || 0,
              total: quota.total || 0,
              remaining: quota.remaining,
              remainingPercentage: quota.remainingPercentage,
              unit: quota.unit || "USD",
              resetAt: quota.resetAt || null,
            });
          });
        }
        break;

      case "grok-cli":
        // Grok Build credits (on-demand window + prepaid balance).
        // Do NOT forward absolute `remaining` — getRemainingPercentage treats
        // it as a 0–100 percentage (same as Qoder). Use remainingPercentage.
        if (data.quotas) {
          Object.entries(data.quotas).forEach(([name, quota]) => {
            normalizedQuotas.push({
              name,
              used: quota.used || 0,
              total: quota.total || 0,
              resetAt: quota.resetAt || null,
              remainingPercentage: quota.remainingPercentage,
            });
          });
        }
        break;

      default:
        // Generic fallback for unknown providers
        if (data.quotas) {
          Object.entries(data.quotas).forEach(([name, quota]) => {
            normalizedQuotas.push({
              name: quota.name || name,
              used: quota.used || 0,
              total: quota.total || 0,
              remaining: quota.remaining,
              remainingPercentage: quota.remainingPercentage,
              unit: quota.unit,
              resetAt: quota.resetAt || null,
            });
          });
        }
    }
  } catch (error) {
    console.error(`Error parsing quota data for ${provider}:`, error);
    return [];
  }

  if (provider?.toLowerCase() === "claude") {
    const CLAUDE_QUOTA_ORDER = {
      "session (5h)": 0,
      "weekly (7d)": 1,
      "weekly fable (7d)": 2,
      "weekly opus (7d)": 3,
      "weekly sonnet (7d)": 4,
    };
    normalizedQuotas.sort((a, b) => (CLAUDE_QUOTA_ORDER[a.name] ?? 99) - (CLAUDE_QUOTA_ORDER[b.name] ?? 99));
    return normalizedQuotas;
  }

  // Sort quotas according to PROVIDER_MODELS order
  const modelOrder = getModelsByProviderId(provider);
  if (modelOrder.length > 0) {
    const orderMap = new Map(modelOrder.map((m, i) => [m.id, i]));
    
    normalizedQuotas.sort((a, b) => {
      // Use modelKey for antigravity (mapped to family anchor), otherwise use name
      let keyA = a.modelKey || a.name;
      let keyB = b.modelKey || b.name;
      if (keyA === "gemini") keyA = "gemini-3.8-flash-high";
      if (keyA === "claude") keyA = "claude-sonnet-4-6";
      if (keyB === "gemini") keyB = "gemini-3.8-flash-high";
      if (keyB === "claude") keyB = "claude-sonnet-4-6";
      const orderA = orderMap.get(keyA) ?? 999;
      const orderB = orderMap.get(keyB) ?? 999;
      return orderA - orderB;
    });
  }

  return normalizedQuotas;
}
