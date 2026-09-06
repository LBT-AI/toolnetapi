import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const DEFAULT_ACCOUNTS_DIR = path.join(os.homedir(), ".toolnet", "freebuff", "accounts");

export function getAccountsBaseDir() {
  const custom = process.env.FREEBUFF_ACCOUNTS_DIR?.trim();
  if (custom) return custom;
  return DEFAULT_ACCOUNTS_DIR;
}

export function getAccountHome(connectionId) {
  if (!connectionId || typeof connectionId !== "string") {
    throw new Error("Invalid connectionId for Freebuff account isolation");
  }
  // Sanitize connectionId to prevent directory traversal
  const safeId = connectionId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(getAccountsBaseDir(), safeId);
}

export function getAccountConfigDir(connectionId) {
  return path.join(getAccountHome(connectionId), ".config", "manicode");
}

export function getAccountCredentialsPath(connectionId) {
  return path.join(getAccountConfigDir(connectionId), "credentials.json");
}

export function ensureAccountDir(connectionId) {
  const accountHome = getAccountHome(connectionId);
  const configDir = getAccountConfigDir(connectionId);
  
  if (!fs.existsSync(getAccountsBaseDir())) {
    fs.mkdirSync(getAccountsBaseDir(), { recursive: true, mode: 0o700 });
  }
  
  if (!fs.existsSync(accountHome)) {
    fs.mkdirSync(accountHome, { recursive: true, mode: 0o700 });
  }

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }

  const credPath = path.join(configDir, "credentials.json");
  if (!fs.existsSync(credPath)) {
    if (process.env.TOOLNET_FREEBUFF_DEV_SEED_CREDENTIALS === "1") {
      const defaultCred = path.join(os.homedir(), ".config", "manicode", "credentials.json");
      if (fs.existsSync(defaultCred)) {
        try {
          fs.copyFileSync(defaultCred, credPath);
          fs.chmodSync(credPath, 0o600);
        } catch {
          /* ignore copy error */
        }
      }
    }
  } else {
    try {
      fs.chmodSync(credPath, 0o600);
    } catch {
      /* ignore */
    }
  }
  return { accountHome, configDir };
}

export function resolveFreebuffBinary() {
  const envBin = process.env.FREEBUFF_BIN?.trim();
  if (envBin && fs.existsSync(envBin)) {
    return envBin;
  }

  const candidates = [
    "/root/.config/manicode/freebuff",
    path.join(os.homedir(), ".config", "manicode", "freebuff"),
    "/usr/bin/freebuff",
    "/usr/local/bin/freebuff",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return "freebuff";
}

export function getAccountEnv(connectionId) {
  const accountHome = getAccountHome(connectionId);
  ensureAccountDir(connectionId);

  // Return clean environment isolated to this account's HOME
  const env = {
    ...process.env,
    HOME: accountHome,
    USERPROFILE: accountHome,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
  };

  delete env.CI;
  delete env.CONTINUOUS_INTEGRATION;

  return env;
}

export function hasAccountCredentials(connectionId) {
  try {
    const credPath = getAccountCredentialsPath(connectionId);
    if (!fs.existsSync(credPath)) return false;
    const content = fs.readFileSync(credPath, "utf8");
    const parsed = JSON.parse(content);
    return Boolean(parsed?.default?.authToken || parsed?.default?.token || parsed?.authToken);
  } catch {
    return false;
  }
}

/**
 * Returns safe non-secret account metadata.
 * NEVER returns authToken, sessionToken, or cookies.
 */
export function getAccountInfo(connectionId) {
  try {
    const credPath = getAccountCredentialsPath(connectionId);
    if (!fs.existsSync(credPath)) return null;
    const content = fs.readFileSync(credPath, "utf8");
    const parsed = JSON.parse(content);
    const def = parsed?.default || parsed || {};
    return {
      id: def.id || null,
      name: def.name || null,
      email: def.email || null,
      fingerprintId: def.fingerprintId || null,
    };
  } catch {
    return null;
  }
}

/**
 * Safely seeds credentials into the isolated account home.
 * Used for initializing account with existing authenticated profile if available.
 */
export function seedAccountCredentials(connectionId, credentialsContent) {
  const { configDir } = ensureAccountDir(connectionId);
  const target = path.join(configDir, "credentials.json");
  const data = typeof credentialsContent === "string"
    ? credentialsContent
    : JSON.stringify(credentialsContent, null, 2);
  fs.writeFileSync(target, data, { mode: 0o600 });
}
