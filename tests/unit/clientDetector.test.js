import { describe, it, expect } from "vitest";
import { detectClientTool, isNativePassthrough } from "../../open-sse/utils/clientDetector.js";

describe("clientDetector", () => {
  it("detects codex tool from various user-agent strings", () => {
    expect(detectClientTool({ "user-agent": "codex-tui/0.1.0" })).toBe("codex");
    expect(detectClientTool({ "user-agent": "codex-cli/1.2.3" })).toBe("codex");
    expect(detectClientTool({ "user-agent": "codex_cli_rs/0.5.0" })).toBe("codex");
    expect(detectClientTool({ "user-agent": "Codex Desktop v1.0" })).toBe("codex");
  });

  it("detects codex tool from originator header", () => {
    expect(detectClientTool({ originator: "codex_exec" })).toBe("codex");
    expect(detectClientTool({ originator: "codex_vscode" })).toBe("codex");
    expect(detectClientTool({ Originator: "CODEX_TEST" })).toBe("codex");
  });

  it("returns null for unknown client user-agents", () => {
    expect(detectClientTool({ "user-agent": "curl/7.68.0" })).toBeNull();
  });

  it("identifies native passthrough for codex client and provider", () => {
    expect(isNativePassthrough("codex", "codex")).toBe(true);
    expect(isNativePassthrough("codex", "claude")).toBe(false);
  });
});
