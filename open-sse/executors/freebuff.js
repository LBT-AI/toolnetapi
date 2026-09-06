import { BaseExecutor } from "./base.js";
import { freebuffWorkerPool } from "../services/freebuff/workerPool.js";
import { normalizeFreebuffModelId } from "../services/freebuff/modelCatalog.js";

/**
 * Builds clean prompt text from OpenAI-compatible messages array.
 */
function buildFreebuffPrompt(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return "";

  // Single user message optimization
  if (messages.length === 1 && messages[0]?.role === "user" && typeof messages[0]?.content === "string") {
    return messages[0].content.trim();
  }

  const sections = [];
  let systemText = "";
  const conversation = [];

  for (const m of messages) {
    if (!m) continue;
    const role = String(m.role || "user").toLowerCase();
    let content = "";
    if (typeof m.content === "string") {
      content = m.content;
    } else if (Array.isArray(m.content)) {
      content = m.content
        .map((part) => (typeof part === "string" ? part : part?.text || ""))
        .filter(Boolean)
        .join("\n");
    }

    if (!content.trim()) continue;

    if (role === "system") {
      systemText += (systemText ? "\n\n" : "") + content.trim();
    } else if (role === "assistant") {
      conversation.push(`Assistant: ${content.trim()}`);
    } else {
      conversation.push(`User: ${content.trim()}`);
    }
  }

  if (systemText) {
    sections.push(`[System Instructions]\n${systemText}`);
  }

  if (conversation.length > 0) {
    sections.push(conversation.join("\n\n"));
  }

  return sections.join("\n\n---\n\n") || "(empty)";
}

export class FreebuffExecutor extends BaseExecutor {
  constructor() {
    super("freebuff", {
      id: "freebuff",
      baseUrl: "freebuff://pty/worker",
      noAuth: true,
    });
  }

  buildUrl() {
    return "freebuff://pty/worker";
  }

  buildHeaders() {
    return {};
  }

  async execute({ model, body, stream, credentials, signal, log }) {
    const rawMessages = body?.messages || body?.input || [];
    const prompt = buildFreebuffPrompt(rawMessages);
    const normalizedModel = normalizeFreebuffModelId(model);
    const connectionId = credentials?.id || credentials?.connectionId || "default";

    log?.info?.("FREEBUFF_EXEC", `Dispatching request: conn=${connectionId} model=${normalizedModel} stream=${Boolean(stream)} promptChars=${prompt.length}`);

    // If external tool_calls requested but not supported yet
    if (Array.isArray(body?.tools) && body.tools.length > 0) {
      log?.warn?.("FREEBUFF_EXEC", "External client tool_calls requested, but Freebuff Phase 1 supports text chat only");
    }

    if (!stream) {
      try {
        const text = await freebuffWorkerPool.dispatch({
          connectionId,
          model: normalizedModel,
          prompt,
          stream: false,
          signal,
          log,
        });

        const created = Math.floor(Date.now() / 1000);
        const openAiResponse = {
          id: `chatcmpl-freebuff-${Date.now()}`,
          object: "chat.completion",
          created,
          model: `freebuff/${normalizedModel}`,
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: text,
              },
              finish_reason: "stop",
            },
          ],
          usage: null,
        };

        return {
          response: new Response(JSON.stringify(openAiResponse), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }),
          url: "freebuff://pty/worker",
          headers: {},
          transformedBody: { prompt },
        };
      } catch (err) {
        log?.error?.("FREEBUFF_EXEC", `Execution failed: ${err.message}`);
        return this.handleExecutionError(err);
      }
    }

    // Streaming implementation
    const responseId = `chatcmpl-freebuff-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);

    const sseStream = new ReadableStream({
      start: async (controller) => {
        const emit = (str) => {
          try {
            controller.enqueue(new TextEncoder().encode(str));
          } catch {
            /* stream closed */
          }
        };

        let roleEmitted = false;

        const onChunk = (delta) => {
          if (!roleEmitted) {
            emit(`data: ${JSON.stringify({
              id: responseId,
              object: "chat.completion.chunk",
              created,
              model: `freebuff/${normalizedModel}`,
              choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }],
            })}\n\n`);
            roleEmitted = true;
          }

          if (delta) {
            emit(`data: ${JSON.stringify({
              id: responseId,
              object: "chat.completion.chunk",
              created,
              model: `freebuff/${normalizedModel}`,
              choices: [{ index: 0, delta: { content: delta }, finish_reason: null }],
            })}\n\n`);
          }
        };

        try {
          await freebuffWorkerPool.dispatch({
            connectionId,
            model: normalizedModel,
            prompt,
            stream: true,
            onChunk,
            signal,
            log,
          });

          // Final stop chunk + [DONE]
          emit(`data: ${JSON.stringify({
            id: responseId,
            object: "chat.completion.chunk",
            created,
            model: `freebuff/${normalizedModel}`,
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          })}\n\n`);
          emit("data: [DONE]\n\n");
          controller.close();
        } catch (err) {
          log?.error?.("FREEBUFF_STREAM", `Stream error: ${err.message}`);
          emit(`data: ${JSON.stringify({
            error: {
              message: err.message,
              type: "freebuff_stream_error",
            },
          })}\n\n`);
          emit("data: [DONE]\n\n");
          controller.close();
        }
      },
    });

    return {
      response: new Response(sseStream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      }),
      url: "freebuff://pty/worker",
      headers: {},
      transformedBody: { prompt },
    };
  }

  handleExecutionError(err) {
    const msg = err?.message || String(err);
    let status = 502;
    if (msg.includes("401") || msg.includes("authentication required")) {
      status = 401;
    } else if (msg.includes("429") || msg.includes("quota exhausted")) {
      status = 429;
    } else if (msg.includes("503") || msg.includes("unavailable")) {
      status = 503;
    } else if (msg.includes("504") || msg.includes("timed out") || msg.includes("Timeout")) {
      status = 504;
    } else if (msg.includes("400") || msg.includes("unsupported model")) {
      status = 400;
    }

    const errorBody = {
      error: {
        message: msg,
        type: "freebuff_error",
        code: status,
      },
    };

    return {
      response: new Response(JSON.stringify(errorBody), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
      url: "freebuff://pty/worker",
      headers: {},
      transformedBody: {},
    };
  }
}
