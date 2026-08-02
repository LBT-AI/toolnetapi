import type { Command, CommandContext } from "./index";
import { getCurrentSession } from "../lib/session";

export const clearCommand: Command = {
  name: "clear",
  aliases: ["cls"],
  description: "Clear the chat screen",
  usage: "/clear",
  async handler(args: string[], ctx: CommandContext) {
    const session = getCurrentSession();
    // Clear the TUI state by emptying the message history
    session.messages = [];
    ctx.addMessage("assistant", "Chat screen cleared.");
  },
};
