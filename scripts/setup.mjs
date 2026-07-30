#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import crypto from "node:crypto";
import os from "node:os";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_FILE = path.join(ROOT, ".env");
const ENV_EXAMPLE = path.join(ROOT, ".env.example");
const CLI_DIR = path.join(ROOT, "cli");
const CLI_BIN = path.join(CLI_DIR, "bin", "toolnet.js");
const TOOLNET_DIR = path.join(os.homedir(), ".toolnetapi");
const GATEWAY_URL_FILE = path.join(TOOLNET_DIR, "gateway-url");

const PLACEHOLDER_VALUES = [
  "your-jwt-secret-change-this",
  "your-api-key-secret-change-this",
  "your-machine-id-salt-change-this",
  "123456",
  "toolnetapi-jwt-secret-dev-only",
  "toolnetapi-api-key-secret-dev-only",
  "toolnetapi-machine-id-salt-dev-only",
];

function randomSecret(len = 48) {
  return crypto.randomBytes(len).toString("hex");
}

function isPlaceholder(val) {
  return PLACEHOLDER_VALUES.includes(val.trim());
}

function parseEnv(text) {
  const lines = text.split("\n");
  const result = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function serializeEnv(entries) {
  return entries.map(([key, value]) => `${key}=${value}`).join("\n") + "\n";
}

function print(msg) {
  console.log(`\x1b[32m\u2713\x1b[0m ${msg}`);
}

function warn(msg) {
  console.log(`\x1b[33m!\x1b[0m ${msg}`);
}

function error(msg) {
  console.log(`\x1b[31m\u2717\x1b[0m ${msg}`);
}

function step(msg) {
  console.log(`\n\x1b[36m==>\x1b[0m ${msg}`);
}

function run(cmd, opts = {}) {
  try {
    execSync(cmd, { cwd: ROOT, stdio: "inherit", ...opts });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log("\x1b[1m\x1b[36mToolNet API — Setup\x1b[0m\n");

  // ── Step 1: .env ──
  step("1. Environment file");

  if (!fs.existsSync(ENV_FILE)) {
    if (fs.existsSync(ENV_EXAMPLE)) {
      fs.copyFileSync(ENV_EXAMPLE, ENV_FILE);
      print("Created .env from .env.example");
    } else {
      warn("No .env.example found. Creating minimal .env");
      fs.writeFileSync(ENV_FILE, "# ToolNet API configuration\n", "utf8");
    }
  } else {
    warn(".env already exists, skipping creation");
  }

  const envRaw = fs.readFileSync(ENV_FILE, "utf8");
  const env = parseEnv(envRaw);
  const lines = envRaw.split("\n");
  const updatedLines = [...lines];
  let changed = false;

  const SECRET_KEYS = ["JWT_SECRET", "INITIAL_PASSWORD", "API_KEY_SECRET", "MACHINE_ID_SALT"];

  for (const key of SECRET_KEYS) {
    const val = env[key] || "";
    if (isPlaceholder(val)) {
      const newVal = key === "INITIAL_PASSWORD" ? randomSecret(12) : randomSecret();
      for (let i = 0; i < updatedLines.length; i++) {
        const trimmed = updatedLines[i].trim();
        if (trimmed.startsWith(`${key}=`)) {
          updatedLines[i] = `${key}=${newVal}`;
          changed = true;
          break;
        }
      }
      env[key] = newVal;
      print(`${key} generated`);
    } else {
      print(`${key} already set`);
    }
  }

  if (changed) {
    fs.writeFileSync(ENV_FILE, updatedLines.join("\n"), "utf8");
    warn("Updated .env with secure random values");
  }

  // ── Step 2: Root dependencies ──
  step("2. Root dependencies");
  run("npm install", { cwd: ROOT });

  // ── Step 3: CLI dependencies ──
  step("3. CLI dependencies");
  if (fs.existsSync(CLI_DIR)) {
    let installed = false;
    try {
      execSync("bun --version", { stdio: "ignore" });
      installed = run("bun install", { cwd: CLI_DIR });
    } catch {
      warn("bun not found. Try: curl -fsSL https://bun.sh/install | bash");
      warn("Falling back to npm install for CLI (limited support)");
      installed = run("npm install", { cwd: CLI_DIR });
    }

    if (installed) {
      print("CLI dependencies installed");
    } else {
      error("CLI dependency install failed. Run: cd cli && bun install");
    }
  } else {
    warn("cli/ directory not found, skipping");
  }

  // ── Step 4: Auth directory ──
  step("4. Auth & gateway URL");
  fs.mkdirSync(TOOLNET_DIR, { recursive: true });
  print(`Directory: ${TOOLNET_DIR}`);

  const port = env.PORT || "20128";
  const host = env.NEXT_PUBLIC_BASE_URL || `http://localhost:${port}`;
  fs.writeFileSync(GATEWAY_URL_FILE, host, "utf8");
  fs.chmodSync(GATEWAY_URL_FILE, 0o644);
  print(`Gateway URL: ${host} (${GATEWAY_URL_FILE})`);

  if (fs.existsSync(CLI_BIN)) {
    fs.chmodSync(CLI_BIN, 0o755);
    print(`CLI bin: ${CLI_BIN}`);
  }

  // ── Step 5: CLI symlinks ──
  step("5. CLI symlinks");
  const symlinks = [
    { name: "toolnet", target: "cli/bin/toolnet.js" },
    { name: "toolnetapi", target: "toolnet" },
  ];
  for (const { name, target } of symlinks) {
    const linkPath = path.join(ROOT, name);
    if (!fs.existsSync(linkPath)) {
      try {
        fs.symlinkSync(target, linkPath, "file");
        fs.chmodSync(linkPath, 0o755);
        print(`Created: ${name}`);
      } catch (err) {
        warn(`Could not create ${name}: ${err.message}`);
      }
    } else {
      warn(`${name} already exists`);
    }
  }

  // ── Done ──
  console.log("\n" + "\x1b[1m\x1b[32mSetup complete!\x1b[0m\n");
  console.log("  \x1b[36mStart gateway:\x1b[0m  npm run dev");
  console.log("  \x1b[36mStart CLI:\x1b[0m     ./toolnetapi");
  console.log("  \x1b[36mDashboard:\x1b[0m     http://localhost:" + port + "/dashboard");
  console.log("  \x1b[36mAPI:\x1b[0m           http://localhost:" + port + "/v1");
  console.log("  \x1b[36mLogin password:\x1b[0m " + (env.INITIAL_PASSWORD || "(check .env)"));
  console.log("");
}

main().catch((err) => {
  console.error("\x1b[31mSetup failed:\x1b[0m", err.message);
  process.exit(1);
});
