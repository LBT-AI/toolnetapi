import { spawn, execSync } from "child_process";
import { platform } from "os";
import net from "net";

const IS_WIN = platform() === "win32";
const MITM_PORT = 443;
const MITM_WIN_NODE_PORT = 8443;

export function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EACCES";
  }
}

export function killProcess(pid, force = false) {
  if (IS_WIN) {
    const flag = force ? "/F " : "";
    try {
      execSync(`taskkill ${flag}/PID ${pid}`, { windowsHide: true, stdio: "ignore" });
    } catch { /* ignore */ }
  } else {
    const sig = force ? "SIGKILL" : "SIGTERM";
    try {
      process.kill(pid, sig);
    } catch { /* ignore */ }
  }
}

export async function getPort443Owner() {
  return new Promise((resolve) => {
    if (IS_WIN) {
      const psCmd = `powershell -NonInteractive -WindowStyle Hidden -Command "` +
        `$c = Get-NetTCPConnection -LocalPort 443 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; ` +
        `if ($c) { $c.OwningProcess } else { 0 }"`;
      try {
        const pidStr = execSync(psCmd, { encoding: "utf8", windowsHide: true }).trim();
        const pid = parseInt(pidStr, 10);
        if (pid && pid > 4) {
          const tasklistResult = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { encoding: "utf8", windowsHide: true });
          const processMatch = tasklistResult.match(/"([^"]+)"/);
          if (processMatch) {
            resolve({ pid, name: processMatch[1].replace(".exe", "") });
          } else {
            resolve({ pid, name: "unknown" });
          }
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    } else {
      try {
        const result = execSync(`lsof -nP -iTCP:443 -sTCP:LISTEN -t`, { encoding: "utf8", windowsHide: true });
        const pid = parseInt(result.trim().split("\n")[0], 10);
        if (pid && !isNaN(pid)) {
          const psOut = execSync(`ps -p ${pid} -o comm=`, { encoding: "utf8", windowsHide: true });
          resolve({ pid, name: psOut.trim() || "unknown" });
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    }
  });
}

export function checkPort443Free() {
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

export async function killPort443Owner(owner, force = false) {
  if (!owner || !owner.pid) return;
  if (IS_WIN) {
    try {
      execSync(`powershell -NonInteractive -WindowStyle Hidden -Command "Stop-Process -Id ${owner.pid} -Force -ErrorAction SilentlyContinue"`, { windowsHide: true });
    } catch { /* best effort */ }
  } else {
    try {
      process.kill(owner.pid, force ? "SIGKILL" : "SIGTERM");
    } catch { /* best effort */ }
  }
  await new Promise(r => setTimeout(r, 800));
}