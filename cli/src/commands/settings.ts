import type { Command, CommandContext } from "./index";

async function showSettings(ctx: CommandContext) {
  const { gateway, addMessage } = ctx;
  const res = await gateway.getSettings();
  if (!res.success) {
    addMessage("assistant", `\u001b[31mFailed to fetch settings: ${res.error}\u001b[0m`);
    return;
  }
  const s = res.data!;
  const lines: string[] = [];
  lines.push("Gateway Settings");
  lines.push("───".repeat(12));
  lines.push(`  RTK:           ${s.rtkEnabled !== false ? "\u001b[32mON\u001b[0m" : "\u001b[33mOFF\u001b[0m"}`);
  lines.push(`  Headroom:      ${s.headroomEnabled ? "\u001b[32mON\u001b[0m" : "\u001b[33mOFF\u001b[0m"}`);
  lines.push(`  Headroom URL:  ${s.headroomUrl || "(not set)"}`);
  lines.push(`  Auth mode:     ${s.authMode || "default"}`);
  lines.push(`  Require login: ${s.requireLogin ? "\u001b[32mYES\u001b[0m" : "\u001b[33mNO\u001b[0m"}`);
  lines.push(`  Has password:  ${s.hasPassword ? "\u001b[32mYES\u001b[0m" : "\u001b[33mNO\u001b[0m"}`);
  lines.push("");
  lines.push("Change: /settings <key> <value>");
  lines.push("  rtk on|off, headroom on|off, headroom-url <url>");
  addMessage("assistant", lines.join("\n"));
}

async function updateSetting(args: string[], ctx: CommandContext) {
  const { gateway, addMessage } = ctx;
  if (args.length < 2) {
    addMessage("assistant", "Usage: /settings <key> <value>\n  rtk on|off\n  headroom on|off\n  headroom-url <url>");
    return;
  }
  const key = args[0].toLowerCase();
  const val = args.slice(1).join(" ");
  let payload: Record<string, unknown> = {};
  switch (key) {
    case "rtk":
      if (val !== "on" && val !== "off") { addMessage("assistant", "Use: rtk on|off"); return; }
      payload = { rtkEnabled: val === "on" };
      break;
    case "headroom":
      if (val !== "on" && val !== "off") { addMessage("assistant", "Use: headroom on|off"); return; }
      payload = { headroomEnabled: val === "on" };
      break;
    case "headroom-url":
      payload = { headroomUrl: val };
      break;
    default:
      addMessage("assistant", `Unknown setting: ${key}\nValid: rtk, headroom, headroom-url`);
      return;
  }
  addMessage("assistant", `Updating ${key}...`);
  const res = await gateway.updateSettings(payload);
  if (res.success) {
    addMessage("assistant", `\u001b[32m\u2713\u001b[0m ${key} updated.`);
  } else {
    addMessage("assistant", `\u001b[31mFailed: ${res.error}\u001b[0m`);
  }
}

export const settingsCommand: Command = {
  name: "settings",
  aliases: ["config", "cfg"],
  description: "View and update gateway settings",
  usage: "/settings [key value]",
  async handler(args: string[], ctx: CommandContext) {
    if (args.length === 0) {
      await showSettings(ctx);
    } else if (args[0] === "--help" || args[0] === "help") {
      ctx.addMessage("assistant",
        "/settings — View or update gateway settings\n\n" +
        "  /settings                Show current settings\n" +
        "  /settings rtk on|off     Toggle RTK token saver\n" +
        "  /settings headroom on|off Toggle headroom mode\n" +
        "  /settings headroom-url <url> Set headroom endpoint"
      );
    } else {
      await updateSetting(args, ctx);
    }
  },
};
