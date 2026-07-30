import type { GatewayClient } from "../lib/gateway";
import { helpCommand } from "./help";
import { statusCommand } from "./status";
import { modelCommand } from "./model";
import { exitCommand } from "./exit";
import { providersCommand } from "./providers";
import { combosCommand } from "./combos";
import { settingsCommand } from "./settings";
import { keysCommand } from "./keys";
import { toolsCommand } from "./tools";
import { mcpCommand } from "./mcp";
import { skillsCommand } from "./skills";
import { readCommand } from "./read";
import { globCommand } from "./glob";
import { grepCommand } from "./grep";
import { editCommand } from "./edit";
import { writeCommand } from "./write";
import { bashCommand } from "./bash";
import { websearchCommand } from "./websearch";
import { webfetchCommand } from "./webfetch";
import { questionCommand } from "./question";
import { undoCommand } from "./undo";
import { redoCommand } from "./redo";
import { configCommand } from "./config";
import { sessionCommand } from "./session";
import { jailbreakCommand } from "./jailbreak";
import { tuiCommand } from "./tui";

export interface CommandContext {
  gateway: GatewayClient;
  addMessage: (role: "user" | "assistant", content: string) => void;
  setModel: (model: string) => void;
  setStatusMsg: (msg: string) => void;
  exit: () => void;
  currentModel: () => string;
}

export interface Command {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  handler: (args: string[], ctx: CommandContext) => Promise<void>;
}

const builtinCommands: Command[] = [
  helpCommand,
  statusCommand,
  modelCommand,
  exitCommand,
  providersCommand,
  combosCommand,
  settingsCommand,
  keysCommand,
  toolsCommand,
  mcpCommand,
  skillsCommand,
  readCommand,
  globCommand,
  grepCommand,
  editCommand,
  writeCommand,
  bashCommand,
  websearchCommand,
  webfetchCommand,
  questionCommand,
  undoCommand,
  redoCommand,
  configCommand,
  sessionCommand,
  jailbreakCommand,
  tuiCommand,
];

export function getAllCommands(): Command[] {
  return builtinCommands;
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

export function findCommand(input: string): { command: Command; args: string[] } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  const parts = trimmed.slice(1).split(/\s+/);
  const cmdName = parts[0].toLowerCase();
  const args = parts.slice(1).map(stripQuotes);

  for (const cmd of builtinCommands) {
    if (cmd.name === cmdName || cmd.aliases.includes(cmdName)) {
      return { command: cmd, args };
    }
  }

  return null;
}

export async function dispatchCommand(
  input: string,
  ctx: CommandContext
): Promise<boolean> {
  const found = findCommand(input);
  if (!found) return false;

  const { command, args } = found;
  await command.handler(args, ctx);
  return true;
}
