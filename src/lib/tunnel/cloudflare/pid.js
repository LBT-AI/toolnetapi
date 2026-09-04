import fs from "fs";
import path from "path";
import { TUNNEL_DIR, ensureTunnelDir } from "../shared/state.js";

const PID_FILE = path.join(TUNNEL_DIR, "cloudflared.pid");

export function savePid(pid) {
  ensureTunnelDir();
  fs.writeFileSync(PID_FILE, pid.toString());
}

export function loadPid() {
  try {
    if (fs.existsSync(PID_FILE)) return parseInt(fs.readFileSync(PID_FILE, "utf8"));
  } catch { /* ignore */ }
  return null;
}

export function clearPid(expectedPid) {
  try {
    if (!fs.existsSync(PID_FILE)) return;
    if (expectedPid !== undefined) {
      const current = loadPid();
      if (current !== expectedPid) return; // old child must not clear successor PID
    }
    fs.unlinkSync(PID_FILE);
  } catch { /* ignore */ }
}
