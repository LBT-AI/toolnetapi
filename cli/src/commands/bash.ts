import type { Command, CommandContext } from "./index";
import { toolBash } from "../lib/codingAgent";

export const bashCommand: Command = {
  name: "bash",
  aliases: ["sh", "shell", "cmd"],
  description: "Execute a bash/shell command",
  usage: "/bash <command>",
  async handler(args: string[], ctx: CommandContext) {
    const { addMessage } = ctx;
    if (args.length === 0) {
      addMessage("assistant",
        "Usage: `/bash <command>`\n" +
        "e.g. `/bash ls -la`\n" +
        "e.g. `/bash npx tsc --noEmit`"
      );
      return;
    }

    const command = args.map(a => {
      if (/^[a-zA-Z0-9_\\-\\.\\/]+$/.test(a)) return a;
      return `'${a.replace(/'/g, "'\\''")}'`;
    }).join(" ");
    addMessage("assistant", `$ ${command}`);
    const result = await toolBash(command);
    if (!result.success) {
      const output = result.data || result.error;
      addMessage("assistant", `\u001b[31mExit code: ${result.error?.startsWith("Bash error") ? "?" : "1"}\u001b[0m\n${output || result.error}`);
      return;
    }
    const tag = result.truncated ? " \u001b[33m(truncated)\u001b[0m" : "";
    addMessage("assistant", `${result.data}${tag}`);
  },
};
