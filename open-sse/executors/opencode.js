import crypto from "crypto";
import { BaseExecutor } from "./base.js";
import { PROVIDERS } from "../config/providers.js";
import { injectReasoningContent } from "../utils/reasoningContentInjector.js";
import { resolveSessionId } from "../utils/sessionManager.js";

const OPENCODE_UA = "opencode";
const MESSAGES_MODELS = new Set();
const RESPONSES_MODELS = new Set(["muse-spark-1.2-contributor-free"]);

function generateRequestId() {
  return `msg_${crypto.randomUUID().replace(/-/g, "")}`;
}

function generateSessionId() {
  return `ses_${crypto.randomUUID().replace(/-/g, "")}`;
}

// Normalize any resolved id into opencode's ses_ format (stable per-conversation)
function toOpencodeSession(id) {
  const stripped = String(id || "").replace(/^ses_/, "").replace(/-/g, "");
  return stripped ? `ses_${stripped}` : null;
}

function resolveOpencodeSession(body, credentials) {
  return toOpencodeSession(resolveSessionId({
    headers: credentials?.rawHeaders,
    body,
    connectionId: credentials?.connectionId,
    scope: "opencode",
  }));
}

export class OpenCodeExecutor extends BaseExecutor {
  constructor() {
    super("opencode", PROVIDERS.opencode);
    this._currentSessionId = null;
  }

  transformRequest(model, body, stream, credentials) {
    this._currentSessionId = resolveOpencodeSession(body, credentials);
    return injectReasoningContent({ provider: this.provider, model, body });
  }

  buildUrl(model) {
    const base = this.config.baseUrl;
    if (RESPONSES_MODELS.has(model)) return `${base}/zen/v1/responses`;
    return MESSAGES_MODELS.has(model)
      ? `${base}/zen/v1/messages`
      : `${base}/zen/v1/chat/completions`;
  }

  buildHeaders(credentials, stream = true) {
    const raw = credentials?.rawHeaders || {};
    const lower = {};
    for (const [k, v] of Object.entries(raw)) lower[k.toLowerCase()] = v;

    const downstreamUa = lower["user-agent"] || "";
    const isOpencodeDownstream = downstreamUa.toLowerCase().includes("opencode");

    return {
      "Content-Type": "application/json",
      "Authorization": "Bearer public",
      "User-Agent": isOpencodeDownstream ? downstreamUa : OPENCODE_UA,
      "x-opencode-client": lower["x-opencode-client"] || "desktop",
      "x-opencode-session": lower["x-opencode-session"] || this._currentSessionId || generateSessionId(),
      "x-opencode-request": lower["x-opencode-request"] || generateRequestId(),
      "x-opencode-project": lower["x-opencode-project"] || "global",
      "Accept": stream ? "text/event-stream" : "*/*",
    };
  }

  parseError(response, bodyText) {
    const status = response.status;
    let message = "";
    let resetsAtMs = null;

    try {
      const json = JSON.parse(bodyText);
      message = json.error?.message || json.message || json.error || bodyText;
    } catch {
      message = bodyText;
    }

    const lower = String(message || "").toLowerCase();
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) {
      const seconds = Number.parseInt(retryAfter, 10);
      if (!Number.isNaN(seconds) && seconds > 0) {
        resetsAtMs = Date.now() + seconds * 1000;
      }
    }

    // Cloudflare IP block / challenge detection
    if ((status === 403 || status === 503) && (lower.includes("cloudflare") || lower.includes("ray id") || lower.includes("just a moment"))) {
      return {
        status: 429,
        message: "Proxy IP blocked by Cloudflare (429 rate limit)",
        resetsAtMs: resetsAtMs || Date.now() + 5 * 60 * 1000,
      };
    }

    // Free limit exhausted / rate limit detection
    if (status === 429 || status === 403 || lower.includes("rate limit") || lower.includes("quota") || lower.includes("free limit") || lower.includes("usage limit") || lower.includes("too many requests")) {
      return {
        status: 429,
        message: typeof message === "string" ? message : "OpenCode free limit reached",
        resetsAtMs: resetsAtMs || Date.now() + 3 * 60 * 1000,
      };
    }

    return {
      status,
      message: typeof message === "string" ? message : JSON.stringify(message),
      resetsAtMs,
    };
  }
}
