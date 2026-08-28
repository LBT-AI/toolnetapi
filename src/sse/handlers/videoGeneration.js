import {
  getProviderCredentials,
  markAccountUnavailable,
  clearAccountError,
  extractApiKey,
  isValidApiKey,
} from "../services/auth.js";
import { getSettings } from "@/lib/localDb";
import { getModelInfo, getComboModels } from "../services/model.js";
import { handleVideoProxyCore, handleDashScopeVideoCore, handleDashScopeVideoPoll, handleGensparkVideoCore, handleGensparkVideoPoll, getVideoConfig, sanitizeSecrets } from "open-sse/handlers/videoCore.js";
import { errorResponse, unavailableResponse } from "open-sse/utils/error.js";
import { HTTP_STATUS } from "open-sse/config/runtimeConfig.js";
import { updateProviderCredentials, checkAndRefreshToken } from "../services/tokenRefresh.js";
import { handleComboChat } from "open-sse/services/combo.js";
import * as log from "../utils/logger.js";

// Video generation is xAI-only today; requests without a provider prefix
// (bare model id, or multipart bodies we deliberately don't parse) land here.
const DEFAULT_VIDEO_PROVIDER = "xai";

// Creation POSTs are billable jobs — only rotate to another account for
// errors that upstream rejects BEFORE creating a job (auth/quota). A 5xx may
// have created the job, so it is returned to the caller instead of re-sent.
const CREATE_ROTATION_STATUSES = new Set([
  HTTP_STATUS.UNAUTHORIZED,
  HTTP_STATUS.FORBIDDEN,
  HTTP_STATUS.RATE_LIMITED,
]);

// Providers that use native async API instead of xAI-style proxy.
const DASHSCOPE_VIDEO_PROVIDERS = new Set(["alims-intl"]);
const GENSPARK_VIDEO_PROVIDERS = new Set(["genspark"]);


async function requireValidApiKey(request) {
  const apiKey = extractApiKey(request);
  const settings = await getSettings();
  if (settings.requireApiKey) {
    if (!apiKey) return errorResponse(HTTP_STATUS.UNAUTHORIZED, "Missing API key");
    const valid = await isValidApiKey(apiKey);
    if (!valid) return errorResponse(HTTP_STATUS.UNAUTHORIZED, "Invalid API key");
  }
  return null;
}

/**
 * Read the request body once, byte-preserving.
 * JSON bodies are additionally parsed so the `model` provider prefix can be
 * resolved (and stripped) — everything else is forwarded exactly as received.
 */
async function readForwardableBody(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const raw = await request.text();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { error: errorResponse(HTTP_STATUS.BAD_REQUEST, "Invalid JSON body") };
    }
    return { raw, parsed, contentType };
  }
  // Multipart (or any other content type): forward the exact bytes — parsing
  // and re-encoding FormData would change the multipart boundary.
  const buf = Buffer.from(await request.arrayBuffer());
  return { raw: buf, parsed: null, contentType };
}

async function resolveVideoProvider(parsedBody) {
  if (!parsedBody?.model) return { provider: DEFAULT_VIDEO_PROVIDER, model: null };

  const modelStr = String(parsedBody.model);

  // Combo names don't contain "/"; resolve before provider lookup.
  const comboModels = await getComboModels(modelStr);
  if (comboModels) return { provider: null, model: null, comboModels, comboName: modelStr };

  const modelInfo = await getModelInfo(modelStr);
  if (!modelInfo.provider) {
    return { error: errorResponse(HTTP_STATUS.BAD_REQUEST, `Unknown model: ${modelStr}`) };
  }
  if (!getVideoConfig(modelInfo.provider)) {
    // Bare model ids (no explicit "provider/" prefix) fall back to the default
    // video provider — the prefix-less inference targets chat providers only.
    if (!modelStr.includes("/")) {
      return { provider: DEFAULT_VIDEO_PROVIDER, model: modelStr };
    }
    return { error: errorResponse(HTTP_STATUS.BAD_REQUEST, `Provider '${modelInfo.provider}' does not support video generation`) };
  }
  return { provider: modelInfo.provider, model: modelInfo.model };
}

function withConnectionHeader(response, connectionId) {
  if (!connectionId) return response;
  const headers = new Headers(response.headers);
  // Video jobs are account-bound upstream — clients echo this back as
  // `x-connection-id` on GET polls so the same account is used.
  headers.set("x-toolnetapi-connection-id", String(connectionId));
  return new Response(response.body, { status: response.status, headers });
}

/**
 * POST /v1/videos/{generations|edits|extensions} — async job creation proxy.
 */
export async function handleVideoCreate(request, action) {
  const authError = await requireValidApiKey(request);
  if (authError) return authError;

  const bodyInfo = await readForwardableBody(request);
  if (bodyInfo.error) return bodyInfo.error;

  const resolved = await resolveVideoProvider(bodyInfo.parsed);
  if (resolved.error) return resolved.error;
  const { provider, model, comboModels, comboName } = resolved;

  // Combo expansion — run fallback/round-robin across video models
  if (comboModels) {
    const settings = await getSettings();
    const comboStrategies = settings.comboStrategies || {};
    const comboStrategy = comboStrategies[comboName]?.fallbackStrategy || settings.comboStrategy || "fallback";
    const comboStickyLimit = settings.comboStickyRoundRobinLimit;
    log.info("VIDEO", `Combo "${comboName}" with ${comboModels.length} models (strategy: ${comboStrategy})`);
    return handleComboChat({
      body: bodyInfo.parsed,
      models: comboModels,
      handleSingleModel: (b, m) => handleVideoCreate(
        new Request(request.url, {
          method: "POST",
          headers: request.headers,
          body: JSON.stringify({ ...b, model: m }),
        }),
        action
      ),
      log,
      comboName,
      comboStrategy,
      comboStickyLimit,
      autoSwitch: false,
    });
  }

  // DashScope providers use native async API — route separately
  if (DASHSCOPE_VIDEO_PROVIDERS.has(provider)) {
    return handleDashScopeVideoCreate(request, bodyInfo.parsed, provider, model);
  }

  // Genspark providers use tool CLI native async API — route separately
  if (GENSPARK_VIDEO_PROVIDERS.has(provider)) {
    return handleGensparkVideoCreate(request, bodyInfo.parsed, provider, model);
  }


  // Strip the provider prefix (e.g. "xai/grok-imagine-video") before forwarding;
  // otherwise forward the original bytes untouched.
  let forwardBody = bodyInfo.raw;
  if (bodyInfo.parsed && model && bodyInfo.parsed.model !== model) {
    forwardBody = JSON.stringify({ ...bodyInfo.parsed, model });
  }

  const preferredConnectionId = request.headers.get("x-connection-id") || null;
  const idempotencyKey = request.headers.get("idempotency-key") || null;

  const excludeConnectionIds = new Set();
  let lastError = null;
  let lastStatus = null;

  while (true) {
    const credentials = await getProviderCredentials(provider, excludeConnectionIds, model, { preferredConnectionId });

    if (!credentials || credentials.allRateLimited) {
      if (credentials?.allRateLimited) {
        const errorMsg = lastError || credentials.lastError || "Unavailable";
        const status = lastStatus || Number(credentials.lastErrorCode) || HTTP_STATUS.SERVICE_UNAVAILABLE;
        return unavailableResponse(status, `[${provider}/${model || "video"}] ${errorMsg}`, credentials.retryAfter, credentials.retryAfterHuman);
      }
      if (excludeConnectionIds.size === 0) {
        return errorResponse(HTTP_STATUS.BAD_REQUEST, `No credentials for provider: ${provider}`);
      }
      return errorResponse(lastStatus || HTTP_STATUS.SERVICE_UNAVAILABLE, lastError || "All accounts unavailable");
    }

    const refreshedCredentials = await checkAndRefreshToken(provider, credentials);

    const result = await handleVideoProxyCore({
      provider,
      action,
      rawBody: forwardBody,
      contentType: bodyInfo.contentType || null,
      idempotencyKey,
      credentials: refreshedCredentials,
      signal: request.signal,
      log,
      onCredentialsRefreshed: async (newCreds) => {
        await updateProviderCredentials(credentials.connectionId, {
          accessToken: newCreds.accessToken,
          refreshToken: newCreds.refreshToken,
          providerSpecificData: newCreds.providerSpecificData,
          testStatus: "active",
        });
      },
    });

    if (result.success) {
      await clearAccountError(credentials.connectionId, credentials, model);
      log.info("VIDEO", `${provider.toUpperCase()} | ${action} accepted (connection ${credentials.connectionId})`);
      return withConnectionHeader(result.response, credentials.connectionId);
    }

    // Record the failure (dashboard shows lastError/errorCode → user sees re-auth is needed)
    const { shouldFallback } = await markAccountUnavailable(
      credentials.connectionId, result.status, sanitizeSecrets(result.error, refreshedCredentials), provider, model
    );

    if (shouldFallback && CREATE_ROTATION_STATUSES.has(result.status)) {
      excludeConnectionIds.add(credentials.connectionId);
      lastError = result.error;
      lastStatus = result.status;
      continue;
    }

    return result.response;
  }
}

/**
 * GET /v1/videos/{request_id} — poll job status.
 * Jobs are account-bound upstream, so no cross-account rotation here: the
 * caller pins the creating account via `x-connection-id` (returned on create).
 */
export async function handleVideoGet(request, requestId) {
  const authError = await requireValidApiKey(request);
  if (authError) return authError;

  if (!requestId) return errorResponse(HTTP_STATUS.BAD_REQUEST, "Missing video request id");

  // x-video-provider header lets the client pin to the originating provider.
  // Falls back to DEFAULT_VIDEO_PROVIDER (xai) for backward compatibility.
  const providerHint = request.headers.get("x-video-provider") || null;
  const provider = providerHint || DEFAULT_VIDEO_PROVIDER;
  const preferredConnectionId = request.headers.get("x-connection-id") || null;

  const credentials = await getProviderCredentials(provider, null, null, { preferredConnectionId });
  if (!credentials || credentials.allRateLimited) {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, `No credentials for provider: ${provider}`);
  }

  const refreshedCredentials = await checkAndRefreshToken(provider, credentials);

  // DashScope tasks are polled via /api/v1/tasks/{id} — not xAI proxy.
  if (DASHSCOPE_VIDEO_PROVIDERS.has(provider)) {
    const result = await handleDashScopeVideoPoll({
      taskId: requestId,
      credentials: refreshedCredentials,
      signal: request.signal,
      log,
    });
    if (result.success) {
      await clearAccountError(credentials.connectionId, credentials, null);
      return withConnectionHeader(result.response, credentials.connectionId);
    }
    await markAccountUnavailable(
      credentials.connectionId, result.status, sanitizeSecrets(result.error, refreshedCredentials), provider, null
    );
    return result.response;
  }

  // Genspark tasks are polled via /api/tool_cli/task_status
  if (GENSPARK_VIDEO_PROVIDERS.has(provider)) {
    const result = await handleGensparkVideoPoll({
      taskId: requestId,
      credentials: refreshedCredentials,
      signal: request.signal,
      log,
    });
    if (result.success) {
      await clearAccountError(credentials.connectionId, credentials, null);
      return withConnectionHeader(result.response, credentials.connectionId);
    }
    await markAccountUnavailable(
      credentials.connectionId, result.status, sanitizeSecrets(result.error, refreshedCredentials), provider, null
    );
    return result.response;
  }

  const result = await handleVideoProxyCore({
    provider,
    requestId,
    credentials: refreshedCredentials,
    signal: request.signal,
    log,
    onCredentialsRefreshed: async (newCreds) => {
      await updateProviderCredentials(credentials.connectionId, {
        accessToken: newCreds.accessToken,
        refreshToken: newCreds.refreshToken,
        providerSpecificData: newCreds.providerSpecificData,
        testStatus: "active",
      });
    },
  });

  if (result.success) {
    await clearAccountError(credentials.connectionId, credentials, null);
    return withConnectionHeader(result.response, credentials.connectionId);
  }

  await markAccountUnavailable(
    credentials.connectionId, result.status, sanitizeSecrets(result.error, refreshedCredentials), provider, null
  );
  return result.response;
}

/**
 * Alibaba DashScope video creation — native async API with polling.
 * Handles alims-intl wan2.x / happyhorse-* video models.
 */
async function handleDashScopeVideoCreate(request, parsedBody, provider, model) {
  const prompt = parsedBody?.prompt || parsedBody?.input?.prompt || "";
  if (!prompt) return errorResponse(HTTP_STATUS.BAD_REQUEST, "Missing required field: prompt");

  const parameters = parsedBody?.parameters || {};
  const excludeConnectionIds = new Set();
  let lastError = null;
  let lastStatus = null;

  while (true) {
    const credentials = await getProviderCredentials(provider, excludeConnectionIds, model);

    if (!credentials || credentials.allRateLimited) {
      if (credentials?.allRateLimited) {
        const msg = lastError || credentials.lastError || "Unavailable";
        const status = lastStatus || Number(credentials.lastErrorCode) || HTTP_STATUS.SERVICE_UNAVAILABLE;
        return unavailableResponse(status, `[${provider}/${model}] ${msg}`, credentials.retryAfter, credentials.retryAfterHuman);
      }
      if (excludeConnectionIds.size === 0) return errorResponse(HTTP_STATUS.BAD_REQUEST, `No credentials for provider: ${provider}`);
      return errorResponse(lastStatus || HTTP_STATUS.SERVICE_UNAVAILABLE, lastError || "All accounts unavailable");
    }

    const refreshedCredentials = await checkAndRefreshToken(provider, credentials);
    const result = await handleDashScopeVideoCore({
      model, prompt, parameters,
      credentials: refreshedCredentials,
      signal: request.signal,
      log,
    });

    if (result.success) {
      await clearAccountError(credentials.connectionId, credentials, model);
      log.info("VIDEO", `alims-intl | ${model} | SUCCEEDED (conn ${credentials.connectionId})`);
      return withConnectionHeader(result.response, credentials.connectionId);
    }

    const { shouldFallback } = await markAccountUnavailable(
      credentials.connectionId, result.status, result.error, provider, model
    );

    if (shouldFallback && CREATE_ROTATION_STATUSES.has(result.status)) {
      excludeConnectionIds.add(credentials.connectionId);
      lastError = result.error;
      lastStatus = result.status;
      continue;
    }

    return result.response;
  }
}

/**
 * Genspark video creation — native async API via tool CLI.
 */
async function handleGensparkVideoCreate(request, parsedBody, provider, model) {
  const prompt = parsedBody?.prompt || parsedBody?.input?.prompt || parsedBody?.query || "";
  if (!prompt) return errorResponse(HTTP_STATUS.BAD_REQUEST, "Missing required field: prompt");

  const parameters = {
    ...parsedBody,
    ...(parsedBody?.parameters || {}),
  };
  const excludeConnectionIds = new Set();
  let lastError = null;
  let lastStatus = null;

  while (true) {
    const credentials = await getProviderCredentials(provider, excludeConnectionIds, model);

    if (!credentials || credentials.allRateLimited) {
      if (credentials?.allRateLimited) {
        const msg = lastError || credentials.lastError || "Unavailable";
        const status = lastStatus || Number(credentials.lastErrorCode) || HTTP_STATUS.SERVICE_UNAVAILABLE;
        return unavailableResponse(status, `[${provider}/${model}] ${msg}`, credentials.retryAfter, credentials.retryAfterHuman);
      }
      if (excludeConnectionIds.size === 0) return errorResponse(HTTP_STATUS.BAD_REQUEST, `No credentials for provider: ${provider}`);
      return errorResponse(lastStatus || HTTP_STATUS.SERVICE_UNAVAILABLE, lastError || "All accounts unavailable");
    }

    const refreshedCredentials = await checkAndRefreshToken(provider, credentials);
    const result = await handleGensparkVideoCore({
      model, prompt, parameters,
      credentials: refreshedCredentials,
      signal: request.signal,
      log,
    });

    if (result.success) {
      await clearAccountError(credentials.connectionId, credentials, model);
      log.info("VIDEO", `genspark | ${model} | SUCCEEDED (conn ${credentials.connectionId})`);
      return withConnectionHeader(result.response, credentials.connectionId);
    }

    const { shouldFallback } = await markAccountUnavailable(
      credentials.connectionId, result.status, result.error, provider, model
    );

    if (shouldFallback && CREATE_ROTATION_STATUSES.has(result.status)) {
      excludeConnectionIds.add(credentials.connectionId);
      lastError = result.error;
      lastStatus = result.status;
      continue;
    }

    return result.response;
  }
}

