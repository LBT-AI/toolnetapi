#!/usr/bin/env bun

const args = process.argv.slice(2);
const SIMPLE = args.includes("--simple") || args.includes("-s");

if (SIMPLE) {
  const { main: mainRepl } = await import("./simple-repl");
  await mainRepl();
  process.exit(0);
}

// Launch full-screen TUI (raw terminal mode, Termius compatible)
const { main: mainTui } = await import("./tui");
await mainTui();
