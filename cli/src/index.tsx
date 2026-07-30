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
  
  if (term === "dumb" || term === "vt100" || term === "vanilla") return true;
  
  // Detect mobile SSH clients (Termius, JuiceSSH, etc. set SSH_CLIENT / SSH_TTY)
  if (env.SSH_CLIENT || env.SSH_TTY || env.SSH_CONNECTION) {
    const isAdvancedDesktopTerm = termProgram.includes("kitty") || 
                                  termProgram.includes("wezterm") || 
                                  termProgram.includes("iterm") || 
                                  Boolean(env.KITTY_WINDOW_ID) || 
                                  Boolean(env.ALACRITTY_LOG);
    if (!isAdvancedDesktopTerm) return true;
  }
  
  // If terminal dimensions are missing or too small for full TUI
  if (!process.stdout.columns || process.stdout.columns < 60) return true;
  return false;
}

function drainStdin() {
  try {
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
      process.stdin.setRawMode(false);
    }
    if (typeof process.stdin.read === "function") {
      process.stdin.read();
    }
  } catch {}
}

if (SIMPLE) {
  await startRepl();
  process.exit(0);
}

// Default: Launch Full TUI interface! Fallback to REPL if unsupported
try {
  const tui = await import("./tui-entry");
  await tui.main();
  process.exit(0);
} catch {
  drainStdin();
  await startRepl();
}

export {};
