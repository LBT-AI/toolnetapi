import type { Command, CommandContext } from "./index";

async function listProviders(ctx: CommandContext) {
  const { gateway, addMessage } = ctx;
  const res = await gateway.getProviders();
  if (!res.success) {
    addMessage("assistant", `\u001b[31mFailed to fetch providers: ${res.error}\u001b[0m`);
    return;
  }
  const providers = res.data?.connections || [];
  if (providers.length === 0) {
    addMessage("assistant", "No providers connected. Use `/providers add` or `/providers oauth`.");
    return;
  }
  const lines: string[] = [];
  lines.push(`Providers (${providers.length})`);
  lines.push("───".repeat(18));
  for (const p of providers) {
    const icon = p.testStatus === "active" ? "\u001b[32m\u2713\u001b[0m" : p.testStatus === "error" ? "\u001b[31m\u2717\u001b[0m" : "\u001b[33m?\u001b[0m";
    const name = p.displayName || p.name || p.email || p.providerId || p.provider || "unknown";
    const status = p.isActive === false ? " \u001b[90m(disabled)\u001b[0m" : "";
    lines.push(`  ${icon} ${name}${status}`);
    lines.push(`      id: ${p.id}  provider: ${p.provider}  priority: ${p.priority ?? "-"}`);
    if (p.defaultModel) lines.push(`      model: ${p.defaultModel}`);
  }
  addMessage("assistant", lines.join("\n"));
}

async function addApiKeyProvider(args: string[], ctx: CommandContext) {
  const { gateway, addMessage } = ctx;
  if (args.length < 2) {
    addMessage("assistant", "Usage: `/providers add <provider> <apiKey> [name]`\ne.g. `/providers add openai sk-... My OpenAI`");
    return;
  }
  const provider = args[0];
  const apiKey = args[1];
  const name = args.slice(2).join(" ") || undefined;
  addMessage("assistant", `Adding ${provider} provider...`);
  const res = await gateway.createApiKeyProvider({ provider, apiKey, name });
  if (res.success) {
    addMessage("assistant", `\u001b[32m\u2713\u001b[0m ${provider} provider added.`);
  } else {
    addMessage("assistant", `\u001b[31mFailed: ${res.error}\u001b[0m`);
  }
}

async function testProvider(args: string[], ctx: CommandContext) {
  const { gateway, addMessage } = ctx;
  if (args.length < 1) {
    addMessage("assistant", "Usage: `/providers test <id>`");
    return;
  }
  const id = args[0];
  addMessage("assistant", `Testing provider ${id}...`);
  const res = await gateway.testProvider(id);
  if (res.success) {
    if (res.data?.valid) {
      addMessage("assistant", `\u001b[32m\u2713\u001b[0m Provider ${id} is working.`);
    } else {
      addMessage("assistant", `\u001b[31m\u2717\u001b[0m Provider ${id} failed: ${res.data?.error || "unknown"}`);
    }
  } else {
    addMessage("assistant", `\u001b[31mTest error: ${res.error}\u001b[0m`);
  }
}

async function deleteProvider(args: string[], ctx: CommandContext) {
  const { gateway, addMessage } = ctx;
  if (args.length < 1) {
    addMessage("assistant", "Usage: `/providers delete <id>`");
    return;
  }
  const id = args[0];
  addMessage("assistant", `Deleting provider ${id}...`);
  const res = await gateway.deleteProvider(id);
  if (res.success) {
    addMessage("assistant", `\u001b[32m\u2713\u001b[0m Provider ${id} deleted.`);
  } else {
    addMessage("assistant", `\u001b[31mFailed: ${res.error}\u001b[0m`);
  }
}

async function oauthFlow(args: string[], ctx: CommandContext) {
  const { gateway, addMessage } = ctx;
  if (args.length < 1) {
    addMessage("assistant", "Usage: `/providers oauth <provider>`\ne.g. `/providers oauth github`\nSupported: openai, anthropic, google, github, xai, groq, together, perplexity, deepseek, mistral, cohere, huggingface, replicate, azure, bedrock, vertex");
    return;
  }
  const provider = args[0];
  addMessage("assistant", `Starting OAuth flow for ${provider}...`);
  const res = await gateway.getOAuthDeviceCode(provider);
  if (!res.success) {
    addMessage("assistant", `\u001b[31mOAuth error: ${res.error}\u001b[0m`);
    return;
  }
  const dc = res.data!;
  const lines: string[] = [];
  lines.push(`OAuth — ${provider}`);
  lines.push("───".repeat(12));
  lines.push(`  Code:       \u001b[1m${dc.user_code}\u001b[0m`);
  lines.push(`  URL:        ${dc.verification_uri}`);
  if (dc.verification_uri_complete) {
    lines.push(`  Direct:     ${dc.verification_uri_complete}`);
  }
  lines.push("");
  lines.push("Open the URL, enter the code, then run:");
  lines.push(`  /providers poll ${provider}`);
  addMessage("assistant", lines.join("\n"));
}

async function pollOAuth(args: string[], ctx: CommandContext) {
  const { gateway, addMessage } = ctx;
  if (args.length < 1) {
    addMessage("assistant", "Usage: `/providers poll <provider>`");
    return;
  }
  const provider = args[0];
  addMessage("assistant", `Polling OAuth for ${provider}...\n(You may need to run this a few times until the user completes the flow)`);
  const res = await gateway.pollOAuthToken(provider, { deviceCode: "" });
  if (res.success) {
    if (res.data?.success) {
      addMessage("assistant", `\u001b[32m\u2713\u001b[0m ${provider} OAuth complete! Provider connected.`);
    } else if (res.data?.pending) {
      addMessage("assistant", "Still waiting for user authorization. Run `/providers poll` again.");
    } else {
      addMessage("assistant", `\u001b[33m?\u001b[0m ${res.data?.connection ? "Connected: " + res.data.connection.displayName : "Status unknown"}`);
    }
  } else {
    addMessage("assistant", `\u001b[31mPoll failed: ${res.error}\u001b[0m`);
  }
}

export const providersCommand: Command = {
  name: "providers",
  aliases: ["prov", "p"],
  description: "Manage connected provider accounts",
  usage: "/providers [list|add|test|delete|oauth|poll] ...",
  async handler(args: string[], ctx: CommandContext) {
    if (args.length === 0 || args[0] === "list") {
      await listProviders(ctx);
      return;
    }
    const sub = args[0].toLowerCase();
    const subArgs = args.slice(1);
    switch (sub) {
      case "add":       await addApiKeyProvider(subArgs, ctx); break;
      case "test":      await testProvider(subArgs, ctx); break;
      case "delete":    await deleteProvider(subArgs, ctx); break;
      case "rm":        await deleteProvider(subArgs, ctx); break;
      case "oauth":     await oauthFlow(subArgs, ctx); break;
      case "poll":      await pollOAuth(subArgs, ctx); break;
      default:          ctx.addMessage("assistant", `Unknown subcommand: ${sub}\nTry: /providers list, add, test, delete, oauth, poll`); break;
    }
  },
};
