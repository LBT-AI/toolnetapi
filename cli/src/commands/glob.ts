import type { Command, CommandContext } from "./index";
import { toolGlob } from "../lib/codingAgent";

export const globCommand: Command = {
  name: "glob",
  aliases: ["find"],
  description: "Find files matching a glob pattern",
  usage: "/glob <pattern> [path]",
  async handler(args: string[], ctx: CommandContext) {
    const { addMessage } = ctx;
    if (args.length === 0) {
      addMessage("assistant", "Usage: `/glob <pattern> [path]`\ne.g. `/glob \"**/*.ts\" src/`");
      return;
    }
    const pattern = args[0];
    const searchPath = args[1] || ".";

    const result = toolGlob(pattern, searchPath);
    if (!result.success) {
      addMessage("assistant", `\u001b[31m${result.error}\u001b[0m`);
      return;
    }
    addMessage("assistant", `Glob \`${pattern}\` in \`${searchPath}\`:\n${result.data}`);
  },
};
