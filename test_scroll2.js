import { FreebuffTerminalParser } from "./open-sse/services/freebuff/terminalParser.js";
import fs from "fs";

async function main() {
  const parser = new FreebuffTerminalParser();
  const output = fs.readFileSync("test_ext_output.log", "utf8");
  await new Promise(resolve => parser.term.write(output, resolve));
  console.log("Lines full:", parser.getLines().length);
}
main();
