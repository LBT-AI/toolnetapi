import { loadConfig } from "../config.js";
import { log, err } from "../logger.js";
import { isAdmin } from "../system/admin.js";
import { checkPort443Free, getPort443Owner } from "../system/process.js";
import { checkCertInstalled } from "../mitm/cert/install.js";
import { ROOT_CA_CERT_PATH } from "../mitm/cert/rootCA.js";
import { checkAllDNSStatus, TOOL_HOSTS } from "../mitm/dns/dnsConfig.js";
import { existsSync } from "fs";
import { join } from "path";
import { platform, hostname } from "os";

const IS_WIN = platform() === "win32";

function pass(msg) { log(`  ✅ PASS: ${msg}`); }
function warn(msg) { log(`  ⚠️  WARN: ${msg}`); }
function fail(msg) { log(`  ❌ FAIL: ${msg}`); }

export async function doctor() {
  const config = loadConfig();

  log("ToolNet Local Agent Diagnostics");
  log("===============================");
  log("");

  // OS supported
  if (IS_WIN) pass("Windows 10/11 supported");
  else warn("Non-Windows platform — limited support in Phase 1");

  // Admin status
  if (IS_WIN) {
    if (isAdmin()) pass("Running as Administrator");
    else warn("Not running as Administrator — MITM may fail");
  }

  // Server reachable
  if (config.serverUrl) {
    try {
      const res = await fetch(`${config.serverUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) pass(`Server reachable: ${config.serverUrl}`);
      else warn(`Server returned ${res.status}: ${config.serverUrl}`);
    } catch (e) {
      fail(`Server unreachable: ${config.serverUrl} (${e.message})`);
    }
  } else {
    fail("No server URL configured");
  }

  // Pairing state
  if (config.agentId && config.agentToken) {
    pass("Agent paired");
    log(`  Agent ID: ${config.agentId}`);
    log(`  Device: ${config.deviceName || hostname()}`);
  } else {
    fail("Agent not paired — run 'toolnet-agent pair'");
  }

  // Port 443
  const portStatus = await checkPort443Free();
  if (portStatus === "free") pass("Port 443 is free");
  else if (portStatus === "in-use") {
    const owner = await getPort443Owner();
    fail(`Port 443 in use by ${owner?.name || "unknown"} (PID ${owner?.pid || "?"})`);
  } else {
    warn("Cannot check port 443 (permission)");
  }

  // Cert exists
  if (existsSync(ROOT_CA_CERT_PATH)) pass("Root CA certificate exists");
  else fail("Root CA certificate missing — run 'toolnet-agent install'");

  // Cert trusted
  const trusted = await checkCertInstalled();
  if (trusted) pass("Certificate trusted in system store");
  else warn("Certificate NOT trusted — run as Administrator to trust");

  // Hosts writable
  const allHosts = Object.values(TOOL_HOSTS).flat();
  let hostsWritable = true;
  try {
    const { readFileSync } = await import("fs");
    readFileSync(IS_WIN 
      ? join(process.env.SystemRoot || "C:\\Windows", "System32", "drivers", "etc", "hosts")
      : "/etc/hosts", "utf8");
  } catch {
    hostsWritable = false;
  }
  if (hostsWritable) pass("Hosts file readable");
  else fail("Hosts file not readable — need admin/root");

  // DNS state
  const dnsStatus = checkAllDNSStatus();
  for (const [tool, active] of Object.entries(dnsStatus)) {
    if (active) pass(`DNS ${tool}: active`);
    else log(`  DNS ${tool}: inactive`);
  }

  // MITM process
  const { getMitmStatus } = await import("../mitm/manager.js");
  const mitmStatus = await getMitmStatus();
  if (mitmStatus.running) pass(`MITM server running (PID ${mitmStatus.pid})`);
  else log("  MITM server: stopped");

  log("");
  log("Run 'toolnet-agent start' to begin");
}