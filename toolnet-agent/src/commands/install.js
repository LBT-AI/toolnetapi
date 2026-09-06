import { loadConfig, saveConfig, CONFIG_DIR, MITM_DIR } from "../config.js";
import { log, err } from "../logger.js";
import { generateCert } from "../mitm/cert/generate.js";
import { installCert, checkCertInstalled } from "../mitm/cert/install.js";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

export async function install() {
  log("Installing ToolNet Local Agent...");

  mkdirSync(CONFIG_DIR, { recursive: true });
  mkdirSync(MITM_DIR, { recursive: true });

  const config = loadConfig();
  if (!config.deviceName) {
    import("os").then(os => {
      config.deviceName = os.hostname();
      saveConfig(config);
    });
  }

  if (!existsSync(join(MITM_DIR, "rootCA.crt"))) {
    log("Generating Root CA...");
    await generateCert();
  }

  const trusted = await checkCertInstalled();
  if (!trusted) {
    log("Installing Root CA to system trust store...");
    try {
      await installCert();
      log("✅ Certificate installed and trusted");
    } catch (e) {
      log(`⚠️ Certificate install requires admin: ${e.message}`);
      log("Run 'toolnet-agent start' as Administrator to auto-trust");
    }
  }

  log("✅ Installation complete");
  log(`Config: ${CONFIG_DIR}`);
  log(`Run 'toolnet-agent pair --server https://api.toolnet.tech' to connect`);
}