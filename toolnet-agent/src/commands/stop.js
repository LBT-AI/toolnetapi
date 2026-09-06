import { loadConfig } from "../config.js";
import { log, err } from "../logger.js";
import { connectToServer, disconnect } from "../control/client.js";
import { stopServer } from "../mitm/manager.js";

export async function stop() {
  const config = loadConfig();

  if (!config.agentId || !config.agentToken) {
    throw new Error("Not paired. Run 'toolnet-agent pair --server <url>' first");
  }

  log("Stopping ToolNet Local Agent...");

  try {
    await connectToServer(config);
    log("Connected, sending stop command...");

    // The stop will happen via the server sending STOP_MITM command
    // Or we can stop locally
    await stopServer();
    await disconnect();

    log("✅ Agent stopped");
  } catch (e) {
    err(`Failed to stop: ${e.message}`);
    throw e;
  }
}