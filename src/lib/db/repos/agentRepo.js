import { getAdapter } from "../driver.js";
import { makeKv } from "../helpers/kvStore.js";
import crypto from "crypto";

const agentsKv = makeKv("localAgents");
const pairingCodesKv = makeKv("pairingCodes");

export async function createPairingCode(deviceInfo) {
  const code = generatePairingCode();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  const pairingData = {
    code,
    deviceInfo,
    expiresAt,
    used: false
  };
  await pairingCodesKv.set(code, pairingData);
  return { code, expiresAt };
}

function generatePairingCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
    if (i === 3) code += "-";
  }
  return code;
}

export async function verifyPairingCode(code) {
  const data = await pairingCodesKv.get(code);
  if (!data) return null;
  if (data.used) return { error: "Pairing code already used" };
  if (Date.now() > data.expiresAt) {
    await pairingCodesKv.remove(code);
    return { error: "Pairing code expired" };
  }
  return data;
}

export async function consumePairingCode(code, agentId, agentToken) {
  const data = await pairingCodesKv.get(code);
  if (!data) return { error: "Invalid pairing code" };
  if (data.used) return { error: "Pairing code already used" };
  if (Date.now() > data.expiresAt) {
    await pairingCodesKv.remove(code);
    return { error: "Pairing code expired" };
  }
  await pairingCodesKv.set(code, { ...data, used: true, agentId, agentToken });
  return { success: true };
}

export async function createAgent(agentData) {
  const id = agentData.agentId || crypto.randomUUID();
  const tokenHash = hashToken(agentData.agentToken);
  const agent = {
    id,
    name: agentData.name || agentData.deviceInfo?.hostname || "Unknown",
    platform: agentData.deviceInfo?.platform || "unknown",
    hostname: agentData.deviceInfo?.hostname || "unknown",
    version: agentData.deviceInfo?.version || "unknown",
    tokenHash,
    status: "online",
    lastSeenAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    revokedAt: null,
    metadata: agentData.metadata || {}
  };
  await agentsKv.set(id, agent);
  return agent;
}

export async function getAgent(id) {
  return await agentsKv.get(id);
}

export async function getAllAgents() {
  return await agentsKv.getAll();
}

export async function updateAgentStatus(id, status, metadata = {}) {
  const agent = await agentsKv.get(id);
  if (!agent) return null;
  const updated = {
    ...agent,
    status,
    lastSeenAt: new Date().toISOString(),
    metadata: { ...agent.metadata, ...metadata }
  };
  await agentsKv.set(id, updated);
  return updated;
}

export async function revokeAgent(id) {
  const agent = await agentsKv.get(id);
  if (!agent) return null;
  const updated = {
    ...agent,
    status: "revoked",
    revokedAt: new Date().toISOString()
  };
  await agentsKv.set(id, updated);
  return updated;
}

export async function deleteAgent(id) {
  await agentsKv.remove(id);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function verifyAgentToken(agentId, token) {
  const agent = await agentsKv.get(agentId);
  if (!agent) return false;
  if (agent.revokedAt) return false;
  return agent.tokenHash === hashToken(token);
}