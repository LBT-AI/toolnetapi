import type { Command, CommandContext } from "./index";
import { currentCwd } from "../lib/codingAgent";

export const pwdCommand: Command = {
  name: "pwd",
  aliases: [],
  description: "Print current working directory",
  usage: "/pwd",
  async handler(args: string[], ctx: CommandContext) {
    ctx.addMessage("assistant", `Current directory: ${currentCwd}`);
  },
};
