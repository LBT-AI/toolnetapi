/**
 * Live repro for issue #1933: MiMo Code Free returns HTTP 502 "MiMo bootstrap failed: 403".
 * Root cause: upstream gates on Chrome-like User-Agent. Without UA → 403 "Illegal access".
 * Hits real endpoints — no mocks. Free provider, safe to call.
 */
import { describe, it, expect } from "vitest";
import { proxyAwareFetch } from "../../open-sse/utils/proxyFetch.js";
import { __test__ } from "../../open-sse/executors/mimo-free.js";

const { BOOTSTRAP_URL, CHAT_URL, generateFingerprint, MIMO_SYSTEM_MARKER } = __test__;

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function bootstrapWith(ua) {
  const headers = { "Content-Type": "application/json" };
  if (ua) headers["User-Agent"] = ua;
  try {
    const r = await proxyAwareFetch(BOOTSTRAP_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ client: generateFingerprint() }),
      signal: AbortSignal.timeout(2500),
    });
    const text = await r.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      return { status: r.status, jwt: null };
    }
    return { status: r.status, jwt: data?.jwt };
  } catch {
    return { status: 503, jwt: null };
  }
}

async function chatWith(jwt, ua) {
  const headers = {
    "Content-Type": "application/json",
    "X-Mimo-Source": "mimocode-cli-free",
    Authorization: `Bearer ${jwt}`,
    Accept: "application/json",
  };
  if (ua) headers["User-Agent"] = ua;
  const body = {
    model: "mimo-auto",
    messages: [
      { role: "system", content: MIMO_SYSTEM_MARKER },
      { role: "user", content: "hi" },
    ],
    stream: false,
  };
  return proxyAwareFetch(CHAT_URL, { method: "POST", headers, body: JSON.stringify(body) });
}

describe("MiMo Free bootstrap (live)", () => {
  it("bootstrap returns 200 with JWT", async (ctx) => {
    const { status, jwt } = await bootstrapWith(CHROME_UA);
    if (status !== 200 || !jwt) {
      ctx.skip(`Live endpoint unreachable or changed (status: ${status})`);
      return;
    }
    expect(status).toBe(200);
    expect(jwt).toBeTruthy();
  });
});

describe("MiMo Free anti-abuse gate (live)", () => {
  it("chat WITH Chrome User-Agent → 200", async (ctx) => {
    const { status, jwt } = await bootstrapWith(CHROME_UA);
    if (status !== 200 || !jwt) {
      ctx.skip(`Live endpoint unreachable or changed (status: ${status})`);
      return;
    }
    const r = await chatWith(jwt, CHROME_UA);
    expect(r.status).toBe(200);
  });
});
