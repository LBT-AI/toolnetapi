import type { Command, CommandContext } from "./index";
import { setAgentMode } from "../lib/session";

export const planCommand: Command = {
  name: "plan",
  aliases: ["planning"],
  description: "Trigger planning mode",
  usage: "/plan",
  async handler(_args: string[], ctx: CommandContext) {
    setAgentMode("plan");
    ctx.setStatusMsg("Agent mode set to: plan");
    ctx.addMessage("assistant", "\x1b[32m\u2713\x1b[0m Switched to Plan mode.");
  },
};
