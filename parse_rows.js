import { FreebuffTerminalParser } from "./open-sse/services/freebuff/terminalParser.js";
import fs from "fs";

async function main() {
  const parser = new FreebuffTerminalParser({ cols: 120, rows: 5000 });
  const output = fs.readFileSync("test_rows.log", "utf8");
  await new Promise(resolve => parser.term.write(output, resolve));
  const lines = parser.getLines();
  console.log("Lines full:", lines.length);
  const nonEmpty = lines.filter(l => l.trim().length > 0);
  console.log("Non empty lines:", nonEmpty.length);
  fs.writeFileSync("lines_rows.txt", nonEmpty.join("\n"));
}
main();
