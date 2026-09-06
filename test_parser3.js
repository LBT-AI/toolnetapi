import { TerminalOutputCollector } from "./open-sse/services/freebuff/terminalParser.js";

const lines_before = [
  "   [07:22 AM]",
  "   Reply exactly TOOLNET_FREEBUFF_OK",
];

const lines_after = [
  "   [07:22 AM]",
  "   Reply exactly TOOLNET_FREEBUFF_OK ⎘",
  " Solar Pro 4 · 56m left                                                                                  ✕ End session",
];

let parserMock = { getLines: () => lines_before };
const collector = new TerminalOutputCollector(parserMock);
collector.start(" Reply exactly TOOLNET_FREEBUFF_OK");

collector.processChunk(); 
collector.markPromptBoundary(false);

parserMock.getLines = () => lines_after;
collector.processChunk();

const extracted = collector.stop();
console.log("EXTRACTED:", JSON.stringify(extracted));
