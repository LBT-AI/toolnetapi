import { LOG_DIR } from "./config.js";
import { existsSync, mkdirSync, appendFileSync } from "fs";

function time() {
  return new Date().toISOString();
}

function format(level, msg) {
  return `[${time()}] [${level}] ${msg}`;
}

export function log(msg) {
  const line = format("INFO", msg);
  console.log(line);
  writeToFile(line);
}

export function warn(msg) {
  const line = format("WARN", msg);
  console.warn(line);
  writeToFile(line);
}

export function err(msg) {
  const line = format("ERROR", msg);
  console.error(line);
  writeToFile(line);
}

function writeToFile(line) {
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    const date = new Date().toISOString().split("T")[0];
    const logFile = `${LOG_DIR}/agent-${date}.log`;
    appendFileSync(logFile, line + "\n");
  } catch { /* ignore */ }
}