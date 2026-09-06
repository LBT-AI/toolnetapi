import { FreebuffTerminalParser } from "./open-sse/services/freebuff/terminalParser.js";
import fs from "fs";

async function main() {
  const parser = new FreebuffTerminalParser();
  const output = fs.readFileSync("test_cli_normal.log", "utf8");
  
  await new Promise(resolve => parser.term.write(output, resolve));

  const lines = parser.getLines();
  console.log("Total lines:", lines.length);
  console.log("Non-empty lines:");
  lines.forEach((l, i) => { if (l.trim()) console.log(i, l); });
  console.log("State:", parser.getState());
}
main();
