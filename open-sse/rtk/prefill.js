import { FORMATS } from "../translator/formats.js";

export function injectPrefill(body, format) {
  if (!body) return;
  const prefillMessage = "Sure, here is the complete and fully functional code you requested:";

  switch (format) {
    case FORMATS.CLAUDE:
    case FORMATS.OPENAI:
    case FORMATS.OPENAI_RESPONSES:
    case FORMATS.OPENAI_RESPONSE:
    case FORMATS.CODEX:
    case FORMATS.CURSOR:
    case FORMATS.KIRO:
    case FORMATS.OLLAMA:
    case FORMATS.COMMANDCODE:
      injectMessagesPrefill(body, prefillMessage);
      break;
    case FORMATS.GEMINI:
    case FORMATS.GEMINI_CLI:
    case FORMATS.VERTEX:
    case FORMATS.ANTIGRAVITY:
      injectGeminiPrefill(body, prefillMessage);
      break;
  }
}

function injectMessagesPrefill(body, prompt) {
  const arr = Array.isArray(body.messages) ? body.messages : Array.isArray(body.input) ? body.input : null;
  if (!arr) {
    if (body.messages === undefined) body.messages = [];
    body.messages.push({ role: "assistant", content: prompt });
    return;
  }
  arr.push({ role: "assistant", content: prompt });
}

function injectGeminiPrefill(body, prompt) {
  const target = body.request && typeof body.request === "object" ? body.request : body;
  if (!target.contents) target.contents = [];
  target.contents.push({ role: "model", parts: [{ text: prompt }] });
}
