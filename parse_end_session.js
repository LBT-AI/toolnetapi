import { FreebuffTerminalParser } from "./open-sse/services/freebuff/terminalParser.js";
import fs from "fs";

async function main() {
  const parser = new FreebuffTerminalParser();
  const output = fs.readFileSync("test_end_session_output.log", "utf8");
  
  await new Promise(resolve => parser.term.write(output, resolve));

  const lines = parser.getLines();
  console.log("State:", parser.getState());
  console.log("Last 20 lines:");
  console.log(lines.slice(-20).join("\n"));
}
main();
