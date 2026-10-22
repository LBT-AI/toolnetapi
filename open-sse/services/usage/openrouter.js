import { proxyAwareFetch } from "../../utils/proxyFetch.js";

/**
 * OpenRouter credits / usage handler
 * GET https://openrouter.ai/api/v1/credits
 * Headers: Authorization: Bearer <apiKey>
 */
export async function getOpenRouterUsage(apiKey, proxyOptions = null) {
  if (!apiKey) {
    return {
      status: "UNAVAILABLE",
      message: "OpenRouter API key not configured.",
      quotas: {},
    };
  }

  try {
    const response = await proxyAwareFetch("https://openrouter.ai/api/v1/credits", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    }, proxyOptions);

    if (response.status === 401 || response.status === 403) {
      return {
        status: "UNAVAILABLE",
        authStatus: "INVALID",
        message: "OpenRouter API key rejected (HTTP 401/403).",
        reason: `HTTP ${response.status}`,
        quotas: {},
      };
    }

    if (!response.ok) {
      return {
        status: "FETCH_ERROR",
        message: `OpenRouter credits API error (HTTP ${response.status}).`,
        quotas: {},
      };
    }

    const json = await response.json().catch(() => null);
    const data = json?.data;
    if (!data) {
      return {
        status: "AVAILABLE",
        quotas: {},
      };
    }

    const totalCredits = Number(data.total_credits) || 0;
    const totalUsage = Number(data.total_usage) || 0;
    const remaining = Math.max(0, totalCredits - totalUsage);
    const remainingPct = totalCredits > 0 ? Math.round((remaining / totalCredits) * 100) : 0;

    return {
      status: "AVAILABLE",
      plan: "OpenRouter Credits",
      quotas: {
        credits: {
          name: "Credits (USD)",
          total: totalCredits,
          used: totalUsage,
          remaining: Number(remaining.toFixed(4)),
          remainingPercentage: remainingPct,
          unit: "USD",
          unlimited: false,
          resetAt: null,
        },
      },
    };
  } catch (error) {
    return {
      status: "FETCH_ERROR",
      message: `Failed to fetch OpenRouter credits: ${error.message}`,
      quotas: {},
    };
  }
}
