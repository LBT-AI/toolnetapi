import type { Command, CommandContext } from "./index";
import { getCurrentSession } from "../lib/session";

export const resetCommand: Command = {
  name: "reset",
  aliases: ["restart"],
  description: "Reset the current chat session to a blank state",
  usage: "/reset",
  async handler(args: string[], ctx: CommandContext) {
    const session = getCurrentSession();
    // Blank state
    session.messages = [];
    ctx.addMessage("assistant", "Session has been reset to a blank state. How can I help you?");
  },
};
