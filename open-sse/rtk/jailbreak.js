import { injectSystemPrompt } from "./systemInject.js";
import { getJailbreakPrompt, JAILBREAK_LEVELS } from "../config/jailbreakPrompts.js";

export function injectJailbreak(body, format, level, customPrompt, provider, model) {
  const prompt = level === 'custom' && customPrompt ? customPrompt : getJailbreakPrompt(level, provider, model);
  injectSystemPrompt(body, format, prompt);
}
