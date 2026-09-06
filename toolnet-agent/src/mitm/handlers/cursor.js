import { err } from "../../logger.js";
import { fetchRouter, pipeSSE } from "./base.js";

async function intercept(req, res, bodyBuffer, mappedModel, passthrough) {
  try {
    // Cursor uses binary protobuf - delegate to passthrough for now
    // Full protobuf handling would require more complex implementation
    return passthrough(req, res, bodyBuffer);
  } catch (error) {
    err(`[cursor] ${error.message}`);
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: error.message, type: "mitm_error" } }));
  }
}

export { intercept };