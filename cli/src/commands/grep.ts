import type { Command, CommandContext } from "./index";
import { toolGrep } from "../lib/codingAgent";

export const grepCommand: Command = {
  name: "grep",
  aliases: ["search", "findstr"],
  description: "Search file contents for a pattern",
  usage: "/grep <pattern> [path] [--include=*.ts]",
  async handler(args: string[], ctx: CommandContext) {
    const { addMessage } = ctx;
    if (args.length === 0) {
      addMessage("assistant", "Usage: `/grep <pattern> [path] [--include=*.ts]`\ne.g. `/grep \"function\" src/`");
      return;
    }
    let pattern = "";
    let searchPath = ".";
    let include: string | undefined;

    for (const arg of args) {
      if (arg.startsWith("--include=")) {
        include = arg.slice("--include=".length);
      } else if (!pattern) {
        pattern = arg;
      } else if (searchPath === ".") {
        searchPath = arg;
      }
    }

    addMessage("assistant", `Searching for \`${pattern}\` in \`${searchPath}\`...`);
    const result = toolGrep(pattern, searchPath, include);
    if (!result.success) {
      addMessage("assistant", `\u001b[31m${result.error}\u001b[0m`);
      return;
    }
    addMessage("assistant", `Grep results:\n${result.data}`);
  },
};
