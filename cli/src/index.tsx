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

function cleanupTerminal() {
  try {
    // Disable mouse tracking (1000, 1002, 1003, 1006), focus tracking (1004), show cursor (25h), leave alt screen (1049l)
    process.stdout.write("\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?1004l\x1b[?25h\x1b[?1049l");
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
      process.stdin.setRawMode(false);
    }
    if (typeof process.stdin.read === "function") {
      process.stdin.read();
    }
  } catch {}
}

if ((SIMPLE || isMobileOrIncompatibleTerminal()) && !FORCE_TUI) {
  cleanupTerminal();
  await startRepl();
  process.exit(0);
}

// Launch Full TUI interface on supported desktop terminals! Fallback to REPL if unsupported
try {
  const tui = await import("./tui-entry");
  await tui.main();
  cleanupTerminal();
  process.exit(0);
} catch {
  cleanupTerminal();
  await startRepl();
}

export {};
