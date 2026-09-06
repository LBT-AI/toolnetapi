import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pty = require("node-pty");
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FreebuffTerminalParser, TUI_STATES, TerminalOutputCollector } from "./terminalParser.js";
import { resolveFreebuffBinary, getAccountEnv, ensureAccountDir } from "./accountManager.js";
import { normalizeFreebuffModelId, getTuiMatcherForModel } from "./modelCatalog.js";

const STARTUP_TIMEOUT_MS = 30000;
const READY_TIMEOUT_MS = 25000;
const GENERATION_TIMEOUT_MS = 120000;
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

export class FreebuffPtyWorker {
  constructor(options = {}) {
    this.connectionId = options.connectionId;
    this.workspaceCwd = options.workspaceCwd || path.join(os.tmpdir(), `toolnet-fb-${this.connectionId}`);
    this.binary = options.binary || resolveFreebuffBinary();
    this.log = options.log || console;

    this.ptyProcess = null;
    this.parser = new FreebuffTerminalParser({ cols: 120, rows: 40 });
    this.currentModel = null;
    this.busy = false;
    this.startedAt = null;
    this.lastActivityAt = null;
    this.idleTimer = null;
    this.isDead = false;

    // Queue for requests for this account
    this.queue = [];
  }

  /**
   * Start the PTY child process and wait until it is in READY state.
   */
  async start() {
    if (this.ptyProcess && !this.isDead) return;

    // Ensure account dir and workspace dir exist
    ensureAccountDir(this.connectionId);
    if (!fs.existsSync(this.workspaceCwd)) {
      fs.mkdirSync(this.workspaceCwd, { recursive: true });
    }

    const env = getAccountEnv(this.connectionId);
    this.startedAt = Date.now();
    this.lastActivityAt = Date.now();
    this.isDead = false;

    this.log?.info?.("FREEBUFF_PTY", `Spawning Freebuff binary: ${this.binary} --cwd ${this.workspaceCwd}`);

    this.ptyProcess = pty.spawn(this.binary, ["--cwd", this.workspaceCwd], {
      name: "xterm-256color",
      cols: 120,
      rows: 40,
      cwd: this.workspaceCwd,
      env,
    });

    this.ptyProcess.onData((data) => {
      this.lastActivityAt = Date.now();
      this.parser.write(data, this.ptyProcess);
      if (this.activeCollector) {
        this.activeCollector.processChunk();
      }
    });

    this.ptyProcess.onExit(({ exitCode, signal }) => {
      this.log?.warn?.("FREEBUFF_PTY", `Worker exited with code ${exitCode}, signal ${signal}`);
      this.isDead = true;
      this.ptyProcess = null;
    });

    await this.waitForReady(STARTUP_TIMEOUT_MS);
    this.resetIdleTimer();
  }

  resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (!this.busy && this.ptyProcess) {
        this.log?.info?.("FREEBUFF_PTY", `Idle timeout (${IDLE_TIMEOUT_MS}ms) reached for account ${this.connectionId}. Stopping worker.`);
        this.stop();
      }
    }, IDLE_TIMEOUT_MS);
    this.idleTimer.unref?.();
  }

  /**
   * Waits for the TUI to transition to READY, automatically handling initial modal popups.
   */
  async waitForReady(timeoutMs = READY_TIMEOUT_MS) {
    const startTime = Date.now();
    let handledEnter = false;

    while (Date.now() - startTime < timeoutMs) {
      if (this.isDead || !this.ptyProcess) {
        throw new Error("Freebuff worker process terminated unexpectedly during startup");
      }

      const state = this.parser.getState();
      if (state === TUI_STATES.READY || state === TUI_STATES.MODEL_SELECTION) {
        return true;
      }

      if (state === TUI_STATES.AUTH_REQUIRED) {
        throw new Error("Freebuff authentication required (401)");
      }

      if (state === TUI_STATES.QUOTA_EXHAUSTED) {
        throw new Error("Freebuff quota exhausted (429)");
      }

      if (state === TUI_STATES.MEET_FREEBUCKS) {
        this.ptyProcess.write(" ");
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }

      if (state === TUI_STATES.ALREADY_RUNNING) {
        this.log?.info?.("FREEBUFF_PTY", "Found existing instance popup, taking over...");
        this.ptyProcess.write("\r");
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }

      if (state === TUI_STATES.SESSION_ENDED) {
        this.ptyProcess.write("\r");
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      if (state === TUI_STATES.MODEL_SELECTION) {
        if (!handledEnter) {
          // Press Up arrow a few times to ensure we are at the top (Solar Pro 4)
          this.ptyProcess.write("\u001b[A\u001b[A\u001b[A\u001b[A");
          await new Promise((r) => setTimeout(r, 400));
          this.ptyProcess.write("\r");
          handledEnter = true;
          await new Promise((r) => setTimeout(r, 600));
        } else {
          // If we hit enter but are STILL in MODEL_SELECTION, maybe it requires more up arrows
          this.ptyProcess.write("\u001b[A");
          await new Promise((r) => setTimeout(r, 200));
          this.ptyProcess.write("\r");
          await new Promise((r) => setTimeout(r, 600));
        }
        continue;
      }

      await new Promise((r) => setTimeout(r, 300));
    }

    const finalState = this.parser.getState();
    const visibleText = this.parser.getLines().slice(-40).join("\n");
    throw new Error(`Timeout waiting for Freebuff worker to reach READY state (${timeoutMs}ms). Last state: ${finalState}. Screen:\n${visibleText}`);
  }

  /**
   * Selects model in Freebuff TUI if different from current selected model.
   */
  async selectModel(targetModelId) {
    const normalizedTarget = normalizeFreebuffModelId(targetModelId);
    if (this.currentModel === normalizedTarget) return;

    this.log?.info?.("FREEBUFF_PTY", `Switching model from ${this.currentModel} to ${normalizedTarget}`);

    // If in READY, trigger /end-session command
    const state = this.parser.getState();
    
    // Auto-detect current model if null
    if (this.currentModel === null && (state === TUI_STATES.READY || state === TUI_STATES.GENERATING)) {
      const screen = this.parser.getLines().join("\\n");
      const matcher = getTuiMatcherForModel(normalizedTarget);
      if (matcher(screen)) {
        this.log?.info?.("FREEBUFF_PTY", `Detected ${normalizedTarget} is already running on screen.`);
        this.currentModel = normalizedTarget;
        return;
      }
    }

    this.log?.info?.("FREEBUFF_PTY", `selectModel state check: ${state}`);
    if (state === TUI_STATES.READY) {
      this.ptyProcess.write("\u001b"); // clear prompt
      await new Promise((r) => setTimeout(r, 100));
      this.ptyProcess.write("\u001b[200~/end-session\u001b[201~");
      await new Promise((r) => setTimeout(r, 300));
      this.ptyProcess.write("\r"); // select autocomplete if open
      await new Promise((r) => setTimeout(r, 200));
      this.ptyProcess.write("\r"); // submit
      await new Promise((r) => setTimeout(r, 1500));
    } else {
      this.log?.warn?.("FREEBUFF_PTY", `Cannot trigger /end-session because state is ${state}`);
    }

    // Wait for MODEL_SELECTION state
    const pickerMatcher = getTuiMatcherForModel(normalizedTarget);
    let inSelection = false;
    for (let i = 0; i < 20; i++) {
      const s = this.parser.getState();
      if (s === TUI_STATES.MODEL_SELECTION) {
        inSelection = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    if (!inSelection) {
      this.log?.warn?.("FREEBUFF_PTY", "Could not enter MODEL_SELECTION, proceeding with current model");
      return;
    }

    // Expand "See all models" if present
    const visibleText = this.parser.getLines().slice(-40).join("\n");
    if (visibleText.includes("See all")) {
      this.ptyProcess.write("\u001b[B"); // Down arrow to See all
      await new Promise((r) => setTimeout(r, 300));
      this.ptyProcess.write("\r"); // Expand
      await new Promise((r) => setTimeout(r, 600));
    }

    // Navigate to target model
    let found = false;
    for (let attempts = 0; attempts < 10; attempts++) {
      const lines = this.parser.getLines();
      const currentSelectedLine = lines.find((l) => l.includes("›"));
      if (currentSelectedLine && pickerMatcher(currentSelectedLine)) {
        found = true;
        break;
      }
      this.ptyProcess.write("\u001b[B"); // Down arrow
      await new Promise((r) => setTimeout(r, 300));
    }

    // Confirm selection with Enter
    this.ptyProcess.write("\r");
    await new Promise((r) => setTimeout(r, 600));

    // Wait for READY state again
    await this.waitForReady(READY_TIMEOUT_MS);
    this.currentModel = normalizedTarget;
  }

  /**
   * Execute a prompt request.
   * @param {object} options
   * @param {string} options.prompt - The prompt text to submit.
   * @param {string} options.model - Target model.
   * @param {boolean} options.stream - Streaming mode.
   * @param {function} options.onChunk - Optional callback for stream chunks.
   * @param {AbortSignal} options.signal - Abort signal.
   */
  async executeTurn({ prompt, model, stream = false, onChunk = null, signal = null }) {
    if (this.isDead || !this.ptyProcess) {
      await this.start();
    }

    this.busy = true;
    if (this.idleTimer) clearTimeout(this.idleTimer);

    try {
      if (model) {
        await this.selectModel(model);
      }

      await this.waitForReady(15000);


      // Implement request-scoped extraction using TerminalOutputCollector
      this.log?.debug?.("FREEBUFF_PTY", `Submitting prompt (${prompt.length} chars)`);
      const collector = new TerminalOutputCollector(this.parser);
      this.activeCollector = collector;
      collector.start(prompt);

      // Clear any stuck autocomplete or text before pasting
      this.ptyProcess.write("\u001b");
      await new Promise((r) => setTimeout(r, 100));

      // BEFORE submitting, mark the EXACT length of the terminal history!
      collector.processChunk();
      collector.markPromptBoundary(false);

      // Prepend a space to prevent special chars from triggering autocomplete
      const safePrompt = " " + prompt;
      
      // Submit prompt via bracketed paste to avoid newline mangling
      this.ptyProcess.write(`\u001b[200~${safePrompt}\u001b[201~`);

      await new Promise((r) => setTimeout(r, 200));
      this.ptyProcess.write("\r"); // submit

      // Unified event-driven wait loop
      const startWait = Date.now();
      let generationDone = false;
      let lastEmittedText = "";
      let hasSeenGenerating = false;
      let lastOutputTime = Date.now();
      let lastCollectedLength = 0;

      // Small initial delay so we don't instantly read READY before the prompt is processed
      await new Promise((r) => setTimeout(r, 300));

      while (Date.now() - startWait < GENERATION_TIMEOUT_MS) {
        if (signal?.aborted) {
          this.ptyProcess.write("\u001b");
          collector.stop();
          throw new Error("Request aborted by client");
        }

        const state = this.parser.getState();
        if (state === TUI_STATES.GENERATING && !hasSeenGenerating) {
          hasSeenGenerating = true;
          collector.markPromptBoundary();
        }

        const currentLength = collector.collectedLines.length;
        if (currentLength > lastCollectedLength) {
          lastCollectedLength = currentLength;
          lastOutputTime = Date.now();
        }

        const currentText = collector.collectedLines.join("\n");
        if (stream && onChunk && currentText.length > lastEmittedText.length) {
          const delta = currentText.slice(lastEmittedText.length);
          lastEmittedText = currentText;
          onChunk(delta);
        }

        if (state === TUI_STATES.READY || state === TUI_STATES.SESSION_ENDED) {
          const elapsed = Date.now() - startWait;
          
          if (hasSeenGenerating) {
            await new Promise((r) => setTimeout(r, 200)); // drain
            generationDone = true;
            break;
          } else if (elapsed > 5000 && currentLength > 0) {
            this.log?.warn?.("FREEBUFF_PTY", "Fast response fallback triggered (no GENERATING state seen)");
            await new Promise((r) => setTimeout(r, 200));
            collector.markPromptBoundary(true); // Fallback: try to guess boundary via text
            generationDone = true;
            break;
          } else if (elapsed > 8000) {
            // Waited 8 seconds, zero output, still READY. Prompt was likely ignored.
            break;
          }
        }

        await new Promise((r) => setTimeout(r, 100));
      }

      const finalText = collector.stop();

      if (finalText === null) {
        throw new Error("FREEBUFF_RESPONSE_PARSE_FAILED");
      }

      if (!generationDone) {
        this.ptyProcess.write("\u001b"); // Esc to interrupt
        this.log?.warn?.("FREEBUFF_PTY", "Generation timeout exceeded");
        throw new Error(`Generation timed out after ${GENERATION_TIMEOUT_MS}ms`);
      }

      return finalText;
    } finally {
      this.busy = false;
      this.resetIdleTimer();
    }
  }

  stop() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.ptyProcess) {
      try {
        this.ptyProcess.write("/exit\r");
        setTimeout(() => {
          if (this.ptyProcess) this.ptyProcess.kill("SIGTERM");
        }, 1000);
      } catch {
        /* ignore */
      }
    }
    this.isDead = true;
  }
}
