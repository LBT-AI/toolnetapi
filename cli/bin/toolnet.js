#!/usr/bin/env bun

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcPath = join(__dirname, "..", "dist", "index.js");
const args = process.argv.slice(2);
const bunBin = process.execPath;

const child = spawn(bunBin, [srcPath, ...args], {
  stdio: "inherit",
  cwd: process.cwd(),
  env: { ...process.env, PATH: `${process.env.HOME}/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin` },
});

child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => { console.error("Failed to start toolnet:", err.message); process.exit(1); });
