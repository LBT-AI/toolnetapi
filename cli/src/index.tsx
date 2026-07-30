#!/usr/bin/env bun

process.env.OTUI_NO_NATIVE_RENDER = "true";

const args = process.argv.slice(2);
const SIMPLE = args.includes("--simple") || args.includes("-s") || process.env.TOOLNET_TUI === "simple";
const FORCE_TUI = args.includes("--tui") || args.includes("-t");

async function startRepl() {
  const { main } = await import("./simple-repl");
  await main();
}

function isMobileOrIncompatibleTerminal(): boolean {
  if (!process.stdout.isTTY || !process.stdin.isTTY) return true;
  const env = process.env as Record<string, string | undefined>;
  const term = (env.TERM || "").toLowerCase();
  const termProgram = (env.TERM_PROGRAM || "").toLowerCase();
  const sshClient = (env.SSH_CLIENT || "").toLowerCase();
  if (term === "dumb" || term === "vt100" || term === "vanilla") return true;
  if (termProgram.includes("termius") || env.TERMIUS || sshClient.includes("termius")) return true;
  // If terminal dimensions are missing or too small for full TUI
  if (!process.stdout.columns || process.stdout.columns < 40) return true;
  return false;
}

if ((SIMPLE || isMobileOrIncompatibleTerminal()) && !FORCE_TUI) {
  await startRepl();
  process.exit(0);
}

// Try TUI; fallback to REPL if it fails (e.g. on incompatible terminals)
try {
  const tui = await import("./tui-entry");
  await tui.main();
  process.exit(0);
} catch {
  await startRepl();
}

export {};
