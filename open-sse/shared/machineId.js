import nodeMachineId from "node-machine-id";
import crypto from "node:crypto";

// ESM/CJS interop: webpack may wrap the default export differently
const machineIdSync = typeof nodeMachineId?.machineIdSync === "function"
  ? nodeMachineId.machineIdSync
  : (typeof nodeMachineId?.default?.machineIdSync === "function"
    ? nodeMachineId.default.machineIdSync
    : null);

let cachedRawId = null;

function loadRawMachineId() {
  if (cachedRawId) return cachedRawId;
  try {
    if (!machineIdSync) throw new Error("machineIdSync not available");
    cachedRawId = machineIdSync();
  } catch {
    cachedRawId = crypto.randomUUID();
  }
  return cachedRawId;
}

export async function getConsistentMachineId(salt = "endpoint-proxy-salt") {
  const rawId = loadRawMachineId();
  return crypto.createHash("sha256").update(rawId + salt).digest("hex").substring(0, 16);
}
