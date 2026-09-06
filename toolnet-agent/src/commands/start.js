import { loadConfig } from "../config.js";
import { log, err } from "../logger.js";
import { connectToServer, disconnect } from "../control/client.js";
import { isAdmin } from "../system/admin.js";
import { platform } from "os";

let shutdownHandlersRegistered = false;

export async function start(options) {
  const config = loadConfig();

  if (!config.agentId || !config.agentToken) {
    throw new Error("Not paired. Run 'toolnet-agent pair --server <url>' first");
  }

  const IS_WIN = platform() === "win32";
  if (IS_WIN && !isAdmin()) {
    log("⚠️ Not running as Administrator — MITM may fail to bind port 443 or trust cert");
    log("   Re-run in an Administrator PowerShell for full functionality");
  }

  log("Starting ToolNet Local Agent...");

  try {
    await connectToServer(config);
    log("✅ Agent connected");

    if (!shutdownHandlersRegistered) {
      shutdownHandlersRegistered = true;
      process.on("SIGINT", async () => {
        log("Shutting down...");
        await disconnect();
        process.exit(0);
      });
      process.on("SIGTERM", async () => {
        log("Shutting down...");
        await disconnect();
        process.exit(0);
      });
    }

    if (options.foreground !== false) {
      await new Promise(() => {});
    }
  } catch (e) {
    err(`Failed to start: ${e.message}`);
    throw e;
  }
}