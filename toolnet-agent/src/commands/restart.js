import { stop } from "./stop.js";
import { start } from "./start.js";
import { log } from "../logger.js";

export async function restart(options) {
  log("Restarting ToolNet Local Agent...");
  await stop();
  await new Promise(r => setTimeout(r, 2000));
  await start(options);
}