import type { Command, CommandContext } from "./index";
import { getSessions, getCurrentIndex, switchSession, newSession, removeSession, renameSession, getSessionCount } from "../lib/session";

async function listSessions(ctx: CommandContext) {
  const { addMessage } = ctx;
  const sessions = getSessions();
  const current = getCurrentIndex();
  const lines: string[] = [];
  lines.push(`Sessions (${sessions.length})`);
  lines.push("───".repeat(10));
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const marker = i === current ? "\u001b[32m\u25B6\u001b[0m" : " ";
    const name = s.name || `Session ${i + 1}`;
    const msgCount = s.messages.length;
    lines.push(`  ${marker} \u001b[1m${name}\u001b[0m  (${msgCount} msgs, ${s.model})`);
    lines.push(`        id: ${s.id}`);
  }
  addMessage("assistant", lines.join("\n"));
}

async function switchToSession(args: string[], ctx: CommandContext) {
  const { addMessage } = ctx;
  if (args.length < 1) {
    addMessage("assistant", "Usage: /session switch <index|id>");
    return;
  }
  const target = args[0];
  const sessions = getSessions();
  const numIdx = parseInt(target, 10);
  if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= sessions.length) {
    switchSession(numIdx - 1);
    addMessage("assistant", `\u001b[32m\u2713\u001b[0m Switched to session ${numIdx}: ${sessions[numIdx - 1].name}`);
    return;
  }
  const idIdx = sessions.findIndex(s => s.id === target);
  if (idIdx >= 0) {
    switchSession(idIdx);
    addMessage("assistant", `\u001b[32m\u2713\u001b[0m Switched to session: ${sessions[idIdx].name}`);
    return;
  }
  addMessage("assistant", `\u001b[31mSession not found: ${target}\u001b[0m`);
}

function createSession(args: string[], ctx: CommandContext) {
  const { addMessage } = ctx;
  const name = args.join(" ") || undefined;
  const s = newSession(name);
  addMessage("assistant", `\u001b[32m\u2713\u001b[0m Created new session: ${s.name}`);
}

function deleteSession(args: string[], ctx: CommandContext) {
  const { addMessage } = ctx;
  if (getSessionCount() <= 1) {
    addMessage("assistant", "\u001b[33mCannot delete the last session.\u001b[0m");
    return;
  }
  let idx = getCurrentIndex();
  if (args.length > 0) {
    const target = args[0];
    const numIdx = parseInt(target, 10);
    if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= getSessionCount()) {
      idx = numIdx - 1;
    } else {
      const sessions = getSessions();
      const found = sessions.findIndex(s => s.id === target);
      if (found >= 0) idx = found;
    }
  }
  const name = getSessions()[idx]?.name || "";
  if (removeSession(idx)) {
    addMessage("assistant", `\u001b[32m\u2713\u001b[0m Deleted session: ${name}`);
  }
}

function rename(args: string[], ctx: CommandContext) {
  const { addMessage } = ctx;
  if (args.length < 1) {
    addMessage("assistant", "Usage: /session rename <name>");
    return;
  }
  const name = args.join(" ");
  if (renameSession(getCurrentIndex(), name)) {
    addMessage("assistant", `\u001b[32m\u2713\u001b[0m Session renamed to: ${name}`);
  }
}

export const sessionCommand: Command = {
  name: "session",
  aliases: ["sessions", "tab"],
  description: "Manage multi-session tabs",
  usage: "/session [list|new|switch|delete|rename] ...",
  async handler(args: string[], ctx: CommandContext) {
    if (args.length === 0 || args[0] === "list") {
      await listSessions(ctx);
      return;
    }
    const sub = args[0].toLowerCase();
    const subArgs = args.slice(1);
    switch (sub) {
      case "new":
      case "create":  createSession(subArgs, ctx); break;
      case "switch":
      case "goto":    await switchToSession(subArgs, ctx); break;
      case "delete":
      case "rm":      deleteSession(subArgs, ctx); break;
      case "rename":  rename(subArgs, ctx); break;
      default:        ctx.addMessage("assistant", `Unknown: ${sub}\nTry: list, new, switch, delete, rename`); break;
    }
  },
};
