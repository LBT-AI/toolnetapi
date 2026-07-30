import type { Command, CommandContext } from "./index";
import { getConfig, updateConfig, getConfigPath } from "../lib/config";

export const configCommand: Command = {
  name: "config",
  aliases: ["cfg"],
  description: "View or update persistent CLI configuration",
  usage: "/config [key value]",
  async handler(args: string[], ctx: CommandContext) {
    const { addMessage } = ctx;
    if (args.length === 0) {
      const cfg = getConfig();
      const lines: string[] = [];
      lines.push("ToolNet CLI Config");
      lines.push("───".repeat(10));
      lines.push(`  Config file: \u001b[90m${getConfigPath()}\u001b[0m`);
      lines.push("");
      lines.push(`  baseUrl:       ${cfg.baseUrl}`);
      lines.push(`  defaultModel:  ${cfg.defaultModel}`);
      lines.push(`  theme:         ${cfg.theme}`);
      lines.push(`  rtkEnabled:    ${cfg.rtkEnabled}`);
      lines.push(`  sessions:      ${cfg.sessionOrder.length}`);
      lines.push("");
      lines.push("Change: /config <key> <value>");
      lines.push("  baseUrl       — Gateway endpoint (e.g. http://127.0.0.1:20128)");
      lines.push("  defaultModel  — Default model (e.g. openai/gpt-4o)");
      lines.push("  theme         — dark or light");
      lines.push("  rtkEnabled    — true or false");
      addMessage("assistant", lines.join("\n"));
      return;
    }

    if (args[0] === "--help" || args[0] === "help") {
      addMessage("assistant",
        "/config — CLI Configuration\n\n" +
        "  /config              View current config\n" +
        "  /config baseUrl <url>\n" +
        "  /config defaultModel <model>\n" +
        "  /config theme dark|light\n" +
        "  /config rtkEnabled true|false"
      );
      return;
    }

    const key = args[0] as keyof import("../lib/config").CliConfig;
    const val = args.slice(1).join(" ");

    if (key === "rtkEnabled") {
      updateConfig({ rtkEnabled: val === "true" });
    } else if (key === "baseUrl") {
      updateConfig({ baseUrl: val });
    } else if (key === "defaultModel") {
      updateConfig({ defaultModel: val });
    } else if (key === "theme") {
      updateConfig({ theme: val });
    } else {
      addMessage("assistant", `\u001b[31mUnknown key: ${key}\u001b[0m`);
      return;
    }
    addMessage("assistant", `\u001b[32m\u2713\u001b[0m ${key} updated to "${val}"`);
  },
};
