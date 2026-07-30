import { injectSystemPrompt } from "./systemInject.js";
import { JAILBREAK_PROMPTS, JAILBREAK_LEVELS } from "../config/jailbreakPrompts.js";

export function injectJailbreak(body, format, level) {
  const prompt = JAILBREAK_PROMPTS[level] || JAILBREAK_PROMPTS[JAILBREAK_LEVELS.FULL];
  injectSystemPrompt(body, format, prompt);
}
