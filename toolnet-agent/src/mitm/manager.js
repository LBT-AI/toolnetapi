import { spawn, execSync } from "child_process";
import { platform } from "os";
import { join } from "path";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "fs";
import net from "net";
import { ROOT_CA_KEY_PATH, ROOT_CA_CERT_PATH, MITM_DIR, PID_FILE, LOCK_FILE, ALIASES_FILE } from "../../src/system/paths.js";
import { generateCert, getCertForDomain } from "./cert/generate.js";
import { installCert, uninstallCert, checkCertInstalled } from "./cert/install.js";
import { isCertExpired } from "./cert/rootCA.js";
import { addDNSEntry, removeDNSEntry, removeAllDNSEntries, removeAllDNSEntriesSync, checkAllDNSStatus, checkDNSEntry } from "./dns/dnsConfig.js";
import { isAdmin } from "../../src/system/admin.js";
import { getPort443Owner, killPort443Owner, killProcess, isProcessAlive } from "../../src/system/process.js";
import { log, err } from "../../src/logger.js";
import { loadConfig, saveConfig, TOOL_HOSTS } from "../../src/config.js";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const IS_WIN = platform() === "win32";
const IS_MAC = platform() === "darwin";
const MITM_PORT = 443;

const DEFAULT_MITM_ROUTER_BASE = "https://api.toolnet.tech";

const MITM_MAX_RESTARTS = 5;
const MITM_RESTART_DELAYS_MS = [5000, 10000, 20000, 30000, 60000];
const MITM_RESTART_RESET_MS = 60000;

let mitmRestartCount = 0;
let mitmLastStartTime = 0;
let mitmIsRestarting = false;

let serverProcess = null;
let serverPid = null;

function resolveBundledServerPath() {
  if (process.env.MITM_SERVER_PATH) return process.env.MITM_SERVER_PATH;
  const sibling = join(__dirname, "server.js");
  if (existsSync(sibling)) return sibling;
  const fromCwd = join(process.cwd(), "toolnet-agent", "src", "mitm", "server.js");
  if (existsSync(fromCwd)) return fromCwd;
  return fromCwd;
}

function ensureRuntimeServer(bundledPath) {
  try {
    if (!bundledPath || !existsSync(bundledPath)) return bundledPath;

    if (!bundledPath.includes(`${join.sep}node_modules${join.sep}`)) {
      return bundledPath;
    }

    const runtimeDir = join(MITM_DIR, "runtime", "mitm");
    const runtimeServer = join(runtimeDir, "server.js");

    if (existsSync(runtimeServer)) {
      try {
        if (existsSync(bundledPath) && existsSync(runtimeServer)) {
          if (readFileSync(bundledPath).length === readFileSync(runtimeServer).length) return runtimeServer;
        }
      } catch { }
    }

    mkdirSync(runtimeDir, { recursive: true });
    writeFileSync(runtimeServer, readFileSync(bundledPath));
    return runtimeServer;
  } catch (e) {
    log(`[MITM] runtime copy failed: ${e.message}`);
    return bundledPath;
  }
}

const SERVER_PATH = ensureRuntimeServer(resolveBundledServerPath());

async function resolveMitmRouterBaseUrl() {
  try {
    const config = loadConfig();
    const raw = config.mitmRouterBaseUrl?.trim() || "";
    if (!raw) return DEFAULT_MITM_ROUTER_BASE;
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return DEFAULT_MITM_ROUTER_BASE;
    return raw.replace(/\/+$/, "");
  } catch {
    return DEFAULT_MITM_ROUTER_BASE;
  }
}

function checkPort443Free() {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", (err) => {
      if (err.code === "EADDRINUSE") resolve("in-use");
      else resolve("no-permission");
    });
    tester.once("listening", () => { tester.close(() => resolve("free")); });
    tester.listen(MITM_PORT, "127.0.0.1");
  });
}

async function killLeftoverMitm() {
  if (serverProcess && !serverProcess.killed) {
    try { serverProcess.kill("SIGKILL"); } catch { }
    serverProcess = null;
    serverPid = null;
  }
  try {
    if (existsSync(PID_FILE)) {
      const savedPid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10);
      if (savedPid && isProcessAlive(savedPid)) {
        killProcess(savedPid, true);
        await new Promise(r => setTimeout(r, 500));
      }
      unlinkSync(PID_FILE);
    }
  } catch { }
  if (!IS_WIN && SERVER_PATH) {
    try {
      const escaped = SERVER_PATH.replace(/'/g, "'\\''");
      execSync(`pkill -SIGKILL -f "${escaped}" 2>/dev/null || true`, { stdio: "ignore" });
      await new Promise(r => setTimeout(r, 500));
    } catch { }
  }
}

function pollMitmHealth(timeoutMs, port = MITM_PORT) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      const req = https.request(
        { hostname: "127.0.0.1", port, path: "/_mitm_health", method: "GET", rejectUnauthorized: false },
        (res) => {
          let body = "";
          res.on("data", (d) => { body += d; });
          res.on("end", () => {
            try {
              const json = JSON.parse(body);
              resolve(json.ok === true ? { ok: true, pid: json.pid || null } : null);
            } catch { resolve(null); }
          });
        }
      );
      req.on("error", () => {
        if (Date.now() < deadline) setTimeout(check, 500);
        else resolve(null);
      });
      req.end();
    };
    check();
  });
}

async function scheduleMitmRestart(apiKey) {
  if (mitmIsRestarting) return;
  mitmIsRestarting = true;

  const aliveMs = Date.now() - mitmLastStartTime;
  if (aliveMs >= MITM_RESTART_RESET_MS) mitmRestartCount = 0;

  if (mitmRestartCount >= MITM_MAX_RESTARTS) {
    err("Max restart attempts reached. Giving up.");
    mitmIsRestarting = false;
    return;
  }

  const attempt = mitmRestartCount;
  const delay = MITM_RESTART_DELAYS_MS[Math.min(attempt, MITM_RESTART_DELAYS_MS.length - 1)];
  mitmRestartCount++;

  log(`Restarting in ${delay / 1000}s... (${mitmRestartCount}/${MITM_MAX_RESTARTS})`);
  await new Promise((r) => setTimeout(r, delay));

  try {
    const config = loadConfig();
    if (config && !config.mitmEnabled) {
      log("MITM disabled, skipping restart");
      mitmIsRestarting = false;
      return;
    }
    await startServer(apiKey);
    log("🔄 Restarted successfully");
    mitmRestartCount = 0;
    mitmIsRestarting = false;
  } catch (e) {
    err(`Restart attempt ${mitmRestartCount}/${MITM_MAX_RESTARTS} failed: ${e.message}`);
    mitmIsRestarting = false;
    scheduleMitmRestart(apiKey);
  }
}

export async function getMitmStatus() {
  let running = serverProcess !== null && !serverProcess.killed;
  let pid = serverPid;

  if (!running) {
    try {
      if (existsSync(PID_FILE)) {
        const savedPid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10);
        if (savedPid && isProcessAlive(savedPid)) {
          running = true;
          pid = savedPid;
        } else {
          unlinkSync(PID_FILE);
        }
      }
    } catch { }
  }

  const dnsStatus = checkAllDNSStatus();
  const certExists = existsSync(ROOT_CA_CERT_PATH);
  const certTrusted = certExists ? await checkCertInstalled() : false;

  return { running, pid, certExists, certTrusted, dnsStatus };
}

export async function startServer(apiKey, forceKillPort443 = false) {
  if (!serverProcess || serverProcess.killed) {
    try {
      if (existsSync(PID_FILE)) {
        const savedPid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10);
        if (savedPid && isProcessAlive(savedPid)) {
          serverPid = savedPid;
          log(`♻️ Reusing existing process (PID: ${savedPid})`);
          return { running: true, pid: savedPid };
        } else {
          unlinkSync(PID_FILE);
        }
      }
    } catch { }
  }

  if (serverProcess && !serverProcess.killed) {
    throw new Error("MITM server is already running");
  }

  try {
    writeFileSync(LOCK_FILE, String(process.pid), { flag: "wx" });
  } catch (e) {
    if (e.code === "EEXIST") {
      let stale = false;
      try {
        const pid = parseInt(readFileSync(LOCK_FILE, "utf-8").trim(), 10);
        stale = !pid || !isProcessAlive(pid);
      } catch { stale = true; }
      if (!stale) throw new Error("MITM server is already starting (lock contention)");
      try { unlinkSync(LOCK_FILE); } catch { }
      writeFileSync(LOCK_FILE, String(process.pid), { flag: "wx" });
    } else throw e;
  }

  try {
    await killLeftoverMitm();

    if (!IS_WIN) {
      const portStatus = await checkPort443Free();
      if (portStatus === "in-use" || portStatus === "no-permission") {
        const owner = await getPort443Owner();
        if (owner) {
          if (forceKillPort443) {
            log(`Killing process on port 443 (PID ${owner.pid}, name=${owner.name})...`);
            await killPort443Owner(owner);
          } else {
            const e = new Error(`Port 443 is already in use by "${owner.name}" (PID ${owner.pid}).`);
            e.code = "PORT_443_BUSY";
            e.portOwner = { pid: owner.pid, name: owner.name };
            throw e;
          }
        }
      }
    }

    const rootCACertPath = ROOT_CA_CERT_PATH;
    const rootCAKeyPath = ROOT_CA_KEY_PATH;
    const certExists = existsSync(rootCACertPath) && existsSync(rootCAKeyPath);

    if (!certExists || isCertExpired(rootCACertPath)) {
      if (certExists) {
        log("🔐 Cert expired — uninstalling old cert...");
        try { await uninstallCert(); } catch { }
      }
      log("🔐 Generating Root CA...");
      await generateCert();
    }

    const rootCATrusted = await checkCertInstalled();
    if (!rootCATrusted) {
      log("🔐 Cert: not trusted → installing...");
      try {
        await installCert();
        log("🔐 Cert: ✅ trusted");
      } catch (e) {
        throw new Error(`Failed to trust certificate: ${e.message}`);
      }
    } else {
      log("🔐 Cert: already trusted ✅");
    }

    let effectiveServerPath = SERVER_PATH;
    if (!effectiveServerPath || !existsSync(effectiveServerPath)) {
      log(`[MITM] server.js missing at ${effectiveServerPath} → recopying`);
      effectiveServerPath = ensureRuntimeServer(resolveBundledServerPath());
      if (!effectiveServerPath || !existsSync(effectiveServerPath)) {
        throw new Error(`MITM server.js not found at ${effectiveServerPath}. Reinstall toolnet-agent.`);
      }
    }
    const mitmRouterBase = await resolveMitmRouterBaseUrl();
    log(`🚀 Starting server... (router: ${mitmRouterBase})`);

    if (IS_WIN) {
      const winOwner = await getPort443Owner();
      if (winOwner) {
        if (forceKillPort443) {
          log(`Killing process on port 443 (PID ${winOwner.pid}, name=${winOwner.name})...`);
          await killPort443Owner(winOwner);
        } else {
          const e = new Error(`Port 443 is already in use by "${winOwner.name}" (PID ${winOwner.pid}).`);
          e.code = "PORT_443_BUSY";
          e.portOwner = { pid: winOwner.pid, name: winOwner.name };
          throw e;
        }
      }

      serverProcess = spawn(
        process.execPath,
        [effectiveServerPath],
        {
          detached: false,
          windowsHide: true,
          cwd: process.cwd(),
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            ROUTER_API_KEY: apiKey,
            NODE_ENV: "production",
            MITM_ROUTER_BASE: mitmRouterBase,
          },
        }
      );
    } else {
      serverProcess = spawn(process.execPath, [effectiveServerPath], {
        detached: false,
        windowsHide: true,
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          ROUTER_API_KEY: apiKey,
          NODE_ENV: "production",
          MITM_ROUTER_BASE: mitmRouterBase,
        },
      });
    }

    if (serverProcess) {
      serverPid = serverProcess.pid;
      writeFileSync(PID_FILE, String(serverPid));
      mitmLastStartTime = Date.now();
    }

    if (IS_MAC) {
      const rootCAPath = ROOT_CA_CERT_PATH;
      if (existsSync(rootCAPath)) {
        execSync(`launchctl setenv NODE_EXTRA_CA_CERTS "${rootCAPath}"`, { stdio: "ignore" });
        log(`[launchctl] NODE_EXTRA_CA_CERTS set to ${rootCAPath}`);
      }
    } else if (IS_WIN) {
      const rootCAPath = ROOT_CA_CERT_PATH;
      if (existsSync(rootCAPath)) {
        execSync(`setx NODE_EXTRA_CA_CERTS "${rootCAPath}"`, { stdio: "ignore" });
        log(`[setx] NODE_EXTRA_CA_CERTS set for current user`);
      }
    }

    let startError = null;
    if (serverProcess) {
      serverProcess.stdout.on("data", (data) => {
        process.stdout.write(data);
      });
      serverProcess.stderr.on("data", (data) => {
        const msg = data.toString().trim();
        if (msg && (IS_WIN || (!msg.includes("Password:") && !msg.includes("password for")))) {
          err(msg);
          startError = msg;
        }
      });
      serverProcess.on("exit", (code) => {
        log(`Server exited (code: ${code})`);
        serverProcess = null;
        serverPid = null;
        try { unlinkSync(PID_FILE); } catch { }
        try { unlinkSync(LOCK_FILE); } catch { }
        if (code !== 0 && !mitmIsRestarting) scheduleMitmRestart(apiKey);
      });
    }

    const health = await pollMitmHealth(8000, MITM_PORT);
    if (!health) {
      if (serverProcess && !serverProcess.killed) { try { serverProcess.kill(); } catch { } serverProcess = null; }
      const processUsing443 = await getPort443Owner();
      const portInfo = processUsing443 ? ` Port 443 already in use by ${processUsing443.name}.` : "";
      const reason = startError || `Check port 443 access.${portInfo}`;
      throw new Error(`MITM server failed to start. ${reason}`);
    }

    log(`✅ Server healthy (PID: ${serverPid || health.pid})`);

    const dnsStatus = checkAllDNSStatus();
    for (const [tool, active] of Object.entries(dnsStatus)) {
      log(`🌐 DNS ${tool}: ${active ? "✅ active" : "❌ inactive"}`);
    }

    try { unlinkSync(LOCK_FILE); } catch { }

    return { running: true, pid: serverPid };
  } catch (e) {
    try { unlinkSync(LOCK_FILE); } catch { }
    throw e;
  }
}

export async function stopServer() {
  mitmIsRestarting = true;
  mitmRestartCount = 0;
  log("⏹ Stopping server...");

  const proc = serverProcess;
  const pidToKill = proc && !proc.killed
    ? proc.pid
    : (() => { try { return parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10); } catch { return null; } })();

  if (pidToKill && isProcessAlive(pidToKill)) {
    log(`Killing server (PID: ${pidToKill})...`);
    killProcess(pidToKill, false);
    await new Promise(r => setTimeout(r, 1000));
    if (isProcessAlive(pidToKill)) killProcess(pidToKill, true);
  }
  serverProcess = null;
  serverPid = null;

  if (IS_WIN) {
    const allHosts = Object.values(TOOL_HOSTS).flat();
    try {
      const content = readFileSync(join(process.env.SystemRoot || "C:\\Windows", "System32", "drivers", "etc", "hosts"), "utf8");
      const filtered = content.split(/\r?\n/).filter(l => !allHosts.some(h => l.includes(h))).join("\r\n");
      const next = filtered.replace(/[\r\n\s]+$/g, "") + "\r\n";
      if (next !== content) writeFileSync(join(process.env.SystemRoot || "C:\\Windows", "System32", "drivers", "etc", "hosts"), next, "utf8");
      try { execSync("ipconfig /flushdns", { windowsHide: true, stdio: "ignore" }); } catch { }
      log("🌐 DNS: ✅ all tool hosts removed");
    } catch (e) { err(`Failed to clean hosts: ${e.message}`); }
  } else {
    await removeAllDNSEntries();
  }

  if (IS_MAC) {
    execSync(`launchctl unsetenv NODE_EXTRA_CA_CERTS`, { stdio: "ignore" });
    log(`[launchctl] NODE_EXTRA_CA_CERTS unset`);
  } else if (IS_WIN) {
    execSync(`reg delete HKCU\\Environment /F /V NODE_EXTRA_CA_CERTS`, { stdio: "ignore" });
    log(`[reg] NODE_EXTRA_CA_CERTS unset`);
  }

  try { unlinkSync(PID_FILE); } catch { }
  try { unlinkSync(LOCK_FILE); } catch { }
  mitmIsRestarting = false;

  return { running: false, pid: null };
}

export async function enableToolDNS(tool) {
  const status = await getMitmStatus();
  if (!status.running) throw new Error("MITM server is not running. Start the server first.");
  await addDNSEntry(tool);
  return { success: true };
}

export async function disableToolDNS(tool) {
  await removeDNSEntry(tool);
  return { success: true };
}

export async function trustCert() {
  const rootCACertPath = ROOT_CA_CERT_PATH;
  if (!existsSync(rootCACertPath)) throw new Error("Root CA not found. Start server first to generate it.");
  await installCert();
}

export async function loadAliases() {
  try {
    if (!existsSync(ALIASES_FILE)) return {};
    return JSON.parse(readFileSync(ALIASES_FILE, "utf-8"));
  } catch { return {}; }
}

export async function saveAliases(tool, mappings) {
  try {
    let current = {};
    if (existsSync(ALIASES_FILE)) {
      try { current = JSON.parse(readFileSync(ALIASES_FILE, "utf-8")); } catch { }
    }
    current[tool] = mappings || {};
    writeFileSync(ALIASES_FILE, JSON.stringify(current, null, 2));
  } catch (e) {
    err(`Failed to save aliases: ${e.message}`);
  }
}