import type { Command, CommandContext } from "./index";

async function listKeys(ctx: CommandContext) {
  const { gateway, addMessage } = ctx;
  const res = await gateway.getApiKeys();
  if (!res.success) {
    addMessage("assistant", `\u001b[31mFailed to fetch API keys: ${res.error}\u001b[0m`);
    return;
  }
  const keys = res.data?.keys || [];
  if (keys.length === 0) {
    addMessage("assistant", "No API keys. Use `/keys create <name>`.");
    return;
  }
  const lines: string[] = [];
  lines.push(`API Keys (${keys.length})`);
  lines.push("───".repeat(12));
  for (const k of keys) {
    const status = k.isActive !== false ? "\u001b[32mactive\u001b[0m" : "\u001b[90mdisabled\u001b[0m";
    const masked = k.key.length > 8 ? k.key.slice(0, 8) + "..." : k.key;
    lines.push(`  \u001b[1m${k.name}\u001b[0m  ${status}`);
    lines.push(`      id: ${k.id}  key: ${masked}`);
    if (k.lastUsedAt) lines.push(`      last used: ${k.lastUsedAt}`);
    lines.push(`      created: ${k.createdAt}`);
  }
  addMessage("assistant", lines.join("\n"));
}

async function createKey(args: string[], ctx: CommandContext) {
  const { gateway, addMessage } = ctx;
  if (args.length < 1) {
    addMessage("assistant", "Usage: `/keys create <name>`\ne.g. `/keys create my-app`");
    return;
  }
  const name = args.join(" ");
  addMessage("assistant", `Creating API key "${name}"...`);
  const res = await gateway.createApiKey(name);
  if (res.success && res.data) {
    const lines: string[] = [];
    lines.push(`\u001b[32m\u2713\u001b[0m API key created:`);
    lines.push(`  Name:  ${res.data.name}`);
    lines.push(`  Key:   \u001b[1m${res.data.key}\u001b[0m`);
    lines.push(`  ID:    ${res.data.id}`);
    lines.push("");
    lines.push("\u001b[33mSave this key now — it won't be shown again.\u001b[0m");
    addMessage("assistant", lines.join("\n"));
  } else {
    addMessage("assistant", `\u001b[31mFailed: ${res.error}\u001b[0m`);
  }
}

async function deleteKey(args: string[], ctx: CommandContext) {
  const { gateway, addMessage } = ctx;
  if (args.length < 1) {
    addMessage("assistant", "Usage: `/keys delete <id>`");
    return;
  }
  const id = args[0];
  addMessage("assistant", `Deleting API key ${id}...`);
  const res = await gateway.deleteApiKey(id);
  if (res.success) {
    addMessage("assistant", `\u001b[32m\u2713\u001b[0m Key ${id} deleted.`);
  } else {
    addMessage("assistant", `\u001b[31mFailed: ${res.error}\u001b[0m`);
  }
}

export const keysCommand: Command = {
  name: "keys",
  aliases: ["api-keys", "apikeys"],
  description: "Manage API keys for external access",
  usage: "/keys [list|create|delete] ...",
  async handler(args: string[], ctx: CommandContext) {
    if (args.length === 0 || args[0] === "list") {
      await listKeys(ctx);
      return;
    }
    const sub = args[0].toLowerCase();
    const subArgs = args.slice(1);
    switch (sub) {
      case "create":  await createKey(subArgs, ctx); break;
      case "delete":  await deleteKey(subArgs, ctx); break;
      case "rm":      await deleteKey(subArgs, ctx); break;
      default:        ctx.addMessage("assistant", `Unknown: ${sub}\nTry: /keys list, create, delete`); break;
    }
  },
};
