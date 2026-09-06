import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { platform } from "os";
import { TOOL_HOSTS } from "../../config.js";
import { log, err } from "../../logger.js";
import { runElevatedPowerShell, quotePs, isAdmin } from "../../system/admin.js";

const IS_WIN = platform() === "win32";
const IS_MAC = platform() === "darwin";
const HOSTS_FILE = IS_WIN
  ? join(process.env.SystemRoot || "C:\\Windows", "System32", "drivers", "etc", "hosts")
  : "/etc/hosts";

function normalizeHostsContent(content) {
  const eol = IS_WIN ? "\r\n" : "\n";
  return content.replace(/[\r\n\s]+$/g, "") + eol;
}

async function flushDNS() {
  if (IS_WIN) return;
  if (IS_MAC) {
    execSync("dscacheutil -flushcache && killall -HUP mDNSResponder", { stdio: "ignore" });
  } else {
    execSync("resolvectl flush-caches 2>/dev/null || true", { stdio: "ignore" });
  }
}

export function checkDNSEntry(host = null) {
  try {
    const hostsContent = readFileSync(HOSTS_FILE, "utf8");
    if (host) return hostsContent.includes(host);
    return TOOL_HOSTS.antigravity.every(h => hostsContent.includes(h));
  } catch {
    return false;
  }
}

export function checkAllDNSStatus() {
  try {
    const hostsContent = readFileSync(HOSTS_FILE, "utf8");
    const result = {};
    for (const [tool, hosts] of Object.entries(TOOL_HOSTS)) {
      result[tool] = hosts.every(h => hostsContent.includes(h));
    }
    return result;
  } catch {
    return Object.fromEntries(Object.keys(TOOL_HOSTS).map(t => [t, false]));
  }
}

function atomicWriteHostsWin(target, originalContent, newContent) {
  const tmpNew = `${target}.toolnetapi.new`;
  const tmpBak = `${target}.toolnetapi.bak`;
  try {
    writeFileSync(tmpNew, newContent, "utf8");
    try { writeFileSync(tmpBak, ""); } catch { }
    try { execSync(`move /Y "${target}" "${tmpBak}"`, { windowsHide: true }); } catch { }
    try {
      execSync(`move /Y "${tmpNew}" "${target}"`, { windowsHide: true });
    } catch (e) {
      try { execSync(`move /Y "${tmpBak}" "${target}"`, { windowsHide: true }); } catch { }
      throw e;
    }
    try { execSync(`del "${tmpBak}"`, { windowsHide: true }); } catch { }
  } finally {
    try { execSync(`del "${tmpNew}"`, { windowsHide: true }); } catch { }
  }
}

export async function addDNSEntry(tool) {
  const hosts = TOOL_HOSTS[tool];
  if (!hosts) throw new Error(`Unknown tool: ${tool}`);

  const entriesToAdd = hosts.filter(h => !checkDNSEntry(h));
  if (entriesToAdd.length === 0) {
    log(`🌐 DNS ${tool}: already active`);
    return;
  }

  try {
    if (IS_WIN) {
      const current = readFileSync(HOSTS_FILE, "utf8");
      const trimmed = current.replace(/[\r\n\s]+$/g, "");
      const toAppend = entriesToAdd.map(h => `127.0.0.1 ${h}`).join("\r\n");
      const next = `${trimmed}\r\n${toAppend}\r\n`;
      atomicWriteHostsWin(HOSTS_FILE, current, next);
      await runElevatedPowerShell("ipconfig /flushdns | Out-Null");
    } else {
      const current = readFileSync(HOSTS_FILE, "utf8");
      const trimmed = current.replace(/[\r\n\s]+$/g, "");
      const toAppend = entriesToAdd.map(h => `127.0.0.1 ${h}`).join("\n");
      const next = `${trimmed}\n${toAppend}\n`;
      const escaped = next.replace(/'/g, "'\\''");
      execSync(`printf '%s' '${escaped}' | tee ${HOSTS_FILE} > /dev/null`, { stdio: "inherit" });
      await flushDNS();
    }
    log(`🌐 DNS ${tool}: ✅ added ${entriesToAdd.join(", ")}`);
  } catch (error) {
    throw new Error(`Failed to add DNS entry: ${error.message}`);
  }
}

export async function removeDNSEntry(tool) {
  const hosts = TOOL_HOSTS[tool];
  if (!hosts) throw new Error(`Unknown tool: ${tool}`);

  const entriesToRemove = hosts.filter(h => checkDNSEntry(h));
  if (entriesToRemove.length === 0) {
    log(`🌐 DNS ${tool}: already inactive`);
    return;
  }

  try {
    if (IS_WIN) {
      const current = readFileSync(HOSTS_FILE, "utf8");
      const filtered = current.split(/\r?\n/).filter(l => !entriesToRemove.some(h => l.includes(h))).join("\r\n");
      const next = filtered.replace(/[\r\n\s]+$/g, "") + "\r\n";
      atomicWriteHostsWin(HOSTS_FILE, current, next);
      await runElevatedPowerShell("ipconfig /flushdns | Out-Null");
    } else {
      const current = readFileSync(HOSTS_FILE, "utf8");
      const filtered = current.split(/\r?\n/).filter(l => !entriesToRemove.some(h => l.includes(h))).join("\n");
      const next = filtered.replace(/[\r\n\s]+$/g, "") + "\n";
      const escaped = next.replace(/'/g, "'\\''");
      execSync(`printf '%s' '${escaped}' | tee ${HOSTS_FILE} > /dev/null`, { stdio: "inherit" });
      await flushDNS();
    }
    log(`🌐 DNS ${tool}: ✅ removed ${entriesToRemove.join(", ")}`);
  } catch (error) {
    throw new Error(`Failed to remove DNS entry: ${error.message}`);
  }
}

export async function removeAllDNSEntries() {
  for (const tool of Object.keys(TOOL_HOSTS)) {
    try {
      await removeDNSEntry(tool);
    } catch (e) {
      err(`DNS ${tool}: failed to remove — ${e.message}`);
    }
  }
}

export function removeAllDNSEntriesSync() {
  try {
    if (!existsSync(HOSTS_FILE)) return;
    const allHosts = Object.values(TOOL_HOSTS).flat();
    const content = readFileSync(HOSTS_FILE, "utf8");
    const eol = IS_WIN ? "\r\n" : "\n";
    const filtered = content.split(/\r?\n/).filter(l => !allHosts.some(h => l.includes(h))).join(eol);
    const next = filtered.replace(/[\r\n\s]+$/g, "") + eol;
    if (next === content) return;
    writeFileSync(HOSTS_FILE, next, "utf8");
    if (IS_WIN) {
      try { execSync("ipconfig /flushdns", { windowsHide: true, stdio: "ignore" }); } catch { }
    } else if (IS_MAC) {
      try { execSync("dscacheutil -flushcache && killall -HUP mDNSResponder", { stdio: "ignore" }); } catch { }
    } else {
      try { execSync("resolvectl flush-caches 2>/dev/null || true", { stdio: "ignore" }); } catch { }
    }
  } catch { /* best effort during shutdown */ }
}

export { TOOL_HOSTS };