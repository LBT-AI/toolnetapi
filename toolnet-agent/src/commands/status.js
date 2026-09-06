import { loadConfig } from "../config.js";
import { log, err } from "../logger.js";
import { connectToServer, disconnect, isConnected } from "../control/client.js";
import { getMitmStatus } from "../mitm/manager.js";
import { platform, hostname, version as nodeVersion } from "os";

export async function status() {
  const config = loadConfig();

  log("ToolNet Local Agent Status");
  log("==========================");
  log(`Device: ${config.deviceName || hostname()}`);
  log(`Platform: ${platform()} ${nodeVersion()}`);
  log(`Config: ${config.serverUrl}`);
  log(`Agent ID: ${config.agentId || "not paired"}`);

  if (config.agentId && config.agentToken) {
    try {
      await connectToServer(config);
      log(`Server: Connected`);

      const mitmStatus = await getMitmStatus();
      log(`MITM Server: ${mitmStatus.running ? "Running" : "Stopped"}`);
      if (mitmStatus.running) log(`  PID: ${mitmStatus.pid}`);
      log(`Certificate: ${mitmStatus.certExists ? "Generated" : "Missing"}`);
      log(`Certificate Trusted: ${mitmStatus.certTrusted ? "Yes" : "No"}`);
      log("DNS Status:");
      for (const [tool, active] of Object.entries(mitmStatus.dnsStatus || {})) {
        log(`  ${tool}: ${active ? "Active" : "Inactive"}`);
      }

      await disconnect();
    } catch (e) {
      log(`Server: Disconnected (${e.message})`);
    }
  } else {
    log("Server: Not paired");
  }
}