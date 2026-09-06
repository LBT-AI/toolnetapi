import { loadConfig, saveConfig, CONFIG_DIR, MITM_DIR, LOG_DIR } from "../config.js";
import { log, err } from "../logger.js";
import { stopServer } from "../mitm/manager.js";
import { uninstallCert } from "../mitm/cert/install.js";
import { removeAllDNSEntriesSync } from "../mitm/dns/dnsConfig.js";
import { existsSync, rmSync } from "fs";

export async function uninstall(options) {
  const config = loadConfig();

  log("Uninstalling ToolNet Local Agent...");

  // Stop MITM
  try {
    await stopServer();
    log("✅ MITM server stopped");
  } catch (e) {
    log(`MITM stop: ${e.message}`);
  }

  // Remove hosts entries
  try {
    removeAllDNSEntriesSync();
    log("✅ Hosts entries removed");
  } catch (e) {
    log(`Hosts cleanup: ${e.message}`);
  }

  // Remove trusted cert if confirmed
  if (options.purge) {
    try {
      await uninstallCert();
      log("✅ Certificate uninstalled from system store");
    } catch (e) {
      log(`Certificate uninstall: ${e.message}`);
    }
  }

  // Remove config and data if --purge
  if (options.purge) {
    try {
      if (existsSync(CONFIG_DIR)) rmSync(CONFIG_DIR, { recursive: true, force: true });
      log("✅ Config directory removed");
    } catch (e) {
      err(`Failed to remove config: ${e.message}`);
    }
  } else {
    // Clear agent credentials but keep config structure
    config.agentId = null;
    config.agentToken = null;
    config.serverUrl = "https://api.toolnet.tech";
    saveConfig(config);
    log("✅ Pairing cleared (config preserved)");
  }

  log("Uninstall complete");
}