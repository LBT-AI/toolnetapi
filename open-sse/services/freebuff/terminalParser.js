import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Terminal } = require("@xterm/headless");
const { SerializeAddon } = require("@xterm/addon-serialize");

export const TUI_STATES = {
  BOOTING: "BOOTING",
  MEET_FREEBUCKS: "MEET_FREEBUCKS",
  SESSION_ENDED: "SESSION_ENDED",
  MODEL_SELECTION: "MODEL_SELECTION",
  READY: "READY",
  GENERATING: "GENERATING",
  COMPLETE: "COMPLETE",
  QUOTA_EXHAUSTED: "QUOTA_EXHAUSTED",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  ALREADY_RUNNING: "ALREADY_RUNNING",
  ERROR: "ERROR",
};

export class FreebuffTerminalParser {
  constructor(options = {}) {
    this.cols = options.cols || 120;
    this.rows = options.rows || 40;
    this.term = new Terminal({
      cols: this.cols,
      rows: this.rows,
      scrollback: 5000,
      allowProposedApi: true,
    });
    this.serializeAddon = new SerializeAddon();
    this.term.loadAddon(this.serializeAddon);
    this.lastState = TUI_STATES.BOOTING;
  }

  /**
   * Handle incoming raw PTY data:
   * 1. Auto-responds to terminal escape queries on the provided ptyProcess
   * 2. Writes data into xterm headless virtual terminal
   */
  write(data, ptyProcess, callback) {
    if (!data) {
      if (callback) callback();
      return;
    }

    if (ptyProcess && typeof ptyProcess.write === "function") {
      // Respond to terminal capability and color queries
      if (data.includes("\u001b]11;?")) {
        ptyProcess.write("\u001b]11;rgb:0000/0000/0000\u0007");
      }
      if (data.includes("\u001b]10;?")) {
        ptyProcess.write("\u001b]10;rgb:ffff/ffff/ffff\u0007");
      }
      if (data.includes("\u001b[6n")) {
        ptyProcess.write("\u001b[1;1R");
      }
      if (data.includes("\u001b[14t")) {
        ptyProcess.write("\u001b[4;768;1024t");
      }
    }

    this.term.write(data, callback);
  }

  /**
   * Get all active buffer lines as plain trimmed strings.
   */
  getLines() {
    const buf = this.term.buffer.active;
    const len = buf.length;
    const lines = [];
    for (let i = 0; i < len; i++) {
      const line = buf.getLine(i);
      if (line) {
        lines.push(line.translateToString(true).trimEnd());
      } else {
        lines.push("");
      }
    }
    return lines;
  }

  /**
   * Get full text of the active buffer.
   */
  getFullText() {
    return this.getLines().join("\n");
  }

  /**
   * Classify current TUI state from visible screen content.
   */
  getState() {
    const lines = this.getLines();
    const bottomLines = lines.slice(-40).join("\n");
    const fullText = bottomLines;

    const calculateState = () => {
      if (fullText.includes("★ Meet Freebucks") && fullText.includes("Press any key to continue")) {
        return TUI_STATES.MEET_FREEBUCKS;
      }

      if (fullText.includes("Press Enter to continue in a new session")) {
        return TUI_STATES.SESSION_ENDED;
      }

      if (fullText.includes("Please open the URL above manually to complete login") ||
          fullText.includes("Freebuff Login") ||
          fullText.includes("Login required") ||
          fullText.includes("Please log in")) {
        return TUI_STATES.AUTH_REQUIRED;
      }

      if (fullText.includes("Freebuff is already running") && fullText.includes("Take over")) {
        return TUI_STATES.ALREADY_RUNNING;
      }

      if (fullText.includes("0/25 Freebucks daily") && fullText.includes("0 Freebucks left") && !fullText.includes("Labor Day")) {
        if (fullText.includes("Out of Freebucks") || fullText.includes("Daily limit reached")) {
          return TUI_STATES.QUOTA_EXHAUSTED;
        }
      }

      if (fullText.includes("Start coding for free") ||
          fullText.includes("See all") && fullText.includes("models") ||
          (fullText.includes("Freebucks/hr") && !fullText.includes("Enter a coding task"))) {
        return TUI_STATES.MODEL_SELECTION;
      }

      const hasInputPrompt = fullText.includes("Enter a coding task");
      const isGenerating = !hasInputPrompt && (
        fullText.includes("thinking...") ||
        fullText.includes("working...") ||
        fullText.includes("■ Esc") ||
        this.lastState === TUI_STATES.READY // If it was READY but prompt disappeared, it's GENERATING
      );

      if (isGenerating) {
        return TUI_STATES.GENERATING;
      }

      if (hasInputPrompt) {
        return TUI_STATES.READY;
      }

      if (fullText.includes("Connecting…")) {
        return TUI_STATES.BOOTING;
      }

      return this.lastState || TUI_STATES.BOOTING;
    };

    const state = calculateState();
    this.lastState = state;
    return state;
  }

  /**
   * Extract clean assistant response after the user prompt.
   * @param {string} promptText - The prompt that was submitted.
   */
  extractAssistantResponse(promptText = "") {
    const lines = this.getLines();
    if (!lines.length) return "";

    // 1. Locate the user prompt boundary
    // The user prompt in Freebuff ends with " ⎘" on the terminal line.
    let promptEndIndex = -1;
    const promptSnippet = promptText.trim().slice(0, 30);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if ((promptSnippet && line.includes(promptSnippet)) || line.endsWith("⎘")) {
        promptEndIndex = i;
      }
    }

    if (promptEndIndex === -1) {
      // Fallback: look for lines before the bottom input box
      promptEndIndex = 0;
    }

    // 2. Locate footer / status box boundary
    let footerStartIndex = lines.length;
    for (let i = promptEndIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (
        line.startsWith("╭──") ||
        line.startsWith("├──") ||
        line.startsWith("╰──") ||
        line.includes("Enter a coding task") ||
        line.includes("· 1h left") ||
        line.includes("· 2h left") ||
        line.includes("· 0h left") ||
        line.includes("✕ End session") ||
        line.includes("thinking...") ||
        line.includes("working...") ||
        line.includes("■ Esc")
      ) {
        footerStartIndex = i;
        break;
      }
    }

    // 3. Extract assistant content between prompt and footer
    const assistantLines = [];
    for (let i = promptEndIndex + 1; i < footerStartIndex; i++) {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();
      if (!trimmed) {
        if (assistantLines.length > 0) assistantLines.push("");
        continue;
      }

      // Filter out metadata badges like "⎘ • 12s • △▽" or timestamp lines
      if (/^⎘\s*•.*•\s*[△▽]/.test(trimmed) || /^\s*\[\d{2}:\d{2}\s*(?:AM|PM)\]\s*$/.test(trimmed)) {
        continue;
      }

      // Filter out Freebuff banner lines if any lingered
      if (trimmed.includes("██") || trimmed.includes("Freebuff will run commands") || trimmed.startsWith("Directory ")) {
        continue;
      }

      assistantLines.push(trimmed);
    }

    return assistantLines.join("\n").trim();
  }
}

export class TerminalOutputCollector {
  constructor(parser) {
    this.parser = parser;
    this.collectedLines = [];
    this.lastLines = [];
    this.intervalId = null;
  }

  stripFooter(lines) {
    let content = [...lines];
    const footerStart = content.findIndex(l => l.includes("╭───"));
    if (footerStart !== -1) {
      content = content.slice(0, footerStart);
    }
    while (content.length > 0) {
      const last = content[content.length - 1].trim();
      if (last === "" || last.includes("thinking...") || last.includes("working...") || last.includes("■ Esc") || last.includes("0/25 Freebucks")) {
        content.pop();
      } else {
        break;
      }
    }
    return content;
  }

  start(promptText = "") {
    this.lastPrompt = promptText;
    this.lastLines = this.stripFooter(this.parser.getLines());
    this.collectedLines = [];
  }

  processChunk() {
    this.poll();
  }

  poll() {
    const current = this.stripFooter(this.parser.getLines());
    if (this.lastLines.length === 0) {
      this.lastLines = current;
      this.collectedLines.push(...current);
      return;
    }

    let maxOverlap = 0;
    const maxK = Math.min(this.lastLines.length, current.length);
    for (let k = 1; k <= maxK; k++) {
      const suffix = this.lastLines.slice(-k).join('\n');
      const prefix = current.slice(0, k).join('\n');
      if (suffix === prefix) {
        maxOverlap = k;
      }
    }

    const newLines = current.slice(maxOverlap);
    if (newLines.length > 0) {
      this.collectedLines.push(...newLines);
      this.lastLines = current;
    }
  }

  markPromptBoundary(guess = false) {
    if (this.promptBoundary !== undefined) return;
    if (guess) {
      // Fast response fallback: try to find the last line that looks like a prompt or prefill
      for (let i = this.collectedLines.length - 1; i >= 0; i--) {
        if (this.collectedLines[i].includes("Assistant:") || this.collectedLines[i].includes("Enter a coding task")) {
          this.promptBoundary = i;
          return;
        }
      }
    }
    // Trust the exact line count at the moment GENERATING started
    this.promptBoundary = this.collectedLines.length - 1;
  }

  stop() {
    this.poll();

    const allText = this.collectedLines;
    require("fs").writeFileSync("/tmp/collector_dump_final.log", allText.join("\n"));
    
    let promptEndIndex;
    
    if (this.promptBoundary !== undefined) {
      promptEndIndex = this.promptBoundary;
    } else {
      promptEndIndex = -1;
      for (let i = allText.length - 1; i >= 0; i--) {
        if (allText[i].includes("Enter a coding task or / for commands") || allText[i].includes("Assistant:")) {
          promptEndIndex = i;
          break;
        }
      }
      if (promptEndIndex === -1) {
        return null; // fail closed only if we guessed and failed
      }
    }

    let responseLines = allText.slice(promptEndIndex + 1);

    // Clean up responseLines: remove badges, banners, and empty lines
    const cleaned = [];
    for (const line of responseLines) {
      const trimmed = line.trim();
      if (trimmed === "") continue;
      if (trimmed.includes("thinking...") || trimmed.includes("working...") || trimmed.includes("■ Esc") || trimmed.includes("0/25 Freebucks")) continue;
      if (/^⎘\s*•.*•\s*[△▽]/.test(trimmed)) continue;
      if (/^\s*\[\d{2}:\d{2}\s*(?:AM|PM)\]\s*$/.test(trimmed)) continue;
      if (trimmed.includes("Freebuff will run commands") || trimmed.startsWith("Directory ")) continue;
      if (trimmed.includes("✕ End session") || trimmed.includes("Solar Pro 4 ·")) continue;
      if (trimmed.includes("██") || trimmed.includes("╚═╝") || trimmed.includes("╔═╝") || trimmed.includes("║")) continue;
      // Strip trailing block characters and inline copy badges like █ or ⎘
      const noBlocks = line.replace(/[█⎘\s]+$/, "").trim();
      if (noBlocks === "") continue;
      cleaned.push(noBlocks);
    }

    // The response lines might include the user's prompt (because Freebuff echoes it).
    // Let's strip the prompt if it appears exactly at the beginning.
    let responseString = cleaned.join("\n").trim();
    const promptTrimmed = (this.lastPrompt || "").trim();
    if (promptTrimmed && responseString.startsWith(promptTrimmed)) {
      responseString = responseString.slice(promptTrimmed.length).trim();
    }
    // Also remove the prepended space if we bypassed autocomplete
    if (promptTrimmed && responseString.startsWith(" " + promptTrimmed)) {
      responseString = responseString.slice(promptTrimmed.length + 1).trim();
    }
    
    // Also, if the prompt was "Reply exactly TOOLNET_FREEBUFF_OK" and the response ends up empty,
    // Freebuff might have appended the response to the same line. 
    // We already stripped it from the start.

    return responseString;
  }
}
