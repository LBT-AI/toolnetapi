import WebSocket from "ws";
import { loadConfig, saveConfig } from "../config.js";
import { log, err } from "../logger.js";
import { getMitmStatus, startServer, stopServer, enableToolDNS, disableToolDNS, trustCert, loadAliases, saveAliases } from "../mitm/manager.js";
import { platform, hostname, version as nodeVersion } from "os";

let ws = null;
let reconnectTimer = null;
let heartbeatTimer = null;
let commandHandlers = new Map();
let pendingCommands = new Map();
let agentId = null;
let agentToken = null;
let serverUrl = null;

export async function connectToServer(config) {
  serverUrl = config.serverUrl;
  agentId = config.agentId;
  agentToken = config.agentToken;

  const wsUrl = serverUrl.replace("https://", "wss://").replace("http://", "ws://") + "/api/agents/connect";

  return new Promise((resolve, reject) => {
    ws = new WebSocket(wsUrl, {
      headers: {
        "Authorization": `Bearer ${agentToken}`,
        "X-ToolNet-Agent-Id": agentId
      }
    });

    ws.on("open", () => {
      log(`Connected to ${serverUrl}`);
      sendStateSnapshot();
      startHeartbeat();
      resolve();
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleServerMessage(msg);
      } catch (e) {
        err(`Failed to parse server message: ${e.message}`);
      }
    });

    ws.on("close", () => {
      log("Disconnected from server");
      stopHeartbeat();
      scheduleReconnect(config);
    });

    ws.on("error", (e) => {
      err(`WebSocket error: ${e.message}`);
      if (ws.readyState === WebSocket.CONNECTING) {
        reject(e);
      }
    });
  });
}

function scheduleReconnect(config) {
  const delays = [1000, 2000, 5000, 10000, 30000];
  let attempt = 0;

  const tryConnect = () => {
    const delay = delays[Math.min(attempt, delays.length - 1)];
    attempt++;
    log(`Reconnecting in ${delay}ms... (attempt ${attempt})`);
    reconnectTimer = setTimeout(() => {
      connectToServer(config).catch(() => tryConnect());
    }, delay);
  };

  tryConnect();
}

function startHeartbeat() {
  heartbeatTimer = setInterval(() => {
    sendStateSnapshot();
  }, 15000);
}

function stopHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

async function sendStateSnapshot() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const status = await getMitmStatus();
  const config = loadConfig();

  const snapshot = {
    type: "state",
    agentId,
    hostname: hostname(),
    platform: platform(),
    version: nodeVersion(),
    mitmRunning: status.running,
    certExists: status.certExists,
    certTrusted: status.certTrusted,
    enabledTools: config.enabledTools,
    lastError: null
  };

  ws.send(JSON.stringify(snapshot));
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case "command":
      handleCommand(msg);
      break;
    case "pong":
      break;
    default:
      log(`Unknown message type: ${msg.type}`);
  }
}

async function handleCommand(msg) {
  const { commandId, command, payload } = msg;

  log(`Received command: ${command} (${commandId})`);

  if (pendingCommands.has(commandId)) {
    log(`Duplicate command ID: ${commandId}, ignoring`);
    sendResponse(commandId, true, { duplicate: true });
    return;
  }

  pendingCommands.set(commandId, true);

  try {
    let result = null;

    switch (command) {
      case "START_MITM":
        result = await startServer(payload.apiKey, payload.forceKillPort443);
        break;
      case "STOP_MITM":
        result = await stopServer();
        break;
      case "ENABLE_TOOL":
        result = await enableToolDNS(payload.tool);
        break;
      case "DISABLE_TOOL":
        result = await disableToolDNS(payload.tool);
        break;
      case "TRUST_CERT":
        result = await trustCert();
        break;
      case "RESTART":
        await stopServer();
        result = await startServer(payload.apiKey, payload.forceKillPort443);
        break;
      case "STATUS":
        result = await getMitmStatus();
        break;
      case "GET_ALIASES":
        result = await loadAliases();
        break;
      case "SET_ALIASES":
        await saveAliases(payload.tool, payload.mappings);
        result = { success: true };
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }

    sendResponse(commandId, true, result);
  } catch (e) {
    err(`Command ${command} failed: ${e.message}`);
    sendResponse(commandId, false, { error: e.message });
  } finally {
    pendingCommands.delete(commandId);
  }
}

function sendResponse(commandId, success, result) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  ws.send(JSON.stringify({
    type: "response",
    commandId,
    success,
    result
  }));
}

export function disconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  stopHeartbeat();
  if (ws) {
    ws.close();
    ws = null;
  }
}

export function isConnected() {
  return ws && ws.readyState === WebSocket.OPEN;
}