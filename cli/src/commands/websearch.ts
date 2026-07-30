import type { Command, CommandContext } from "./index";

export const websearchCommand: Command = {
  name: "websearch",
  aliases: ["ws", "search-web"],
  description: "Search the web via the gateway",
  usage: "/websearch <query>",
  async handler(args: string[], ctx: CommandContext) {
    const { gateway, addMessage } = ctx;
    if (args.length === 0) {
      addMessage("assistant", "Usage: `/websearch <query>`\ne.g. `/websearch latest Node.js version`");
      return;
    }
    const query = args.join(" ");
    addMessage("assistant", `Searching for "${query}"...`);
    try {
      const res = await fetch(`${gateway.getBaseUrl()}/v1/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        addMessage("assistant", `\u001b[31mSearch failed: HTTP ${res.status}\u001b[0m`);
        return;
      }
      const data = await res.json();
      const results = data.results || data.data || data;
      const formatted = typeof results === "string" ? results : JSON.stringify(results, null, 2);
      addMessage("assistant", formatted);
    } catch (err: unknown) {
      addMessage("assistant", `\u001b[31mSearch error: ${err instanceof Error ? err.message : String(err)}\u001b[0m`);
    }
  },
};
