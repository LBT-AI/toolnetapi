import { execSync } from "child_process";
import { platform } from "os";

const IS_WIN = platform() === "win32";

export function isAdmin() {
  if (IS_WIN) {
    try {
      execSync("net session >nul 2>&1", { windowsHide: true, stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }
  return typeof process.getuid === "function" && process.getuid() === 0;
}

export function quotePs(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export async function runElevatedPowerShell(script) {
  if (!IS_WIN) throw new Error("Windows-only");

  const encoded = Buffer.from(script, "utf16le").toString("base64");

  if (isAdmin()) {
    return new Promise((resolve, reject) => {
      execSync(
        `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
        { windowsHide: true, stdio: "ignore" }
      );
      resolve();
    });
  }

  const wrapper = `
    $proc = Start-Process powershell -ArgumentList @(
      '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
      '-WindowStyle','Hidden','-EncodedCommand','${encoded}'
    ) -Verb RunAs -Wait -PassThru -WindowStyle Hidden;
    if ($proc.ExitCode -ne 0) { throw "Elevated command exited with code $($proc.ExitCode)" }
  `;

  return new Promise((resolve, reject) => {
    try {
      execSync(
        `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command ${quotePs(wrapper)}`,
        { windowsHide: true, stdio: "ignore" }
      );
      resolve();
    } catch (e) {
      const msg = e.stderr?.toString() || e.message || "";
      if (msg.includes("canceled by the user") || msg.includes("operation was canceled")) {
        reject(new Error("User canceled UAC prompt"));
      } else {
        reject(new Error(msg));
      }
    }
  });
}