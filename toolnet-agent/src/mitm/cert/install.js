import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { platform } from "os";
import { createHash } from "crypto";
import { ROOT_CA_CERT_PATH, ROOT_CA_CN } from "./rootCA.js";
import { log, err } from "../../logger.js";

const IS_WIN = platform() === "win32";
const IS_MAC = platform() === "darwin";

const LINUX_CERT_PATHS = [
  { dir: "/usr/local/share/ca-certificates", cmd: "update-ca-certificates" },
  { dir: "/etc/ca-certificates/trust-source/anchors", cmd: "update-ca-trust" },
  { dir: "/etc/pki/ca-trust/source/anchors", cmd: "update-ca-trust" },
  { dir: "/etc/pki/trust/anchors", cmd: "update-ca-certificates" }
];

function getLinuxCertConfig() {
  for (const config of LINUX_CERT_PATHS) {
    if (existsSync(config.dir)) return config;
  }
  return LINUX_CERT_PATHS[0];
}

export async function checkCertInstalled() {
  if (IS_WIN) return checkCertInstalledWindows();
  if (IS_MAC) return checkCertInstalledMac();
  return checkCertInstalledLinux();
}

function checkCertInstalledMac() {
  return new Promise((resolve) => {
    try {
      const fingerprint = getCertFingerprint(ROOT_CA_CERT_PATH).replace(/:/g, "");
      execSync(`security find-certificate -a -c "${ROOT_CA_CN}" -Z /Library/Keychains/System.keychain 2>/dev/null`, { windowsHide: true, stdio: "pipe" }, (error, stdout) => {
        if (error || !stdout) return resolve(false);
        const match = new RegExp(`SHA-1 hash:\\s*${fingerprint}`, "i").test(stdout.toString());
        if (!match) return resolve(false);
        execSync(`security verify-cert -c "${ROOT_CA_CERT_PATH}" -p ssl -k /Library/Keychains/System.keychain 2>/dev/null`, { windowsHide: true, stdio: "ignore" }, (err2) => {
          resolve(!err2);
        });
      });
    } catch {
      resolve(false);
    }
  });
}

function checkCertInstalledWindows() {
  return new Promise((resolve) => {
    try {
      const fingerprint = getCertFingerprint(ROOT_CA_CERT_PATH).replace(/:/g, "");
      execSync(`certutil -store Root ${fingerprint}`, { windowsHide: true, stdio: "ignore" });
      resolve(true);
    } catch {
      resolve(false);
    }
  });
}

function checkCertInstalledLinux() {
  const config = getLinuxCertConfig();
  const certFile = `${config.dir}/toolnetapi-root-ca.crt`;
  return Promise.resolve(existsSync(certFile));
}

export async function installCert() {
  if (!existsSync(ROOT_CA_CERT_PATH)) throw new Error(`Certificate file not found: ${ROOT_CA_CERT_PATH}`);

  const isInstalled = await checkCertInstalled();
  if (isInstalled) {
    log("🔐 Cert: already trusted ✅");
    return;
  }

  if (IS_WIN) await installCertWindows();
  else if (IS_MAC) await installCertMac();
  else await installCertLinux();
}

async function installCertMac() {
  const deleteOld = `security delete-certificate -c "${ROOT_CA_CN}" /Library/Keychains/System.keychain 2>/dev/null || true`;
  const install = `security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${ROOT_CA_CERT_PATH}"`;
  try {
    execSync(`${deleteOld} && ${install}`, { stdio: "inherit" });
    log("🔐 Cert: ✅ installed to system keychain");
  } catch (e) {
    throw new Error(e.message?.includes("canceled") ? "User canceled authorization" : "Certificate install failed");
  }
}

async function installCertWindows() {
  const script = `
    certutil -delstore Root "${ROOT_CA_CN}" 2>$null | Out-Null
    $exit = & certutil -addstore Root "${ROOT_CA_CERT_PATH}" 2>&1
    if ($LASTEXITCODE -ne 0) { throw "certutil exit $LASTEXITCODE" }
  `;
  try {
    execSync(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${script.replace(/"/g, '\\"')}"`, { stdio: "inherit" });
    log("🔐 Cert: ✅ installed to Windows Root store");
  } catch (e) {
    throw new Error(`Failed to install certificate: ${e.message}`);
  }
}

async function installCertLinux() {
  const config = getLinuxCertConfig();
  const destFile = `${config.dir}/toolnetapi-root-ca.crt`;

  try {
    mkdirSync(config.dir, { recursive: true });
    execSync(`cp "${ROOT_CA_CERT_PATH}" "${destFile}" && (${config.cmd} 2>/dev/null || true)`, { stdio: "inherit" });
    await updateNssDatabases("add");
    log(`🔐 Cert: ✅ installed to Linux trust store (${config.dir}) and user browser databases`);
  } catch (e) {
    throw new Error(`Certificate install failed: ${e.message}`);
  }
}

async function updateNssDatabases(action = "add") {
  const certName = "ToolNet API MITM Root CA";

  const script = `
    if ! command -v certutil &> /dev/null; then exit 0; fi
    DIRS="$HOME/.pki/nssdb $HOME/snap/chromium/current/.pki/nssdb"
    if [ -d "$HOME/.mozilla/firefox" ]; then
      for profile in "$HOME"/.mozilla/firefox/*/; do
        if [ -f "${profile}cert9.db" ] || [ -f "${profile}cert8.db" ]; then DIRS="$DIRS $profile"; fi
      done
    fi
    if [ -d "$HOME/snap/firefox/common/.mozilla/firefox" ]; then
      for profile in "$HOME"/snap/firefox/common/.mozilla/firefox/*/; do
        if [ -f "${profile}cert9.db" ] || [ -f "${profile}cert8.db" ]; then DIRS="$DIRS $profile"; fi
      done
    fi
    for db in $DIRS; do
      if [ -d "$db" ]; then
        if [ "${action}" = "add" ]; then
          certutil -d sql:"$db" -A -t "C,," -n "${certName}" -i "${ROOT_CA_CERT_PATH}" 2>/dev/null || certutil -d "$db" -A -t "C,," -n "${certName}" -i "${ROOT_CA_CERT_PATH}" 2>/dev/null || true
        else
          certutil -d sql:"$db" -D -n "${certName}" 2>/dev/null || certutil -d "$db" -D -n "${certName}" 2>/dev/null || true
        fi
      fi
    done
  `;

  try {
    execSync(script, { shell: "/bin/bash", stdio: "ignore" });
  } catch { /* ignore */ }
}

export async function uninstallCert() {
  const isInstalled = await checkCertInstalled();
  if (!isInstalled) {
    log("🔐 Cert: not found in system store");
    return;
  }

  if (IS_WIN) await uninstallCertWindows();
  else if (IS_MAC) await uninstallCertMac();
  else await uninstallCertLinux();
}

async function uninstallCertMac() {
  const fingerprint = getCertFingerprint(ROOT_CA_CERT_PATH).replace(/:/g, "");
  const command = `security delete-certificate -Z "${fingerprint}" /Library/Keychains/System.keychain`;
  try {
    execSync(command, { stdio: "inherit" });
    log("🔐 Cert: ✅ uninstalled from system keychain");
  } catch {
    throw new Error("Failed to uninstall certificate");
  }
}

async function uninstallCertWindows() {
  const script = `certutil -delstore Root "${ROOT_CA_CN}"`;
  try {
    execSync(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${script.replace(/"/g, '\\"')}"`, { stdio: "inherit" });
    log("🔐 Cert: ✅ uninstalled from Windows Root store");
  } catch (e) {
    throw new Error(`Failed to uninstall certificate: ${e.message}`);
  }
}

async function uninstallCertLinux() {
  await updateNssDatabases("delete");

  const config = getLinuxCertConfig();
  const destFile = `${config.dir}/toolnetapi-root-ca.crt`;
  try {
    execSync(`rm -f "${destFile}" && (${config.cmd} 2>/dev/null || true)`, { stdio: "inherit" });
    log("🔐 Cert: ✅ uninstalled from Linux trust store and user browser databases");
  } catch {
    throw new Error("Failed to uninstall certificate");
  }
}

function getCertFingerprint(certPath) {
  const pem = readFileSync(certPath, "utf-8");
  const der = Buffer.from(pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, ""), "base64");
  return createHash("sha1").update(der).digest("hex").toUpperCase().match(/.{2}/g).join(":");
}