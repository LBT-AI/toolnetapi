import type { Command, CommandContext } from "./index";

export const webfetchCommand: Command = {
  name: "webfetch",
  aliases: ["wf", "fetch-web"],
  description: "Fetch and read web page content",
  usage: "/webfetch <url>",
  async handler(args: string[], ctx: CommandContext) {
    const { gateway, addMessage } = ctx;
    if (args.length === 0) {
      addMessage("assistant", "Usage: `/webfetch <url>`\ne.g. `/webfetch https://example.com`");
      return;
    }
    const url = args[0];
    addMessage("assistant", `Fetching ${url}...`);
    try {
      const res = await fetch(`${gateway.getBaseUrl()}/v1/web/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        addMessage("assistant", `\u001b[31mFetch failed: HTTP ${res.status}\u001b[0m`);
        return;
      }
      const data = await res.json();
      const content = data.content || data.text || data.markdown || data.data || data;
      const formatted = typeof content === "string" ? content : JSON.stringify(content, null, 2);
      addMessage("assistant", formatted);
    } catch (err: unknown) {
      addMessage("assistant", `\u001b[31mFetch error: ${err instanceof Error ? err.message : String(err)}\u001b[0m`);
    }
  },
};
