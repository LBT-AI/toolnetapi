/**
 * Alibaba Model Pool Service
 * 
 * Implements quota-aware, error-aware round-robin model selection for
 * Alibaba Studio connections that have model pools configured.
 * 
 * Each Alibaba connection can have model pools organized into groups:
 *   - light, code, reasoning, vision, fallback
 * 
 * Each model in a pool is tracked independently for:
 *   - Token quota usage (each Alibaba Studio model has its own quota, e.g. 1,000,000)
 *   - Error cooldown (quota/rate-limit/unavailable)
 *   - Round-robin position per pool group
 * 
 * This module only affects provider "alims-intl" (Alibaba Studio).
 */

import { getAlibabaModelPools } from "@/lib/localDb.js";
import { getAdapter } from "@/lib/db/driver.js";
import { DEFAULT_QUOTA_LIMIT, DEFAULT_QUOTA_PERIOD_DAYS } from "@/lib/db/repos/alibabaModelPoolRepo.js";
import { classifyModelToGroup } from "@/shared/constants/alibabaModelGroup.js";

const ALIBABA_PROVIDER_ID = "alims-intl";

export { DEFAULT_QUOTA_LIMIT, DEFAULT_QUOTA_PERIOD_DAYS, classifyModelToGroup };

// In-memory state per connectionId+groupName → per model error state & round-robin index
// Keyed by: `${connectionId}:${groupName}`
const poolState = new Map();

// Quota usage cache: `provider:periodDays` → { modelId: usedTokens }, TTL-bounded.
const quotaUsageCache = new Map();
const QUOTA_CACHE_TTL_MS = 10 * 1000;

// Error cooldown durations (ms)
const COOLDOWN_QUOTA_MS = 60 * 60 * 1000;     // 1 hour for quota exceeded
const COOLDOWN_RATE_MS = 5 * 60 * 1000;        // 5 min for rate limit
const COOLDOWN_UNAVAIL_MS = 10 * 60 * 1000;    // 10 min for model unavailable
const COOLDOWN_ERROR_MS = 2 * 60 * 1000;       // 2 min for generic errors

function getStateKey(connectionId, groupName) {
  return `${connectionId}:${groupName}`;
}

function getPoolState(connectionId, groupName) {
  const key = getStateKey(connectionId, groupName);
  if (!poolState.has(key)) {
    poolState.set(key, {
      roundRobinIndex: 0,
      modelErrors: {}, // modelId → { cooldownUntil, errorCount }
    });
  }
  return poolState.get(key);
}

/**
 * Check if provider is Alibaba Studio
 */
export function isAlibabaProvider(provider) {
  return provider === ALIBABA_PROVIDER_ID;
}

/**
 * Get available model pools for a connection and optional group.
 * Returns all groups if groupName is null.
 */
export async function getConnectionModelPools(connectionId, groupName = null) {
  const pools = await getAlibabaModelPools({
    connectionId,
    isActive: true,
    ...(groupName ? { groupName } : {}),
  });
  return pools;
}

/**
 * Check if model is on cooldown
 */
function isModelOnCooldown(modelId, state) {
  const err = state.modelErrors[modelId];
  if (!err || !err.cooldownUntil) return false;
  return Date.now() < err.cooldownUntil;
}

/**
 * Sum prompt+completion tokens per model from usageHistory for the given provider
 * over the last `periodDays` (0 or null = all-time).
 * Returns a map: modelId → usedTokens.
 */
export async function getModelUsageInDays(provider, periodDays) {
  try {
    const db = await getAdapter();
    const where = [];
    const params = [];
    if (provider) { where.push("provider = ?"); params.push(provider); }
    if (periodDays && periodDays > 0) {
      const cutoff = new Date(Date.now() - periodDays * 86400000).toISOString();
      where.push("timestamp >= ?");
      params.push(cutoff);
    }
    const sql = `SELECT model, SUM(promptTokens + completionTokens) AS tokens FROM usageHistory${where.length ? ` WHERE ${where.join(" AND ")}` : ""} GROUP BY model`;
    const rows = db.all(sql, params);
    const map = {};
    for (const r of rows) {
      if (r.model) map[r.model] = r.tokens || 0;
    }
    return map;
  } catch (e) {
    console.error("[AlibabaModelPool] getModelUsageInDays failed:", e);
    return {};
  }
}

/**
 * Cached provider-wide model usage map (short TTL so quota rotation keeps
 * up with per-request usage writes without a DB query on every selection).
 */
export async function getQuotaUsageMap(provider, periodDays) {
  const days = periodDays && periodDays > 0 ? periodDays : 0;
  const cacheKey = `${provider}:${days}`;
  const cached = quotaUsageCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < QUOTA_CACHE_TTL_MS) {
    return cached.map;
  }
  const map = await getModelUsageInDays(provider, days);
  quotaUsageCache.set(cacheKey, { map, ts: Date.now() });
  return map;
}

/**
 * Select the next model from a pool group using round-robin, skipping:
 *   - models on error cooldown
 *   - models over their token quota (quotaLimit, 0 = unlimited)
 * Returns the model ID or null if all models are unavailable.
 */
export function selectModelFromPool(models, connectionId, groupName, usageMap = null, quotaLimit = 0) {
  if (!models || models.length === 0) return null;
  const state = getPoolState(connectionId, groupName);

  // Find available models (not on cooldown, not over quota)
  const available = models.filter(m => {
    if (isModelOnCooldown(m, state)) return false;
    if (quotaLimit && quotaLimit > 0 && usageMap) {
      if ((usageMap[m] || 0) >= quotaLimit) return false;
    }
    return true;
  });
  if (available.length === 0) return null;

  // Round-robin among available models
  const idx = state.roundRobinIndex % available.length;
  const selected = available[idx];
  state.roundRobinIndex = (state.roundRobinIndex + 1) % available.length;

  return selected;
}

/**
 * Async quota-aware selection used by the chat router.
 */
export async function selectModelFromPoolWithQuota({ provider, models, connectionId, groupName, quotaLimit, quotaPeriodDays }) {
  if (!models || models.length === 0) return null;
  const usageMap = await getQuotaUsageMap(provider, quotaPeriodDays || DEFAULT_QUOTA_PERIOD_DAYS);
  return selectModelFromPool(models, connectionId, groupName, usageMap, quotaLimit || 0);
}

/**
 * Mark a model as errored with appropriate cooldown.
 * @param {string} connectionId 
 * @param {string} groupName - pool group, or "__auto__" if model was auto-selected
 * @param {string} modelId 
 * @param {number} status - HTTP status code
 * @param {string} errorText
 * @returns {{ shouldRotate: boolean }} - whether caller should try next model
 */
export function markModelError(connectionId, groupName, modelId, status, errorText) {
  const state = getPoolState(connectionId, groupName);
  const existing = state.modelErrors[modelId] || { errorCount: 0 };

  let cooldownMs;
  let shouldRotate = true;

  const text = (errorText || "").toLowerCase();
  if (
    text.includes("insufficient_quota") ||
    text.includes("quota exceeded") ||
    text.includes("token quota") ||
    text.includes("quota") ||
    status === 429
  ) {
    // Quota-bucket errors win over generic 429 rate-limit classification,
    // because Alibaba Studio models each have their own 1M-token quota and a
    // quota hit should keep the model benched for the full cooldown.
    cooldownMs = COOLDOWN_QUOTA_MS;
  } else if (text.includes("rate limit") || text.includes("too many")) {
    cooldownMs = COOLDOWN_RATE_MS;
  } else if (
    status === 503 ||
    text.includes("model unavailable") ||
    text.includes("unavailable") ||
    text.includes("model not found") ||
    text.includes("does not exist")
  ) {
    cooldownMs = COOLDOWN_UNAVAIL_MS;
  } else if (status >= 500) {
    cooldownMs = COOLDOWN_ERROR_MS;
  } else {
    // 4xx other than 429 — don't rotate on auth/validation errors
    shouldRotate = false;
    cooldownMs = 0;
  }

  if (cooldownMs > 0) {
    state.modelErrors[modelId] = {
      cooldownUntil: Date.now() + cooldownMs,
      errorCount: existing.errorCount + 1,
      lastError: errorText?.slice(0, 100),
      lastStatus: status,
    };
  }

  return { shouldRotate };
}

/**
 * Mark a model as succeeded — clear its cooldown
 */
export function markModelSuccess(connectionId, groupName, modelId) {
  const state = getPoolState(connectionId, groupName);
  if (state.modelErrors[modelId]) {
    delete state.modelErrors[modelId];
  }
}

/**
 * Get the current pool status for reporting (UI/API)
 */
export async function getPoolStatus(connectionId) {
  const pools = await getAlibabaModelPools({ connectionId });
  const result = {};

  for (const pool of pools) {
    const state = getPoolState(connectionId, pool.groupName);
    const quotaLimit = pool.quotaLimit || DEFAULT_QUOTA_LIMIT;
    const usageMap = await getQuotaUsageMap(ALIBABA_PROVIDER_ID, pool.quotaPeriodDays || DEFAULT_QUOTA_PERIOD_DAYS);
    result[pool.groupName] = {
      groupName: pool.groupName,
      quotaLimit,
      quotaPeriodDays: pool.quotaPeriodDays || DEFAULT_QUOTA_PERIOD_DAYS,
      models: pool.models.map(m => {
        const err = state.modelErrors[m];
        const onCooldown = err && Date.now() < err.cooldownUntil;
        const used = usageMap[m] || 0;
        return {
          id: m,
          available: !onCooldown && !(quotaLimit > 0 && used >= quotaLimit),
          onCooldown,
          overQuota: quotaLimit > 0 && used >= quotaLimit,
          quotaUsed: used,
          quotaLimit,
          cooldownUntil: onCooldown ? new Date(err.cooldownUntil).toISOString() : null,
          errorCount: err?.errorCount || 0,
          lastError: err?.lastError || null,
          lastStatus: err?.lastStatus || null,
        };
      }),
      roundRobinIndex: state.roundRobinIndex,
    };
  }

  return result;
}

/**
 * Reset all cooldowns for a connection (manual override)
 */
export function resetConnectionCooldowns(connectionId) {
  for (const [key, state] of poolState.entries()) {
    if (key.startsWith(`${connectionId}:`)) {
      state.modelErrors = {};
      state.roundRobinIndex = 0;
    }
  }
}

/**
 * Given a target model string (could be a group name like "alims-intl/light"),
 * resolve the actual model ID to use from the pool.
 * Returns null if this is not a pool request.
 * 
 * Format: "alims-intl/<groupName>" → pool lookup
 */
export async function resolveAlibabaPoolModel(provider, model, connectionId) {
  if (!isAlibabaProvider(provider)) return null;

  const groupName = model; // model field contains group name when using pool

  const pools = await getConnectionModelPools(connectionId, groupName);
  if (!pools || pools.length === 0) return null;

  const pool = pools[0];
  if (!pool.models || pool.models.length === 0) return null;

  const selected = await selectModelFromPoolWithQuota({
    provider,
    models: pool.models,
    connectionId,
    groupName,
    quotaLimit: pool.quotaLimit,
    quotaPeriodDays: pool.quotaPeriodDays,
  });
  if (!selected) return null;

  return { resolvedModel: selected, groupName, poolModels: pool.models };
}

/**
 * Get the first available pool group for a connection (used as fallback).
 * Returns "fallback" group if exists, otherwise first available group.
 */
export async function getFallbackPoolGroup(connectionId) {
  const pools = await getAlibabaModelPools({ connectionId, isActive: true });
  if (!pools || pools.length === 0) return null;

  const fallback = pools.find(p => p.groupName === "fallback");
  if (fallback && fallback.models.length > 0) return fallback;

  return pools.find(p => p.models.length > 0) || null;
}
