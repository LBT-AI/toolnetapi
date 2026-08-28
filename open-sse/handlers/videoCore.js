import { createErrorResult } from "../utils/error.js";
import { HTTP_STATUS } from "../config/runtimeConfig.js";
import { refreshTokenByProvider } from "../services/tokenRefresh.js";
import { PROVIDER_MEDIA } from "../providers/index.js";
import { sleep } from "./imageProviders/_base.js";

const DASHSCOPE_VIDEO_PATH = "/services/aigc/video-generation/video-synthesis";
const DASHSCOPE_POLL_INTERVAL_MS = 5000;
const DASHSCOPE_POLL_TIMEOUT_MS = 300000; // 5 min — video renders take 1-5 min

// Upstream fetch deadline for video job submission/polling (the job itself is
// async upstream — this only bounds the HTTP round-trip, not video rendering).
const VIDEO_FETCH_TIMEOUT_MS = Number(process.env.VIDEO_FETCH_TIMEOUT_MS || 120000);

// POST /videos/* creates a billable upstream job. A network error after the
// request left the socket may still have created the job, so creation is NEVER
// auto-retried (the only re-send is the auth retry after a 401/403 refresh,
// which upstream rejects before job creation).
export const VIDEO_ACTIONS = new Set(["generations", "edits", "extensions"]);

export function getVideoConfig(provider) {
  return PROVIDER_MEDIA[provider]?.videoConfig || null;
}

/** Strip bearer tokens / obvious secrets from text destined for clients or logs. */
export function sanitizeSecrets(text, credentials = null) {
  if (!text) return text;
  let out = String(text).replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [redacted]");
  for (const key of ["accessToken", "refreshToken", "apiKey"]) {
    const secret = credentials?.[key];
    if (typeof secret === "string" && secret.length >= 8) {
      out = out.split(secret).join("[redacted]");
    }
  }
  return out;
}

function buildUpstreamUrl(config, action, requestId) {
  const base = config.baseUrl.replace(/\/$/, "");
  return requestId ? `${base}/${encodeURIComponent(requestId)}` : `${base}/${action}`;
}

function buildHeaders({ token, contentType, idempotencyKey }) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (contentType) headers["Content-Type"] = contentType;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  return headers;
}

function combineSignals(signal, timeoutMs) {
  const timeoutSignal = typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(timeoutMs) : null;
  if (signal && timeoutSignal && typeof AbortSignal.any === "function") {
    return AbortSignal.any([signal, timeoutSignal]);
  }
  return signal || timeoutSignal || undefined;
}

/**
 * Transparent proxy for async video jobs (xAI Grok Imagine shape).
 *
 * - Forwards the raw body byte-for-byte (JSON or multipart) — no reshaping.
 * - Passes upstream JSON (request_id, status, video.url, error) back verbatim.
 * - 401/403 with a refresh token: refresh ONCE, retry ONCE. No other retry.
 * - Upstream error text is sanitized before it reaches the client.
 *
 * @param {object} options
 * @param {string} options.provider - Provider id (must have registry videoConfig)
 * @param {"generations"|"edits"|"extensions"|null} options.action - Creation action (POST)
 * @param {string|null} [options.requestId] - Poll target (GET /videos/{id})
 * @param {Buffer|string|null} [options.rawBody] - Exact body to forward
 * @param {string|null} [options.contentType] - Original Content-Type header
 * @param {string|null} [options.idempotencyKey] - Forwarded Idempotency-Key
 * @param {object} options.credentials - { accessToken?, apiKey?, refreshToken?, authType? }
 * @param {AbortSignal} [options.signal] - Client cancellation signal
 * @param {number} [options.timeoutMs]
 * @param {object} [options.log]
 * @param {function} [options.onCredentialsRefreshed]
 * @returns {Promise<{ success: boolean, response: Response, status?: number, error?: string }>}
 */
export async function handleVideoProxyCore({
  provider,
  action = null,
  requestId = null,
  rawBody = null,
  contentType = null,
  idempotencyKey = null,
  credentials,
  signal,
  timeoutMs = VIDEO_FETCH_TIMEOUT_MS,
  log,
  onCredentialsRefreshed,
}) {
  const config = getVideoConfig(provider);
  if (!config) {
    return createErrorResult(HTTP_STATUS.BAD_REQUEST, `Provider '${provider}' does not support video generation`);
  }
  if (!requestId && !VIDEO_ACTIONS.has(action)) {
    return createErrorResult(HTTP_STATUS.BAD_REQUEST, `Unknown video action: ${action}`);
  }

  const method = requestId ? "GET" : "POST";
  const url = buildUpstreamUrl(config, action, requestId);
  const fetchSignal = combineSignals(signal, timeoutMs);

  const doFetch = (token) =>
    fetch(url, {
      method,
      headers: buildHeaders({ token, contentType: method === "POST" ? contentType : null, idempotencyKey: method === "POST" ? idempotencyKey : null }),
      body: method === "POST" ? rawBody : undefined,
      signal: fetchSignal,
    });

  let upstream;
  try {
    upstream = await doFetch(credentials?.accessToken || credentials?.apiKey);
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      return createErrorResult(HTTP_STATUS.REQUEST_TIMEOUT, `[${provider}] video ${method} aborted: ${error.message}`);
    }
    // Never re-send a creation POST on network error — the job may already exist upstream.
    return createErrorResult(HTTP_STATUS.BAD_GATEWAY, sanitizeSecrets(`[${provider}] video upstream fetch failed: ${error.message}`, credentials));
  }

  // 401/403 → refresh once → retry once (OAuth accounts only; API keys can't refresh)
  if (
    (upstream.status === HTTP_STATUS.UNAUTHORIZED || upstream.status === HTTP_STATUS.FORBIDDEN) &&
    credentials?.refreshToken
  ) {
    let refreshed = null;
    try {
      refreshed = await refreshTokenByProvider(provider, credentials, log);
    } catch (error) {
      log?.warn?.("TOKEN", `${provider} | video refresh error: ${sanitizeSecrets(error.message, credentials)}`);
    }
    if (refreshed?.accessToken) {
      log?.info?.("TOKEN", `${provider.toUpperCase()} | refreshed for video ${method}`);
      Object.assign(credentials, refreshed);
      if (onCredentialsRefreshed) await onCredentialsRefreshed(refreshed);
      try {
        await upstream.body?.cancel?.();
      } catch { /* noop */ }
      try {
        upstream = await doFetch(credentials.accessToken || credentials.apiKey);
      } catch (error) {
        return createErrorResult(HTTP_STATUS.BAD_GATEWAY, sanitizeSecrets(`[${provider}] video retry after refresh failed: ${error.message}`, credentials));
      }
    } else {
      log?.warn?.("TOKEN", `${provider.toUpperCase()} | video refresh failed — account needs re-auth`);
    }
  }

  const bodyText = await upstream.text().catch(() => "");

  if (!upstream.ok) {
    const message = sanitizeSecrets(bodyText || `HTTP ${upstream.status}`, credentials);
    return createErrorResult(upstream.status, `[${provider}] ${message.slice(0, 2000)}`);
  }

  // Success: pass the upstream JSON through untouched (request_id / status / video.url).
  return {
    success: true,
    response: new Response(bodyText, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }),
  };
}

/**
 * Single-shot DashScope task poll — returns normalized status immediately.
 * Used by GET /v1/videos/{id} when x-video-provider: alims-intl.
 *
 * Response shape:
 *   queued/processing → { id, status: "queued"|"processing", model }
 *   completed         → { id, status: "completed", data: [{ url }], model }
 *   failed            → { id, status: "failed", error: { message } }
 */
export async function handleDashScopeVideoPoll({
  taskId,
  credentials,
  signal,
  log,
}) {
  const config = getVideoConfig("alims-intl");
  if (!config) return createErrorResult(HTTP_STATUS.BAD_REQUEST, "alims-intl videoConfig missing");

  const token = credentials?.apiKey || credentials?.accessToken;
  if (!token) return createErrorResult(HTTP_STATUS.UNAUTHORIZED, "No credentials for alims-intl video");

  const base = credentials?.providerSpecificData?.dashScopeBase
    || credentials?.providerSpecificData?.baseUrl?.replace(/\/compatible-mode\/v1\/?$/, "/api/v1").replace(/\/api\/v1\/api\/v1/, "/api/v1")
    || config.baseUrl;

  let pollRes;
  try {
    pollRes = await fetch(`${base}/tasks/${taskId}`, {
      headers: { "Authorization": `Bearer ${token}` },
      signal,
    });
  } catch (err) {
    return createErrorResult(HTTP_STATUS.BAD_GATEWAY, `alims-intl task poll failed: ${err.message}`);
  }

  const text = await pollRes.text().catch(() => "");
  if (!pollRes.ok) {
    return createErrorResult(pollRes.status, `alims-intl task poll error: ${text.slice(0, 500)}`);
  }

  let data;
  try { data = JSON.parse(text); } catch {
    return createErrorResult(HTTP_STATUS.BAD_GATEWAY, "alims-intl task poll: invalid JSON response");
  }

  const taskStatus = data?.output?.task_status;
  const taskModel = data?.output?.model_name || null;

  // Map DashScope statuses → unified statuses
  let normalized;
  if (taskStatus === "SUCCEEDED") {
    const videoUrl = data?.output?.video_url;
    normalized = {
      id: taskId,
      object: "video.generation",
      status: "completed",
      model: taskModel,
      data: videoUrl ? [{ url: videoUrl }] : [],
    };
  } else if (taskStatus === "FAILED") {
    normalized = {
      id: taskId,
      object: "video.generation",
      status: "failed",
      model: taskModel,
      error: { message: data?.output?.message || "Video generation failed" },
    };
  } else if (taskStatus === "PENDING") {
    normalized = { id: taskId, object: "video.generation", status: "queued", model: taskModel };
  } else {
    // RUNNING or unknown
    normalized = { id: taskId, object: "video.generation", status: "processing", model: taskModel };
  }

  log?.debug?.("VIDEO", `alims-intl | task ${taskId} → ${normalized.status}`);

  return {
    success: true,
    response: new Response(JSON.stringify(normalized), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    }),
  };
}

/**
 * Alibaba DashScope video generation — native async API.
 *
 * Submit:  POST {base}/services/aigc/video-generation/video-synthesis
 *          X-DashScope-Async: enable
 *          { model, input: { prompt }, parameters: {} }
 *       →  { output: { task_id, task_status:"PENDING" } }
 *
 * Poll:    GET {base}/tasks/{task_id}
 *       →  { output: { task_status:"SUCCEEDED", video_url } }
 *
 * Host:  workspace key → providerSpecificData.dashScopeBase
 *        standard key  → dashscope-intl.aliyuncs.com/api/v1
 */
export async function handleDashScopeVideoCore({
  model,
  prompt,
  parameters = {},
  credentials,
  signal,
  log,
  pollIntervalMs = DASHSCOPE_POLL_INTERVAL_MS,
}) {
  const config = getVideoConfig("alims-intl");
  if (!config) return createErrorResult(HTTP_STATUS.BAD_REQUEST, "alims-intl videoConfig missing");

  const token = credentials?.apiKey || credentials?.accessToken;
  if (!token) return createErrorResult(HTTP_STATUS.UNAUTHORIZED, "No credentials for alims-intl video");

  // Workspace keys use per-connection host; standard keys use dashscope-intl
  const base = credentials?.providerSpecificData?.dashScopeBase
    || credentials?.providerSpecificData?.baseUrl?.replace(/\/compatible-mode\/v1\/?$/, "/api/v1").replace(/\/api\/v1\/api\/v1/, "/api/v1")
    || config.baseUrl;

  const submitUrl = `${base}${DASHSCOPE_VIDEO_PATH}`;
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-DashScope-Async": "enable",
  };

  log?.debug?.("VIDEO", `alims-intl | ${model} | submit → ${submitUrl}`);

  let submitRes;
  try {
    submitRes = await fetch(submitUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, input: { prompt }, parameters }),
      signal,
    });
  } catch (err) {
    return createErrorResult(HTTP_STATUS.BAD_GATEWAY, `alims-intl video submit failed: ${err.message}`);
  }

  const submitText = await submitRes.text().catch(() => "");
  if (!submitRes.ok) {
    return createErrorResult(submitRes.status, `alims-intl video submit error: ${submitText.slice(0, 500)}`);
  }

  let submitData;
  try { submitData = JSON.parse(submitText); } catch {
    return createErrorResult(HTTP_STATUS.BAD_GATEWAY, "alims-intl video: invalid submit response");
  }

  const taskId = submitData?.output?.task_id;
  if (!taskId) return createErrorResult(HTTP_STATUS.BAD_GATEWAY, `alims-intl video: no task_id — ${submitText.slice(0, 200)}`);

  log?.info?.("VIDEO", `alims-intl | ${model} | task ${taskId} PENDING — polling...`);

  // Poll until SUCCEEDED / FAILED / timeout
  const pollUrl = `${base}/tasks/${taskId}`;
  const pollHeaders = { "Authorization": `Bearer ${token}` };
  const deadline = Date.now() + DASHSCOPE_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(pollIntervalMs);

    let pollRes;
    try {
      pollRes = await fetch(pollUrl, { headers: pollHeaders, signal });
    } catch (err) {
      return createErrorResult(HTTP_STATUS.BAD_GATEWAY, `alims-intl video poll failed: ${err.message}`);
    }

    const pollText = await pollRes.text().catch(() => "");
    if (!pollRes.ok) return createErrorResult(pollRes.status, `alims-intl video poll error: ${pollText.slice(0, 500)}`);

    let pollData;
    try { pollData = JSON.parse(pollText); } catch {
      return createErrorResult(HTTP_STATUS.BAD_GATEWAY, "alims-intl video: invalid poll response");
    }

    const status = pollData?.output?.task_status;
    log?.debug?.("VIDEO", `alims-intl | ${model} | task ${taskId} ${status}`);

    if (status === "FAILED") {
      const msg = pollData?.output?.message || "alims-intl video generation failed";
      return createErrorResult(HTTP_STATUS.BAD_GATEWAY, `[alims-intl/${model}] ${msg}`);
    }

    if (status !== "SUCCEEDED") continue;

    // Normalize to OpenAI-compat video response shape
    const videoUrl = pollData?.output?.video_url;
    const normalized = {
      id: taskId,
      object: "video.generation",
      status: "completed",
      model,
      data: videoUrl ? [{ url: videoUrl }] : [],
      usage: pollData?.output?.usage || null,
      _raw: pollData.output,
    };

    return {
      success: true,
      response: new Response(JSON.stringify(normalized), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }),
    };
  }

  return createErrorResult(HTTP_STATUS.REQUEST_TIMEOUT, `alims-intl video generation timeout after ${DASHSCOPE_POLL_TIMEOUT_MS / 60000} min`);
}
