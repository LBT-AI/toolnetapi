import type { Command, CommandContext } from "./index";
import { getCurrentSession, getSessions } from "../lib/session";

export const historyCommand: Command = {
  name: "history",
  aliases: ["hist"],
  description: "Show the chat history or list available sessions",
  usage: "/history [sessions]",
  async handler(args: string[], ctx: CommandContext) {
    if (args.length > 0 && args[0].toLowerCase() === "sessions") {
      const sessions = getSessions();
      const lines = sessions.map((s, i) => `${i + 1}. ${s.name} (${s.messages.length} msgs)`);
      ctx.addMessage("assistant", `Available Sessions:\n${lines.join("\n")}`);
      return;
    }

    const session = getCurrentSession();
    if (!session.messages || session.messages.length === 0) {
      ctx.addMessage("assistant", "The current session has no history.");
      return;
    }
    
    const lines = session.messages.map((m, i) => {
      let preview = m.content.replace(/\n/g, " ");
      if (preview.length > 80) preview = preview.slice(0, 77) + "...";
      return `[${i + 1}] ${m.role === 'user' ? 'User' : 'Assistant'}: ${preview}`;
    });

    ctx.addMessage("assistant", `Chat History (${session.name}):\n${lines.join("\n")}`);
  },
};
