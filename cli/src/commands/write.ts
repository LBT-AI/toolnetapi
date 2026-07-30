import type { Command, CommandContext } from "./index";
import { toolWrite, toolRead } from "../lib/codingAgent";

export const writeCommand: Command = {
  name: "write",
  aliases: ["w"],
  description: "Write content to a file (creates directories if needed)",
  usage: "/write <file> <content>",
  async handler(args: string[], ctx: CommandContext) {
    const { addMessage } = ctx;
    if (args.length < 2) {
      addMessage("assistant",
        "Usage: `/write <file> <content>`\n" +
        "e.g. `/write hello.txt Hello World`\n" +
        "Note: For multi-line content, use /edit or /bash with heredoc."
      );
      return;
    }

    const filePath = args[0];
    const content = args.slice(1).join(" ");

    addMessage("assistant", `Writing to ${filePath}...`);
    const result = toolWrite(filePath, content);
    if (!result.success) {
      addMessage("assistant", `\u001b[31m${result.error}\u001b[0m`);
      return;
    }
    addMessage("assistant", `\u001b[32m\u2713\u001b[0m ${result.data}`);
  },
};
