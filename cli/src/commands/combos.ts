import type { Command, CommandContext } from "./index";

async function listCombos(ctx: CommandContext) {
  const { gateway, addMessage } = ctx;
  const res = await gateway.getCombos();
  if (!res.success) {
    addMessage("assistant", `\u001b[31mFailed to fetch combos: ${res.error}\u001b[0m`);
    return;
  }
  const combos = res.data?.combos || [];
  if (combos.length === 0) {
    addMessage("assistant", "No combos configured. Use `/combos create`.");
    return;
  }
  const lines: string[] = [];
  lines.push(`Combos (${combos.length})`);
  lines.push("───".repeat(12));
  for (const c of combos) {
    lines.push(`  \u001b[1m${c.name}\u001b[0m  (${c.id})`);
    lines.push(`      models: ${c.models.join(", ")}`);
    if (c.createdAt) lines.push(`      created: ${c.createdAt}`);
  }
  addMessage("assistant", lines.join("\n"));
}

async function createCombo(args: string[], ctx: CommandContext) {
  const { gateway, addMessage } = ctx;
  if (args.length < 2) {
    addMessage("assistant", "Usage: `/combos create <name> <model1> [model2] ...`\ne.g. `/combos create my-combo cc/claude-sonnet-4-5 openai/gpt-4o`");
    return;
  }
  const name = args[0];
  const models = args.slice(1);
  addMessage("assistant", `Creating combo "${name}" with ${models.length} models...`);
  const res = await gateway.createCombo({ name, models });
  if (res.success) {
    addMessage("assistant", `\u001b[32m\u2713\u001b[0m Combo "${name}" created (${res.data?.id || "?"}).`);
  } else {
    addMessage("assistant", `\u001b[31mFailed: ${res.error}\u001b[0m`);
  }
}

async function deleteCombo(args: string[], ctx: CommandContext) {
  const { gateway, addMessage } = ctx;
  if (args.length < 1) {
    addMessage("assistant", "Usage: `/combos delete <id>`");
    return;
  }
  const id = args[0];
  addMessage("assistant", `Deleting combo ${id}...`);
  const res = await gateway.deleteCombo(id);
  if (res.success) {
    addMessage("assistant", `\u001b[32m\u2713\u001b[0m Combo ${id} deleted.`);
  } else {
    addMessage("assistant", `\u001b[31mFailed: ${res.error}\u001b[0m`);
  }
}

export const combosCommand: Command = {
  name: "combos",
  aliases: ["combo"],
  description: "Manage model combos (fallback groups)",
  usage: "/combos [list|create|delete] ...",
  async handler(args: string[], ctx: CommandContext) {
    if (args.length === 0 || args[0] === "list") {
      await listCombos(ctx);
      return;
    }
    const sub = args[0].toLowerCase();
    const subArgs = args.slice(1);
    switch (sub) {
      case "create":  await createCombo(subArgs, ctx); break;
      case "delete":  await deleteCombo(subArgs, ctx); break;
      case "rm":      await deleteCombo(subArgs, ctx); break;
      default:        ctx.addMessage("assistant", `Unknown: ${sub}\nTry: /combos list, create, delete`); break;
    }
  },
};
