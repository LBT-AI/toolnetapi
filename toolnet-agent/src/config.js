import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { homedir } from "os";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const APP_NAME = "toolnet-agent";

function getConfigDir() {
  if (process.platform === "win32") {
    return join(process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"), "ToolNet", "agent");
  }
  return join(homedir(), ".config", "toolnet-agent");
}

const CONFIG_DIR = getConfigDir();
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const LOG_DIR = join(CONFIG_DIR, "logs");
const MITM_DIR = join(CONFIG_DIR, "mitm");

function ensureDirs() {
  for (const dir of [CONFIG_DIR, LOG_DIR, MITM_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

function loadConfig() {
  ensureDirs();
  if (!existsSync(CONFIG_FILE)) {
    const defaultConfig = {
      serverUrl: "https://api.toolnet.tech",
      agentId: null,
      agentToken: null,
      deviceName: null,
      enabledTools: {
        antigravity: false,
        copilot: false,
        kiro: false
      }
    };
    writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
  } catch {
    return {
      serverUrl: "https://api.toolnet.tech",
      agentId: null,
      agentToken: null,
      deviceName: null,
      enabledTools: { antigravity: false, copilot: false, kiro: false }
    };
  }
}

function saveConfig(config) {
  ensureDirs();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

const TOOL_HOSTS = {
  antigravity: ["daily-cloudcode-pa.googleapis.com", "cloudcode-pa.googleapis.com"],
  copilot: ["api.individual.githubcopilot.com"],
  kiro: ["runtime.us-east-1.kiro.dev", "q.us-east-1.amazonaws.com", "codewhisperer.us-east-1.amazonaws.com"],
  cursor: ["api2.cursor.sh"]
};

const URL_PATTERNS = {
  antigravity: [":generateContent", ":streamGenerateContent"],
  copilot: ["/chat/completions", "/v1/messages", "/responses"],
  kiro: ["/generateAssistantResponse"],
  cursor: ["/BidiAppend", "/RunSSE", "/RunPoll", "/Run"]
};

function getToolForHost(host) {
  const h = (host || "").split(":")[0];
  if (h === "api.individual.githubcopilot.com") return "copilot";
  if (h === "daily-cloudcode-pa.googleapis.com" || h === "cloudcode-pa.googleapis.com") return "antigravity";
  if (h === "q.us-east-1.amazonaws.com" || h === "codewhisperer.us-east-1.amazonaws.com" || h === "runtime.us-east-1.kiro.dev") return "kiro";
  if (h === "api2.cursor.sh") return "cursor";
  return null;
}

function isChatRequest(tool, url) {
  const patterns = URL_PATTERNS[tool] || [];
  return patterns.some(p => (url || "").includes(p));
}

export {
  CONFIG_DIR,
  CONFIG_FILE,
  LOG_DIR,
  MITM_DIR,
  loadConfig,
  saveConfig,
  TOOL_HOSTS,
  URL_PATTERNS,
  getToolForHost,
  isChatRequest,
  APP_NAME
};