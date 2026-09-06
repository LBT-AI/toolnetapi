import { loadConfig, saveConfig } from "../config.js";
import { log, err } from "../logger.js";
import { connectToServer } from "../control/client.js";
import { platform, hostname } from "os";

export async function pair(options) {
  const serverUrl = options.server || "https://api.toolnet.tech";

  log(`Pairing with ${serverUrl}...`);

  const config = loadConfig();
  config.serverUrl = serverUrl;

  // Request pairing code from server
  const pairRes = await fetch(`${serverUrl}/api/agents/pairing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hostname: hostname(),
      platform: platform(),
      deviceName: config.deviceName || hostname()
    })
  });

  if (!pairRes.ok) {
    const data = await pairRes.json().catch(() => ({}));
    throw new Error(data.error || `Failed to request pairing code: ${pairRes.status}`);
  }

  const { pairingCode, expiresAt } = await pairRes.json();

  log(`Pairing code: ${pairingCode}`);
  log(`Expires: ${new Date(expiresAt).toLocaleString()}`);
  log("");
  log("Enter the pairing code in the ToolNet Dashboard (MITM / Local Agents → Add Local Agent)");

  // Wait for user to enter pairing code
  process.stdin.setEncoding("utf-8");
  process.stdout.write("Pairing code: ");

  const input = await new Promise(resolve => {
    process.stdin.once("data", data => resolve(data.toString().trim()));
  });

  if (!input) {
    throw new Error("No pairing code entered");
  }

  // Submit pairing code
  const verifyRes = await fetch(`${serverUrl}/api/agents/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: input })
  });

  if (!verifyRes.ok) {
    const data = await verifyRes.json().catch(() => ({}));
    throw new Error(data.error || `Pairing failed: ${verifyRes.status}`);
  }

  const { agentId, agentToken } = await verifyRes.json();

  config.agentId = agentId;
  config.agentToken = agentToken;
  saveConfig(config);

  log("✅ Paired successfully");
  log(`Device: ${config.deviceName}`);
  log(`Agent ID: ${agentId}`);
  log("");
  log("Run 'toolnet-agent start' to begin");
}