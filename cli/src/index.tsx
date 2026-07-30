#!/usr/bin/env bun

process.env.OTUI_NO_NATIVE_RENDER = "true";

const args = process.argv.slice(2);
const SIMPLE = args.includes("--simple") || args.includes("-s") || process.env.TOOLNET_TUI === "simple";
const FORCE_TUI = args.includes("--tui") || args.includes("-t");

async function startRepl() {
  const { main } = await import("./simple-repl");
  await main();
}

function cleanupTerminal() {
  try {
    process.stdout.write("\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?1004l\x1b[?25h\x1b[?1049l");
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
      process.stdin.setRawMode(false);
    }
  } catch {}
}

if (FORCE_TUI) {
  try {
    const tui = await import("./tui-entry");
    await tui.main();
    cleanupTerminal();
    process.exit(0);
  } catch (err) {
    cleanupTerminal();
  }
}

// Default: Run robust AGY-style interactive CLI (simple-repl)
cleanupTerminal();
await startRepl();
process.exit(0);

export {};
