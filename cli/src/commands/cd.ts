import type { Command, CommandContext } from "./index";
import { setCwd, currentCwd } from "../lib/codingAgent";

export const cdCommand: Command = {
  name: "cd",
  aliases: [],
  description: "Change current working directory",
  usage: "/cd <path>",
  async handler(args: string[], ctx: CommandContext) {
    if (args.length === 0) {
      ctx.addMessage("assistant", `Usage: /cd <path>`);
      return;
    }
    const newPath = args[0];
    const success = setCwd(newPath);
    if (success) {
      ctx.addMessage("assistant", `Changed directory to: ${currentCwd}`);
    } else {
      ctx.addMessage("assistant", `Failed to change directory to: ${newPath}`);
    }
  },
};
