import type { Command, CommandContext } from "./index";

async function showToolsStatus(ctx: CommandContext) {
  const { gateway, addMessage } = ctx;
  addMessage("assistant", "Fetching CLI tools status...");
  const res = await gateway.getCliToolsAllStatuses();
  if (!res.success) {
    addMessage("assistant", `\u001b[31mFailed: ${res.error}\u001b[0m`);
    return;
  }
  const data = res.data || {};
  const lines: string[] = [];
  lines.push("CLI Tools — Status");
  lines.push("───".repeat(14));
  for (const [key, val] of Object.entries(data)) {
    const display = typeof val === "object" && val !== null ? JSON.stringify(val, null, 2) : String(val);
    lines.push(`  \u001b[1m${key}\u001b[0m`);
    for (const line of display.split("\n")) {
      lines.push(`    ${line}`);
    }
  }
  addMessage("assistant", lines.join("\n"));
}

export const toolsCommand: Command = {
  name: "tools",
  aliases: ["cli-tools"],
  description: "Show CLI tools status (read/glob/grep/edit/write/bash)",
  usage: "/tools",
  async handler(args: string[], ctx: CommandContext) {
    if (args[0] === "--help" || args[0] === "help") {
      ctx.addMessage("assistant",
        "/tools — Show CLI tools status\n\n" +
        "  /tools    Show available CLI tools and their status\n\n" +
        "CLI tools allow the AI agent to interact with the filesystem:\n" +
        "  read, glob, grep — File reading and search\n" +
        "  edit, write     — File editing\n" +
        "  bash            — Command execution\n" +
        "  websearch, webfetch, question — Web and user interaction"
      );
      return;
    }
    await showToolsStatus(ctx);
  },
};
