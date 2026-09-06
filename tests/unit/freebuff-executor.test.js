import { describe, it, expect, vi, afterEach } from "vitest";
import os from "node:os";
import fs from "node:fs";
import { FreebuffTerminalParser, TUI_STATES } from "../../open-sse/services/freebuff/terminalParser.js";
import {
  getAccountHome,
  getAccountEnv,
  hasAccountCredentials,
  getAccountInfo,
  seedAccountCredentials,
} from "../../open-sse/services/freebuff/accountManager.js";
import {
  normalizeFreebuffModelId,
  getTuiMatcherForModel,
} from "../../open-sse/services/freebuff/modelCatalog.js";
import { FreebuffPtyWorker } from "../../open-sse/services/freebuff/ptyWorker.js";
import { FreebuffWorkerPool } from "../../open-sse/services/freebuff/workerPool.js";
import { FreebuffExecutor } from "../../open-sse/executors/freebuff.js";

const writeAsync = (parser, text, pty = null) =>
  new Promise((resolve) => parser.write(text, pty, resolve));

/**
 * Mock PTY process for testing FreebuffPtyWorker without a live binary.
 */
class MockPtyProcess {
  constructor() {
    this.written = [];
    this.listeners = { data: [], exit: [] };
  }

  onData(cb) {
    this.listeners.data.push(cb);
  }

  onExit(cb) {
    this.listeners.exit.push(cb);
  }

  write(data) {
    this.written.push(data);
  }

  async emitData(data) {
    for (const cb of this.listeners.data) {
      cb(data);
    }
    await new Promise((r) => setTimeout(r, 20));
  }

  emitExit(exitCode = 0, signal = null) {
    for (const cb of this.listeners.exit) {
      cb({ exitCode, signal });
    }
  }

  kill() {
    this.emitExit(0, "SIGTERM");
  }
}

describe("Freebuff Integration Unit Tests", () => {
  // -------------------------------------------------------------
  // 1. Terminal Parser & Escape Sequence Auto-Replies
  // -------------------------------------------------------------
  describe("FreebuffTerminalParser", () => {
    it("should auto-reply to OSC 11, OSC 10, and DSR 6 terminal queries", async () => {
      const parser = new FreebuffTerminalParser({ cols: 80, rows: 24 });
      const mockPty = new MockPtyProcess();

      await writeAsync(parser, "\u001b]11;?\u0007", mockPty);
      await writeAsync(parser, "\u001b]10;?\u0007", mockPty);
      await writeAsync(parser, "\u001b[6n", mockPty);

      expect(mockPty.written).toContain("\u001b]11;rgb:0000/0000/0000\u0007");
      expect(mockPty.written).toContain("\u001b]10;rgb:ffff/ffff/ffff\u0007");
      expect(mockPty.written).toContain("\u001b[1;1R");
    });

    it("should classify TUI states correctly", async () => {
      const parser = new FreebuffTerminalParser();

      // MEET_FREEBUCKS
      await writeAsync(parser, "★ Meet Freebucks ... Press any key to continue\n");
      expect(parser.getState()).toBe(TUI_STATES.MEET_FREEBUCKS);

      // SESSION_ENDED
      parser.term.reset();
      await writeAsync(parser, "Session ended. Press Enter to continue in a new session\n");
      expect(parser.getState()).toBe(TUI_STATES.SESSION_ENDED);

      // MODEL_SELECTION
      parser.term.reset();
      await writeAsync(parser, "Start coding for free\n› Solar Pro 4\n↓ See all 4 models\n");
      expect(parser.getState()).toBe(TUI_STATES.MODEL_SELECTION);

      // READY
      parser.term.reset();
      await writeAsync(parser, "╭──────────────────────────────────────────╮\n│ Enter a coding task or / for commands    │\n╰──────────────────────────────────────────╯\n");
      expect(parser.getState()).toBe(TUI_STATES.READY);

      // GENERATING
      parser.term.reset();
      await writeAsync(parser, "thinking...\n■ Esc to stop\n");
      expect(parser.getState()).toBe(TUI_STATES.GENERATING);

      // AUTH_REQUIRED
      parser.term.reset();
      await writeAsync(parser, "Please open the URL above manually to complete login\n");
      expect(parser.getState()).toBe(TUI_STATES.AUTH_REQUIRED);

      // QUOTA_EXHAUSTED
      parser.term.reset();
      await writeAsync(parser, "0/25 Freebucks daily\n0 Freebucks left\nOut of Freebucks\n");
      expect(parser.getState()).toBe(TUI_STATES.QUOTA_EXHAUSTED);
    });

    it("should cleanly extract assistant response and ignore prompt and footer", async () => {
      const parser = new FreebuffTerminalParser({ cols: 100, rows: 30 });
      const tuiScreen = [
        "User: Reply exactly TOOLNET_FREEBUFF_OK ⎘",
        "",
        "TOOLNET_FREEBUFF_OK",
        "",
        "⎘ • 2.4s • △▽",
        "╭──────────────────────────────────────────────────╮",
        "│ Enter a coding task or / for commands            │",
        "╰──────────────────────────────────────────────────╯",
      ].join("\n");

      await writeAsync(parser, tuiScreen);
      const extracted = parser.extractAssistantResponse("Reply exactly TOOLNET_FREEBUFF_OK");
      expect(extracted).toBe("TOOLNET_FREEBUFF_OK");
    });
  });

  // -------------------------------------------------------------
  // 2. Account Isolation & Credentials Safety
  // -------------------------------------------------------------
  describe("Freebuff Account Isolation", () => {
    const testConnId = "test-isolated-conn-" + Date.now();
    const testAccountHome = getAccountHome(testConnId);

    afterEach(() => {
      try {
        fs.rmSync(testAccountHome, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    });

    it("should generate isolated HOME path without directory traversal", () => {
      const home = getAccountHome("../etc/passwd");
      expect(home).not.toContain("../");
      expect(home).toContain("__etc_passwd");
    });

    it("should produce clean environment isolated to account HOME and remove CI flags", () => {
      const env = getAccountEnv(testConnId);
      expect(env.HOME).toBe(testAccountHome);
      expect(env.USERPROFILE).toBe(testAccountHome);
      expect(env.TERM).toBe("xterm-256color");
      expect(env.CI).toBeUndefined();
    });

    it("should safely store and retrieve credentials without leaking tokens in accountInfo", () => {
      const fakeCreds = {
        default: {
          id: "fake-id-123",
          name: "Test User",
          email: "test@example.com",
          authToken: "super-secret-freebuff-token-never-leak",
          fingerprintId: "fp-test-123",
        },
      };

      seedAccountCredentials(testConnId, JSON.stringify(fakeCreds));

      expect(hasAccountCredentials(testConnId)).toBe(true);

      const info = getAccountInfo(testConnId);
      expect(info.name).toBe("Test User");
      expect(info.email).toBe("test@example.com");
      expect(info.authToken).toBeUndefined();
      expect(JSON.stringify(info)).not.toContain("super-secret-freebuff-token-never-leak");
    });
  });

  // -------------------------------------------------------------
  // 3. Model Catalog & Normalization
  // -------------------------------------------------------------
  describe("Freebuff Model Catalog", () => {
    it("should normalize model names and aliases", () => {
      expect(normalizeFreebuffModelId("freebuff/mimo-v2.5")).toBe("mimo-v2.5");
      expect(normalizeFreebuffModelId("solar-pro-4")).toBe("solar-pro-4");
      expect(normalizeFreebuffModelId("freebuff/solar-pro")).toBe("solar-pro-4");
      expect(normalizeFreebuffModelId("freebuff/glm-5.3-flash")).toBe("glm-5.3-flash");
      expect(normalizeFreebuffModelId("freebuff/deepseek-v4-flash")).toBe("deepseek-v4-flash");
    });

    it("should match models in TUI picker lines", () => {
      const matcher = getTuiMatcherForModel("mimo-v2.5");
      expect(matcher("› MiMo 2.5")).toBe(true);
      expect(matcher("› Solar Pro 4")).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // 4. FreebuffPtyWorker Lifecycle with Mock PTY
  // -------------------------------------------------------------
  describe("FreebuffPtyWorker with Mock PTY", () => {
    it("should handle prompt submission and output capture", async () => {
      const worker = new FreebuffPtyWorker({
        connectionId: "mock-conn-1",
        workspaceCwd: os.tmpdir(),
      });

      const mockPty = new MockPtyProcess();
      worker.ptyProcess = mockPty;
      worker.isDead = false;
      worker.currentModel = "solar-pro-4"; // Already on target model

      mockPty.onData((data) => {
        worker.parser.write(data, mockPty);
      });

      await mockPty.emitData("╭──────────────────────────────────────────╮\n│ Enter a coding task or / for commands    │\n╰──────────────────────────────────────────╯\n");
      expect(worker.parser.getState()).toBe(TUI_STATES.READY);

      const execPromise = worker.executeTurn({
        prompt: "Hello Freebuff",
        model: "solar-pro-4",
      });

      await new Promise((r) => setTimeout(r, 100));

      const wroteBracketed = mockPty.written.some((w) => w.includes("\u001b[200~Hello Freebuff\u001b[201~"));
      expect(wroteBracketed).toBe(true);

      worker.parser.term.reset();
      await mockPty.emitData("User: Hello Freebuff ⎘\n\nHello! How can I assist you?\n\n╭──────────────────────────────────────────╮\n│ Enter a coding task or / for commands    │\n╰──────────────────────────────────────────╯\n");

      const result = await execPromise;
      expect(result).toBe("Hello! How can I assist you?");
    });

    it("should emit stream chunks during generation", async () => {
      const worker = new FreebuffPtyWorker({
        connectionId: "mock-conn-stream",
        workspaceCwd: os.tmpdir(),
      });

      const mockPty = new MockPtyProcess();
      worker.ptyProcess = mockPty;
      worker.isDead = false;
      worker.currentModel = "solar-pro-4";

      mockPty.onData((data) => {
        worker.parser.write(data, mockPty);
      });

      await mockPty.emitData("╭──────────────────────────────────────────╮\n│ Enter a coding task or / for commands    │\n╰──────────────────────────────────────────╯\n");

      const chunks = [];
      const execPromise = worker.executeTurn({
        prompt: "Count to 2",
        stream: true,
        onChunk: (chunk) => chunks.push(chunk),
      });

      await new Promise((r) => setTimeout(r, 100));

      // First chunk
      await mockPty.emitData("User: Count to 2 ⎘\n\n1, ");
      await new Promise((r) => setTimeout(r, 200));

      // Final completion
      await mockPty.emitData("2\n\n╭──────────────────────────────────────────╮\n│ Enter a coding task or / for commands    │\n╰──────────────────────────────────────────╯\n");

      const fullResult = await execPromise;
      expect(fullResult).toBe("1, 2");
      expect(chunks.join("")).toBe("1, 2");
    });
  });

  // -------------------------------------------------------------
  // 5. Worker Pool Queue & Concurrency
  // -------------------------------------------------------------
  describe("FreebuffWorkerPool Queueing", () => {
    it("should queue requests sequentially when worker is busy", async () => {
      const pool = new FreebuffWorkerPool();
      const executionOrder = [];

      const fakeWorker = {
        busy: false,
        queue: [],
        executeTurn: async ({ prompt }) => {
          executionOrder.push(`start-${prompt}`);
          await new Promise((r) => setTimeout(r, 100));
          executionOrder.push(`end-${prompt}`);
          return `resp-${prompt}`;
        },
      };

      pool.workers.set("queue-test-conn", fakeWorker);

      const [res1, res2] = await Promise.all([
        pool.dispatch({ connectionId: "queue-test-conn", prompt: "first" }),
        pool.dispatch({ connectionId: "queue-test-conn", prompt: "second" }),
      ]);

      expect(res1).toBe("resp-first");
      expect(res2).toBe("resp-second");
      expect(executionOrder).toEqual([
        "start-first",
        "end-first",
        "start-second",
        "end-second",
      ]);
    });
  });

  // -------------------------------------------------------------
  // 6. FreebuffExecutor OpenAI Translation & Error Mapping
  // -------------------------------------------------------------
  describe("FreebuffExecutor", () => {
    const executor = new FreebuffExecutor();

    it("should format OpenAI-compatible chat completion response", async () => {
      const mockPool = {
        dispatch: vi.fn().mockResolvedValue("TOOLNET_FREEBUFF_OK"),
      };

      const originalDispatch = (await import("../../open-sse/services/freebuff/workerPool.js")).freebuffWorkerPool.dispatch;
      (await import("../../open-sse/services/freebuff/workerPool.js")).freebuffWorkerPool.dispatch = mockPool.dispatch;

      try {
        const result = await executor.execute({
          model: "freebuff/solar-pro-4",
          body: {
            messages: [{ role: "user", content: "Reply exactly TOOLNET_FREEBUFF_OK" }],
          },
          stream: false,
          credentials: { id: "test-conn" },
        });

        expect(result.response.status).toBe(200);
        const json = await result.response.json();
        expect(json.object).toBe("chat.completion");
        expect(json.choices[0].message.role).toBe("assistant");
        expect(json.choices[0].message.content).toBe("TOOLNET_FREEBUFF_OK");
        expect(json.usage.total_tokens).toBeGreaterThanOrEqual(1);
      } finally {
        (await import("../../open-sse/services/freebuff/workerPool.js")).freebuffWorkerPool.dispatch = originalDispatch;
      }
    });

    it("should map Freebuff errors to standard HTTP status codes", () => {
      const err401 = new Error("Freebuff authentication required (401)");
      const res401 = executor.handleExecutionError(err401);
      expect(res401.response.status).toBe(401);

      const err429 = new Error("Freebuff quota exhausted (429)");
      const res429 = executor.handleExecutionError(err429);
      expect(res429.response.status).toBe(429);

      const err502 = new Error("Freebuff process crashed during generation (502)");
      const res502 = executor.handleExecutionError(err502);
      expect(res502.response.status).toBe(502);

      const err504 = new Error("Generation timed out after 120s (504)");
      const res504 = executor.handleExecutionError(err504);
      expect(res504.response.status).toBe(504);
    });
  });
});
