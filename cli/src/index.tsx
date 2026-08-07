#!/usr/bin/env bun

import { initWorkspace } from "./lib/codingAgent";

initWorkspace();

const args = process.argv.slice(2);
const SIMPLE = args.includes("--simple") || args.includes("-s");

if (SIMPLE) {
  const { main: mainRepl } = await import("./simple-repl");
  await mainRepl();
} else {
  // Launch full-screen TUI (raw terminal mode, Termius compatible)
  const { main: mainTui } = await import("./tui");
  await mainTui();
}
export {};

export {};
