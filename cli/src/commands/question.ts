import type { Command, CommandContext } from "./index";

export const questionCommand: Command = {
  name: "question",
  aliases: ["ask", "prompt"],
  description: "Ask a question (prompts user for input)",
  usage: "/question <text>",
  async handler(args: string[], ctx: CommandContext) {
    const { addMessage } = ctx;
    if (args.length === 0) {
      addMessage("assistant", "Usage: `/question <text>`\ne.g. `/question What port should I use?`");
      return;
    }
    const text = args.join(" ");
    addMessage("assistant", `\u001b[33mQUESTION: ${text}\u001b[0m`);
    addMessage("assistant", "\u001b[90m(Type your answer in the input and press Enter)\u001b[0m");
  },
};
