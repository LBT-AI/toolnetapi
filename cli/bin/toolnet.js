#!/usr/bin/env bun

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcPath = join(__dirname, "..", "src", "index.tsx");
const args = process.argv.slice(2);
const bunBin = process.execPath || "bun";

const child = spawn(bunBin, [srcPath, ...args], {
  stdio: "inherit",
  cwd: join(__dirname, ".."),
  env: { ...process.env, PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}` },
});

child.on("exit", (code) => {
  process.exit(code || 0);
});
