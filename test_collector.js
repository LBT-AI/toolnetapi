import { TerminalOutputCollector } from './open-sse/services/freebuff/terminalParser.js';

const mockParser = {
  getLines: () => ["Assistant: Sure, here is the complete and fully functional code you requested: ⎘", "TOOLNET_FREEBUFF_OK", " Solar Pro 4 · 1h left                                                                                   ✕ End session"]
};

const collector = new TerminalOutputCollector(mockParser);
collector.collectedLines = [];
collector.collectedLines.push("Assistant: Sure, here is the complete and fully functional code you requested: ⎘");
collector.collectedLines.push("TOOLNET_FREEBUFF_OK");
collector.collectedLines.push(" Solar Pro 4 · 1h left                                                                                   ✕ End session");

console.log("FINAL:", collector.stop());
