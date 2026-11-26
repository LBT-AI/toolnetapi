import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/usageDb.js", () => ({
  appendRequestLog: vi.fn(async () => {}),
  saveRequestDetail: vi.fn(async () => {}),
  saveRequestUsage: vi.fn(async () => {}),
}));

import { handleNonStreamingResponse } from "../../open-sse/handlers/chatCore/nonStreamingHandler.js";
import { FORMATS } from "../../open-sse/translator/formats.js";
import { saveRequestDetail, saveRequestUsage } from "@/lib/usageDb.js";

beforeEach(() => vi.clearAllMocks());

function context(error) {
  const payload = `data: ${JSON.stringify({ error })}\n\ndata: [DONE]\n\n`;
  return {
    providerResponse: new Response(payload, { headers: { "content-type": "text/event-stream" } }),
    provider: "kiro",
    model: "test-model",
    sourceFormat: FORMATS.OPENAI,
    targetFormat: FORMATS.OPENAI,
    body: { model: "test-model", stream: false, messages: [] },
    stream: false,
    requestStartTime: Date.now(),
    connectionId: "synthetic-connection",
    clientRawRequest: { endpoint: "/v1/chat/completions" },
    onRequestSuccess: vi.fn(),
    trackDone: vi.fn(),
    appendLog: vi.fn(),
    reqLogger: { logProviderResponse: vi.fn(), logConvertedResponse: vi.fn() },
    log: { line: vi.fn() },
  };
}

describe("non-streaming SSE upstream errors (9router v0.5.112)", () => {
  it.each([
    [403, 403],
    ["429", 429],
    [503, 503],
    [600, 502],
    ["invalid", 502],
  ])("returns HTTP %s as %s without success side effects", async (upstreamStatus, expectedStatus) => {
    const ctx = context({ status: upstreamStatus, message: "Synthetic upstream failure" });
    const result = await handleNonStreamingResponse(ctx);
    expect(result.success).toBe(false);
    expect(result.status).toBe(expectedStatus);
    expect(result.response.status).toBe(expectedStatus);
    expect((await result.response.json()).error.message).toBe("Synthetic upstream failure");
    expect(ctx.appendLog).toHaveBeenCalledWith({ status: `FAILED ${expectedStatus}` });
    expect(ctx.onRequestSuccess).not.toHaveBeenCalled();
    expect(ctx.reqLogger.logConvertedResponse).not.toHaveBeenCalled();
    expect(saveRequestDetail).not.toHaveBeenCalled();
    expect(saveRequestUsage).not.toHaveBeenCalled();
  });

  it("uses a safe fallback status and message when the SSE error lacks them", async () => {
    const ctx = context({ code: "synthetic_failure" });
    const result = await handleNonStreamingResponse(ctx);
    expect(result.status).toBe(502);
    expect((await result.response.json()).error.message).toBe("Upstream SSE stream failed");
  });
});
