import { TerminalOutputCollector } from "./open-sse/services/freebuff/terminalParser.js";

const lines = [
  "   [07:22 AM]",
  "   Reply exactly TOOLNET_FREEBUFF_OK ⎘",
  " Solar Pro 4 · 56m left                                                                                  ✕ End session",
];

const parserMock = { getLines: () => lines };
const collector = new TerminalOutputCollector(parserMock);
collector.start(" Reply exactly TOOLNET_FREEBUFF_OK");
collector.markPromptBoundary(false);
collector.collectedLines.push(...lines);

const extracted = collector.stop();
console.log("EXTRACTED:", JSON.stringify(extracted));
