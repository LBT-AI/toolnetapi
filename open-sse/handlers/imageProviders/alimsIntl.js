// Alibaba Model Studio — DashScope native image generation API.
//
// Endpoint routing:
//   wan2.6-image, wan2.7-image, wan2.7-image-pro
//     → POST .../multimodal-generation/generation
//   all other image models
//     → POST .../text2image/image-synthesis
//
// Both endpoints use the same async pattern:
//   POST + X-DashScope-Async: enable  → { output: { task_id, task_status:"PENDING" } }
//   GET  .../tasks/{task_id}          → { output: { task_status:"SUCCEEDED", results:[{url}] } }
//
// Host resolution:
//   workspace key  (sk-ws-*)  → per-connection dashScopeBase stored in providerSpecificData
//   standard key   (sk-...)   → dashscope-intl.aliyuncs.com
import { sleep, nowSec, POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "./_base.js";

const INTL_BASE = "https://dashscope-intl.aliyuncs.com/api/v1";
const TEXT2IMAGE_PATH = "/services/aigc/text2image/image-synthesis";
const MULTIMODAL_PATH = "/services/aigc/multimodal-generation/generation";

// Models that use the multimodal-generation endpoint instead of text2image
const MULTIMODAL_IMAGE_MODELS = new Set(["wan2.6-image", "wan2.7-image", "wan2.7-image-pro"]);

function resolveBase(credentials) {
  return credentials?.providerSpecificData?.dashScopeBase
    || credentials?.providerSpecificData?.baseUrl?.replace(/\/compatible-mode\/v1\/?$/, "/api/v1").replace(/\/api\/v1\/api\/v1/, "/api/v1")
    || INTL_BASE;
}

function resolveImagePath(model) {
  return MULTIMODAL_IMAGE_MODELS.has(model) ? MULTIMODAL_PATH : TEXT2IMAGE_PATH;
}

function buildHeaders(credentials) {
  const key = credentials?.apiKey || credentials?.accessToken;
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${key}`,
    "X-DashScope-Async": "enable",
  };
}

// Map OpenAI size "WxH" → Alibaba size "W*H"
function resolveSize(size) {
  if (!size) return "1024*1024";
  return size.replace("x", "*");
}

function buildBody(model, body) {
  const req = {
    model,
    input: { prompt: body.prompt },
    parameters: {},
  };
  if (body.size)            req.parameters.size = resolveSize(body.size);
  if (body.n && body.n > 1) req.parameters.n = body.n;
  if (body.negative_prompt) req.parameters.negative_prompt = body.negative_prompt;
  if (body.seed != null)    req.parameters.seed = body.seed;
  return req;
}

async function pollTask(base, taskId, authHeader) {
  const pollHeaders = { "Authorization": authHeader };
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const r = await fetch(`${base}/tasks/${taskId}`, { headers: pollHeaders });
    if (!r.ok) throw new Error(`alims-intl poll ${r.status}`);

    const data = await r.json();
    const status = data?.output?.task_status;

    if (status === "SUCCEEDED") return data;
    if (status === "FAILED")    throw new Error(data?.output?.message || "alims-intl image generation failed");
    // PENDING / RUNNING → keep polling
  }

  throw new Error("alims-intl image generation timeout");
}

function normalize(responseBody) {
  const created = nowSec();

  // Already OpenAI shape
  if (responseBody.created && Array.isArray(responseBody.data)) return responseBody;

  const results = responseBody?.output?.results || [];
  if (!results.length) return { created, data: [] };

  const data = results.map((r) => {
    if (r.url)      return { url: r.url };
    if (r.b64_json) return { b64_json: r.b64_json };
    return {};
  });

  return { created, data };
}

export default {
  async: true,

  // credentials is available here; capture base & model for use in parseResponse
  buildUrl: (model, credentials) => `${resolveBase(credentials)}${resolveImagePath(model)}`,

  buildHeaders,

  buildBody,

  // imageGenerationCore passes { headers, log, streamToClient, onRequestSuccess, url, requestBody, model, body }
  // Extract base from url (strip the path suffix) and auth from headers.
  async parseResponse(response, { headers, url, model }) {
    const data = await response.json();

    // Synchronous success (some models may not go async)
    if (data?.output?.task_status === "SUCCEEDED") return data;

    const taskId = data?.output?.task_id;
    if (!taskId) throw new Error(`alims-intl: no task_id in response — ${JSON.stringify(data)}`);

    // Reconstruct poll base from the submission URL (strip the /services/aigc/... suffix)
    const base = url.replace(/\/services\/aigc\/.+$/, "");
    const authHeader = headers?.["Authorization"] || headers?.authorization || "";
    return pollTask(base, taskId, authHeader);
  },

  normalize,
};
