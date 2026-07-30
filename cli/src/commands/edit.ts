import type { Command, CommandContext } from "./index";
import { toolEdit, toolReplaceAll } from "../lib/codingAgent";
import { toolRead } from "../lib/codingAgent";

export const editCommand: Command = {
  name: "edit",
  aliases: ["ed"],
  description: "Edit a file by replacing exact text",
  usage: "/edit <file> <old> <new>  or  /edit --read <file>  or  /edit --help",
  async handler(args: string[], ctx: CommandContext) {
    const { addMessage } = ctx;
    if (args.length === 0) {
      addMessage("assistant",
        "Usage:\n" +
        "  /edit <file> <old> <new>       Replace exact text in file\n" +
        "  /edit --replace-all <file> <old> <new>  Replace all occurrences\n" +
        "  /edit --read <file> [offset] [limit]    Read file before editing\n" +
        "  /edit --help                   Show this help"
      );
      return;
    }

    if (args[0] === "--read") {
      const filePath = args[1];
      if (!filePath) { addMessage("assistant", "Usage: /edit --read <file> [offset] [limit]"); return; }
      const offset = parseInt(args[2] || "0", 10) || 0;
      const limit = parseInt(args[3] || "100", 10) || 100;
      const result = toolRead(filePath, offset, limit);
      if (!result.success) { addMessage("assistant", `\u001b[31m${result.error}\u001b[0m`); return; }
      addMessage("assistant", `\`${filePath}\`:\n${result.data}`);
      return;
    }

    if (args[0] === "--replace-all") {
      if (args.length < 3) {
        addMessage("assistant", "Usage: /edit --replace-all <file> <old> <new>");
        return;
      }
      const filePath = args[1];
      const oldStr = args[2];
      const newStr = args.slice(3).join(" ");
      const result = toolReplaceAll(filePath, oldStr, newStr);
      if (!result.success) { addMessage("assistant", `\u001b[31m${result.error}\u001b[0m`); return; }
      addMessage("assistant", `\u001b[32m\u2713\u001b[0m ${result.data}`);
      return;
    }

    if (args.length < 2) {
      addMessage("assistant", "Usage: /edit <file> <old> <new>");
      return;
    }

    const filePath = args[0];
    const oldStr = args[1];
    const newStr = args.slice(2).join(" ");

    const result = toolEdit(filePath, oldStr, newStr);
    if (!result.success) {
      addMessage("assistant", `\u001b[31m${result.error}\u001b[0m`);
      return;
    }
    addMessage("assistant", `\u001b[32m\u2713\u001b[0m ${result.data}`);
  },
};
