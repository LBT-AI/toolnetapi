/**
 * Kiro (AWS CodeWhisperer) usage handler
 */

import { proxyAwareFetch } from "../../utils/proxyFetch.js";
import { resolveDefaultProfileArn } from "../../config/kiroConstants.js";
import { parseResetTime } from "./shared.js";

/**
 * Kiro (AWS CodeWhisperer) Usage
 */
function parseKiroQuotaData(data) {
  const usageList = data.usageBreakdownList || [];
  const quotaInfo = {};
  const resetAt = parseResetTime(data.nextDateReset || data.resetDate);

  usageList.forEach((breakdown) => {
    const resourceType = breakdown.resourceType?.toLowerCase() || "unknown";
    const used = breakdown.currentUsageWithPrecision || 0;
    const total = breakdown.usageLimitWithPrecision || 0;

    quotaInfo[resourceType] = {
      used,
      total,
      remaining: Math.max(0, total - used),
      resetAt,
      unlimited: false,
    };

    // Add free trial if available
    if (breakdown.freeTrialInfo) {
      const freeUsed = breakdown.freeTrialInfo.currentUsageWithPrecision || 0;
      const freeTotal = breakdown.freeTrialInfo.usageLimitWithPrecision || 0;

      quotaInfo[`${resourceType}_freetrial`] = {
        used: freeUsed,
        total: freeTotal,
        remaining: Math.max(0, freeTotal - freeUsed),
        resetAt: parseResetTime(breakdown.freeTrialInfo.freeTrialExpiry || resetAt),
        unlimited: false,
      };
    }
  });

  return {
    status: "AVAILABLE",
    quotaStatus: "AVAILABLE",
    plan: data.subscriptionInfo?.subscriptionTitle || "Kiro",
    quotas: quotaInfo,
  };
}

function resolveKiroAuthMethod(providerSpecificData) {
  if (providerSpecificData?.authMethod) {
    return providerSpecificData.authMethod;
  }
  if (providerSpecificData?.clientId && providerSpecificData?.clientSecret) {
    const startUrl = String(providerSpecificData?.startUrl || "").toLowerCase();
    if (startUrl.includes("identitycenter") || startUrl.includes("awsapps.com/start")) {
      return "idc";
    }
    return "builder-id";
  }
  if (providerSpecificData?.authKind === "api_key" || providerSpecificData?.isApiKey) {
    return "api_key";
  }
  return "builder-id";
}

function resolveKiroRegion(providerSpecificData) {
  const explicit = providerSpecificData?.region?.trim();
  if (explicit) return explicit;
  const arn = providerSpecificData?.profileArn;
  if (typeof arn === "string") {
    const segment = arn.split(":")[3];
    if (segment) return segment;
  }
  return "us-east-1";
}

function resolveKiroProfileArn(authMethod, providerSpecificData) {
  const explicit = providerSpecificData?.profileArn?.trim();
  if (explicit) return explicit;
  // For API key and IAM Identity Center, never inject placeholder ARN
  if (authMethod === "api_key" || authMethod === "idc") {
    return "";
  }
  return resolveDefaultProfileArn(authMethod) || "";
}

export async function getKiroUsage(accessToken, providerSpecificData, proxyOptions = null) {
  if (!accessToken) {
    return {
      status: "UNAVAILABLE",
      quotaStatus: "UNAVAILABLE",
      authStatus: "EXPIRED",
      message: "No access token provided for Kiro connection.",
      reason: "Missing access token",
      quotas: {},
    };
  }

  const authMethod = resolveKiroAuthMethod(providerSpecificData);
  const region = resolveKiroRegion(providerSpecificData);
  const isApiKey = authMethod === "api_key";
  const isExternalIdp = authMethod === "external_idp";
  const apiKeyHeaders = isApiKey ? { tokentype: "API_KEY" } : {};
  const externalIdpHeaders = isExternalIdp ? { TokenType: "EXTERNAL_IDP" } : {};

  const profileArn = resolveKiroProfileArn(authMethod, providerSpecificData);
  const cwHost = `https://codewhisperer.${region}.amazonaws.com`;
  const qHost = `https://q.${region}.amazonaws.com`;

  const getUsageParams = new URLSearchParams({
    isEmailRequired: "true",
    origin: "AI_EDITOR",
    resourceType: "AGENTIC_REQUEST",
  });
  if (profileArn) {
    getUsageParams.set("profileArn", profileArn);
  }

  const attempts = [
    {
      name: "codewhisperer-get",
      run: () => proxyAwareFetch(
        `${cwHost}/getUsageLimits?${getUsageParams.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
            "x-amz-user-agent": "aws-sdk-js/1.0.0 KiroIDE",
            "user-agent": "aws-sdk-js/1.0.0 KiroIDE",
            ...apiKeyHeaders,
            ...externalIdpHeaders,
          },
        },
        proxyOptions
      ),
    },
    {
      name: "codewhisperer-post",
      run: () => proxyAwareFetch(
        cwHost,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/x-amz-json-1.0",
            "x-amz-target": "AmazonCodeWhispererService.GetUsageLimits",
            Accept: "application/json",
            ...apiKeyHeaders,
            ...externalIdpHeaders,
          },
          body: JSON.stringify({
            origin: "AI_EDITOR",
            ...(profileArn ? { profileArn } : {}),
            resourceType: "AGENTIC_REQUEST",
          }),
        },
        proxyOptions
      ),
    },
    {
      name: "q-get",
      run: () => {
        const qParams = new URLSearchParams({
          origin: "AI_EDITOR",
          ...(profileArn ? { profileArn } : {}),
          resourceType: "AGENTIC_REQUEST",
        });
        return proxyAwareFetch(
          `${qHost}/getUsageLimits?${qParams.toString()}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
              ...apiKeyHeaders,
              ...externalIdpHeaders,
            },
          },
          proxyOptions
        );
      },
    },
  ];

  let has401 = false;
  let has403 = false;
  let has429 = false;
  const errors = [];

  for (const attempt of attempts) {
    try {
      const response = await attempt.run();
      if (response.ok) {
        const data = await response.json();
        return parseKiroQuotaData(data);
      }

      const status = response.status;
      const text = await response.text().catch(() => "");
      let parsedError = "";
      try {
        const errJson = JSON.parse(text);
        parsedError = errJson.message || errJson.__type || errJson.error || text;
      } catch {
        parsedError = text.slice(0, 100);
      }

      if (status === 401) has401 = true;
      if (status === 403) has403 = true;
      if (status === 429) has429 = true;

      errors.push({
        endpoint: attempt.name,
        status,
        message: parsedError,
      });
    } catch (error) {
      errors.push({
        endpoint: attempt.name,
        status: 0,
        message: error.message || "Network error",
      });
    }
  }

  // Handle distinct failure modes
  if (has429) {
    return {
      status: "RATE_LIMITED",
      quotaStatus: "RATE_LIMITED",
      authStatus: "VALID",
      message: "Kiro quota API is temporarily rate-limited (HTTP 429). Chat may still work.",
      reason: "GetUsageLimits returned HTTP 429",
      endpointErrors: errors,
      quotas: {},
    };
  }

  // If ALL endpoints returned 401 Unauthorized, token is definitely expired/invalid
  if (has401 && !has403) {
    return {
      status: "UNAVAILABLE",
      quotaStatus: "UNAVAILABLE",
      authStatus: "EXPIRED",
      message: "Kiro token expired or rejected by authentication service (HTTP 401).",
      reason: "GetUsageLimits returned HTTP 401 Unauthorized",
      endpointErrors: errors,
      quotas: {},
    };
  }

  // 403 Forbidden is a permission / profile mismatch / subscription constraint, NOT necessarily broken chat
  if (has403) {
    if (authMethod === "idc") {
      return {
        status: "UNAVAILABLE",
        quotaStatus: "UNAVAILABLE",
        authStatus: "VALID",
        message: "Kiro quota API is unavailable for the current AWS IAM Identity Center session. Chat may still work.",
        reason: "GetUsageLimits returned HTTP 403 (IAM Identity Center session permissions)",
        endpointErrors: errors,
        quotas: {},
      };
    }

    if (authMethod === "google" || authMethod === "github") {
      return {
        status: "UNAVAILABLE",
        quotaStatus: "UNAVAILABLE",
        authStatus: "VALID",
        message: "Kiro quota API is not supported for social sign-in sessions. Chat may still work.",
        reason: "GetUsageLimits returned HTTP 403 (Social session)",
        endpointErrors: errors,
        quotas: {},
      };
    }

    if (authMethod === "api_key") {
      return {
        status: "UNAVAILABLE",
        quotaStatus: "UNAVAILABLE",
        authStatus: "VALID",
        message: "Kiro quota API returned HTTP 403 for API Key. Chat may still work.",
        reason: "GetUsageLimits returned HTTP 403 (API Key permissions / profileArn mismatch)",
        endpointErrors: errors,
        quotas: {},
      };
    }

    return {
      status: "UNAVAILABLE",
      quotaStatus: "UNAVAILABLE",
      authStatus: "VALID",
      message: "Kiro GetUsageLimits returned HTTP 403 (Access Denied / Profile mismatch). Chat may still work.",
      reason: "GetUsageLimits returned HTTP 403",
      endpointErrors: errors,
      quotas: {},
    };
  }

  const lastErr = errors[errors.length - 1];
  return {
    status: "FETCH_ERROR",
    quotaStatus: "FETCH_ERROR",
    authStatus: "UNKNOWN",
    message: lastErr?.message
      ? `Unable to fetch Kiro usage right now (${lastErr.message}).`
      : "Unable to fetch Kiro usage right now.",
    reason: lastErr?.message || "Endpoint error",
    endpointErrors: errors,
    quotas: {},
  };
}
