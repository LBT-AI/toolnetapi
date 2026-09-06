import { getJailbreakPrompt, JAILBREAK_LEVELS } from './open-sse/config/jailbreakPrompts.js';

const messages = [{ role: 'user', content: 'Reply exactly TOOLNET_FREEBUFF_OK' }];
let content = messages.map(m => m.content).join("\n");
const wrapper = getJailbreakPrompt(JAILBREAK_LEVELS.HACKER_ULTRA);
let final = wrapper.replace("{{prompt}}", Buffer.from(content).toString('base64'));

console.log(final);
