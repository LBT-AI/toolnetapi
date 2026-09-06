const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { pathToFileURL } = require("url");
const { WebSocketServer } = require("ws");
const { verifyAgentToken, updateAgentStatus } = require("./src/lib/localDb.js");

const origCreate = http.createServer.bind(http);

// Command queue for agents
const commandQueues = new Map();
const agentConnections = new Map();

function queueCommand(agentId, command, payload) {
  const commandId = crypto.randomUUID();
  const queue = commandQueues.get(agentId) || [];
  queue.push({ commandId, command, payload, timestamp: Date.now() });
  commandQueues.set(agentId, queue);
  
  // Try to send immediately if agent is connected
  const ws = agentConnections.get(agentId);
  if (ws && ws.readyState === 1) { // WebSocket.OPEN
    ws.send(JSON.stringify({ type: "command", commandId, command, payload }));
  }
  return commandId;
}

// Make queueCommand globally accessible
global.__toolnetQueueCommand = queueCommand;

// Per-process secret proving x-9r-real-ip / x-toolnet-real-ip was stamped below rather than sent by the client.
// A bare `next start` / `next dev` never loads this file, so it cannot produce a matching
// header even though the env var is inherited by child processes. Named like x-9r-cli-token
// so the request-detail header sanitizer redacts it too.
const PEER_TOKEN = crypto.randomBytes(24).toString("hex");
process.env.NINEROUTER_PEER_TOKEN = PEER_TOKEN;
process.env.TOOLNET_PEER_TOKEN = PEER_TOKEN;

let backgroundRefreshStarted = false;
let wss = null;

function startBackgroundTokenRefreshFromCustomServer() {
  if (backgroundRefreshStarted) return;
  backgroundRefreshStarted = true;
  const modPath = path.join(__dirname, "src", "sse", "services", "backgroundTokenRefresh.js");
  import(pathToFileURL(modPath).href)
    .then((m) => {
      try {
        m.startBackgroundTokenRefresh();
      } catch (e) {
        console.error("[BackgroundTokenRefresh] start failed:", e && e.message ? e.message : e);
      }
      const stop = () => {
        try {
          m.stopBackgroundTokenRefresh();
        } catch {
          /* ignore */
        }
      };
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
    })
    .catch((e) => {
      if (process.env.DEBUG_BACKGROUND_TOKEN_REFRESH) {
        console.error("[BackgroundTokenRefresh] import failed:", e && e.message ? e.message : e);
      }
    });
}

// Create a function to handle WebSocket upgrade
function handleWebSocketUpgrade(req, socket, head) {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  if (url.pathname !== "/api/agents/connect") return false;

  const authHeader = req.headers.authorization || "";
  const agentIdHeader = req.headers["x-toolnet-agent-id"] || "";

  if (!authHeader.startsWith("Bearer ") || !agentIdHeader) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return true;
  }

  const agentToken = authHeader.slice(7);
  const agentId = agentIdHeader;

  // We can't await here in sync context, so we'll do a quick sync check or defer
  // For now, accept the connection and verify in the WebSocket handler
  return false; // Let the WebSocketServer handle it
}

// Wrap Next standalone HTTP server: derive client IP from the TCP socket
// (unspoofable) and strip client-supplied forwarding headers so downstream
// rate-limiting keys on the real peer address instead of attacker-controlled XFF.
http.createServer = (...args) => {
  const handler = args.find((a) => typeof a === "function");
  const rest = args.filter((a) => typeof a !== "function");
  if (!handler) return origCreate(...args);
  const wrapped = (req, res) => {
    const socketIp = req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : "";
    const xff = req.headers["x-forwarded-for"];
    const xRealIp = req.headers["x-real-ip"];
    const viaProxy = !!(xff || xRealIp);
    const isLoopbackProxy = socketIp === "127.0.0.1" || socketIp === "::1" || socketIp === "::ffff:127.0.0.1";
    const proxyIp = xRealIp || (xff ? String(xff).split(",")[0].trim() : "");
    const ip = isLoopbackProxy && proxyIp ? proxyIp : socketIp;
    delete req.headers["x-9r-real-ip"];
    delete req.headers["x-forwarded-for"];
    delete req.headers["x-9r-via-proxy"];
    delete req.headers["x-9r-peer-token"];
    delete req.headers["x-toolnet-real-ip"];
    delete req.headers["x-toolnet-via-proxy"];
    delete req.headers["x-toolnet-peer-token"];
    req.headers["x-9r-real-ip"] = ip;
    req.headers["x-9r-peer-token"] = PEER_TOKEN;
    req.headers["x-toolnet-real-ip"] = ip;
    req.headers["x-toolnet-peer-token"] = PEER_TOKEN;
    if (viaProxy) {
      req.headers["x-9r-via-proxy"] = "1";
      req.headers["x-toolnet-via-proxy"] = "1";
    }
    return handler(req, res);
  };
  const server = origCreate(...rest, wrapped);
  server.once("listening", () => {
    startBackgroundTokenRefreshFromCustomServer();

    // Initialize WebSocket server for agent connections
    if (!wss) {
      wss = new WebSocketServer({ noServer: true });
      wss.on("connection", async (ws, req) => {
        const url = new URL(req.url || "", `http://${req.headers.host}`);
        if (url.pathname !== "/api/agents/connect") {
          ws.close(4004, "Invalid path");
          return;
        }

        const authHeader = req.headers.authorization || "";
        const agentIdHeader = req.headers["x-toolnet-agent-id"] || "";

        if (!authHeader.startsWith("Bearer ") || !agentIdHeader) {
          ws.close(4001, "Unauthorized");
          return;
        }

        const agentToken = authHeader.slice(7);
        const agentId = agentIdHeader;

        try {
          const valid = await verifyAgentToken(agentId, agentToken);
          if (!valid) {
            ws.close(4001, "Invalid agent token");
            return;
          }

          await updateAgentStatus(agentId, "online");
          ws.agentId = agentId;

          ws.on("message", async (data) => {
            try {
              const msg = JSON.parse(data.toString());
              if (msg.type === "state") {
                await updateAgentStatus(agentId, "online", {
                  mitmRunning: msg.mitmRunning,
                  certExists: msg.certExists,
                  certTrusted: msg.certTrusted,
                  enabledTools: msg.enabledTools,
                  hostname: msg.hostname,
                  platform: msg.platform,
                  version: msg.version
                });
              } else if (msg.type === "response") {
                // Handle command response from agent
                console.log(`[Agent ${agentId}] Command response:`, msg.commandId, msg.success);
              }
            } catch (e) {
              console.error("[Agent WS] Message error:", e.message);
            }
          });

          ws.on("close", async () => {
            await updateAgentStatus(agentId, "offline");
          });

          ws.on("error", (e) => {
            console.error("[Agent WS] Error:", e.message);
          });

          // Register connection
          agentConnections.set(agentId, ws);
          ws.on("close", async () => {
            agentConnections.delete(agentId);
            await updateAgentStatus(agentId, "offline");
          });

          // Send any queued commands
          const queue = commandQueues.get(agentId) || [];
          for (const cmd of queue) {
            if (ws.readyState === 1) {
              ws.send(JSON.stringify({ type: "command", ...cmd }));
            }
          }
          // Clear queue after sending
          commandQueues.delete(agentId);

          ws.send(JSON.stringify({ type: "welcome", agentId }));
        } catch (e) {
          console.error("[Agent WS] Auth error:", e.message);
          ws.close(4001, "Authentication failed");
        }
      });

      server.on("upgrade", (req, socket, head) => {
        const url = new URL(req.url || "", `http://${req.headers.host}`);
        if (url.pathname === "/api/agents/connect") {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req);
          });
        }
      });
    }
  });
  const origEmit = server.emit;
  server.emit = function (event, ...eventArgs) {
    const [req, socket, head] = eventArgs;
    if (event !== "upgrade" || String(req.headers.upgrade || "").toLowerCase() !== "h2c") {
      return origEmit.call(this, event, ...eventArgs);
    }

    const contentLength = Number(req.headers["content-length"] || 0);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      socket.destroy();
      return true;
    }
    const chunks = [head];
    let received = head.length;
    const serve = () => {
      const replay = new http.IncomingMessage(socket);
      Object.assign(replay, { method: req.method, url: req.url, headers: req.headers, complete: true });
      if (received) replay.push(Buffer.concat(chunks, received).subarray(0, contentLength));
      replay.push(null);
      const res = new http.ServerResponse(replay);
      res.shouldKeepAlive = false;
      res.assignSocket(socket);
      res.once("finish", () => socket.end());
      Promise.resolve().then(() => wrapped(replay, res)).catch((error) => {
        console.error("Failed to downgrade h2c request", error);
        socket.destroy();
      });
    };
    if (received >= contentLength) serve();
    else {
      socket.on("data", function readBody(chunk) {
        chunks.push(chunk);
        received += chunk.length;
        if (received < contentLength) return;
        socket.off("data", readBody);
        serve();
      });
      socket.resume();
    }
    delete req.headers.upgrade;
    delete req.headers["http2-settings"];
    req.headers.connection = "close";
    return true;
  };
  return server;
};

if (require.main === module) {
  const standalone = path.join(__dirname, "server.js");
  if (fs.existsSync(standalone)) {
    require(standalone);
  } else {
    // Repo checkout has no standalone build next to us. `next start` builds its HTTP
    // server in-process, so the wrapper above still sanitizes every request.
    const nextBin = require.resolve("next/dist/bin/next");
    process.argv = [process.argv[0], nextBin, "start", ...process.argv.slice(2)];
    require(nextBin);
  }
}