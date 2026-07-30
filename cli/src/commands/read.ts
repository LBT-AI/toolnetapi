import type { Command, CommandContext } from "./index";
import { toolRead } from "../lib/codingAgent";

export const readCommand: Command = {
  name: "read",
  aliases: ["r"],
  description: "Read file contents with optional offset and limit",
  usage: "/read <file> [offset] [limit]",
  async handler(args: string[], ctx: CommandContext) {
    const { addMessage } = ctx;
    if (args.length === 0) {
      addMessage("assistant", "Usage: `/read <file> [offset] [limit]`\ne.g. `/read src/index.tsx` or `/read package.json 0 50`");
      return;
    }
    const filePath = args[0];
    const offset = args.length > 1 ? parseInt(args[1], 10) || 0 : 0;
    const limit = args.length > 2 ? parseInt(args[2], 10) || 200 : 200;

    addMessage("assistant", `Reading ${filePath}...`);
    const result = toolRead(filePath, offset, limit);
    if (!result.success) {
      addMessage("assistant", `\u001b[31m${result.error}\u001b[0m`);
      return;
    }
    const tag = result.truncated ? " \u001b[33m(truncated)\u001b[0m" : "";
    addMessage("assistant", `\`${filePath}\`${tag}:\n${result.data}`);
  },
};
