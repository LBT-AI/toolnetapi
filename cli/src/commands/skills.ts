import type { Command, CommandContext } from "./index";

interface Skill {
  id: string;
  name: string;
  description: string;
  endpoint: string | null;
  icon: string;
}

const BUILTIN_SKILLS: Skill[] = [
  { id: "toolnetapi",        name: "ToolNet API (Entry)",     description: "Starting point for using the ToolNet API", endpoint: null, icon: "\uD83C\uDF10" },
  { id: "toolnetapi-chat",   name: "Chat",                    description: "Chat completions via OpenAI-compatible API", endpoint: "/v1/chat/completions", icon: "\uD83D\uDCAC" },
  { id: "toolnetapi-image",  name: "Image Generation",        description: "Generate images via DALL-E compatible API", endpoint: "/v1/images/generations", icon: "\uD83C\uDFA8" },
  { id: "toolnetapi-tts",    name: "Text-to-Speech",          description: "Convert text to speech audio", endpoint: "/v1/audio/speech", icon: "\uD83C\uDFA4" },
  { id: "toolnetapi-stt",    name: "Speech-to-Text",          description: "Transcribe audio to text", endpoint: "/v1/audio/transcriptions", icon: "\uD83C\uDF99\uFE0F" },
  { id: "toolnetapi-embeddings", name: "Embeddings",          description: "Generate text embeddings", endpoint: "/v1/embeddings", icon: "\uD83D\uDCD0" },
  { id: "toolnetapi-web-search", name: "Web Search",          description: "Search the web via the gateway", endpoint: "/v1/search", icon: "\uD83D\uDD0D" },
  { id: "toolnetapi-web-fetch",  name: "Web Fetch",           description: "Fetch and summarize web pages", endpoint: "/v1/web/fetch", icon: "\uD83C\uDF0D" },
];

function showSkillsList(ctx: CommandContext) {
  const { addMessage } = ctx;
  const lines: string[] = [];
  lines.push(`Skills (${BUILTIN_SKILLS.length})`);
  lines.push("───".repeat(10));
  for (const s of BUILTIN_SKILLS) {
    const ep = s.endpoint ? ` \u001b[90m${s.endpoint}\u001b[0m` : "";
    lines.push(`  ${s.icon} \u001b[1m${s.name}\u001b[0m${ep}`);
    lines.push(`           ${s.description}`);
  }
  lines.push("");
  lines.push("Usage: /skills <name>  — Show skill details");
  addMessage("assistant", lines.join("\n"));
}

function showSkillDetail(name: string, ctx: CommandContext) {
  const { addMessage } = ctx;
  const skill = BUILTIN_SKILLS.find(
    s => s.id === name || s.name.toLowerCase().includes(name.toLowerCase())
  );
  if (!skill) {
    addMessage("assistant", `\u001b[31mSkill not found: ${name}\u001b[0m`);
    return;
  }
  const lines: string[] = [];
  lines.push(`${skill.icon}  \u001b[1m${skill.name}\u001b[0m`);
  lines.push("───".repeat(10));
  lines.push(`  ID:          ${skill.id}`);
  lines.push(`  Description: ${skill.description}`);
  lines.push(`  Endpoint:    ${skill.endpoint || "(entry skill)"}`);
  lines.push("");
  lines.push("Add this skill to your AI's instructions to teach it how");
  lines.push(`to use the ${skill.name} feature of ToolNet API.`);
  addMessage("assistant", lines.join("\n"));
}

export const skillsCommand: Command = {
  name: "skills",
  aliases: ["skill"],
  description: "List available API skills for AI agents",
  usage: "/skills [skill-name]",
  async handler(args: string[], ctx: CommandContext) {
    if (args.length === 0) {
      showSkillsList(ctx);
      return;
    }
    if (args[0] === "--help" || args[0] === "help") {
      ctx.addMessage("assistant",
        "/skills — API Skills for AI Agents\n\n" +
        "  /skills           List all available skills\n" +
        "  /skills <name>    Show skill details\n\n" +
        "Skills are instructional guides that teach AI agents how\n" +
        "to use specific ToolNet API features."
      );
      return;
    }
    showSkillDetail(args.join(" "), ctx);
  },
};
