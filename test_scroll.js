import { FreebuffTerminalParser } from "./open-sse/services/freebuff/terminalParser.js";
import fs from "fs";

async function main() {
  const parser = new FreebuffTerminalParser();
  const output = fs.readFileSync("test_cli_normal.log", "utf8");
  
  // write half
  await new Promise(resolve => parser.term.write(output.slice(0, output.length/2), resolve));
  console.log("Lines half:", parser.getLines().length);
  
  // write full
  await new Promise(resolve => parser.term.write(output.slice(output.length/2), resolve));
  console.log("Lines full:", parser.getLines().length);
}
main();
