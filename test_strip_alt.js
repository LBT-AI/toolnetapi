import { FreebuffTerminalParser } from "./open-sse/services/freebuff/terminalParser.js";
import fs from "fs";

async function main() {
  const parser = new FreebuffTerminalParser();
  let output = fs.readFileSync("test_long.log", "utf8");
  
  // Strip Alt Buffer Enter/Exit
  output = output.replace(/\x1b\[\?1049[hl]/g, "");
  
  await new Promise(resolve => parser.term.write(output, resolve));
  
  const lines = parser.getLines();
  console.log("Lines full:", lines.length);
  fs.writeFileSync("lines_stripped.txt", lines.join("\n"));
}
main();
