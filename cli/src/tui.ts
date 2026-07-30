#!/usr/bin/env bun
/**
 * ToolNet CLI — Full-screen TUI
 * Raw terminal mode, pure ANSI escape codes, no external TUI libraries.
 * Compatible with Termius mobile SSH, all ANSI terminals.
 */

import { createInterface } from "node:readline";

// ─── ANSI Helpers ───────────────────────────────────────────────────────────
const ESC = "\x1b";
const CSI = ESC + "[";

const A = {
  reset:     CSI + "0m",
  bold:      CSI + "1m",
  dim:       CSI + "2m",
  italic:    CSI + "3m",

  // Clean dark theme — no purple background
  bg:        CSI + "48;2;18;18;18m",       // near black
  bgSurface: CSI + "48;2;28;28;28m",       // dark gray
  bgOverlay: CSI + "48;2;42;42;42m",       // medium gray (for selections)
  fgText:    CSI + "38;2;220;220;220m",    // light gray text
  fgSubtext: CSI + "38;2;140;140;140m",    // dimmed text
  fgCyan:    CSI + "38;2;86;182;194m",     // cyan accent
  fgGreen:   CSI + "38;2;98;209;150m",     // green
  fgYellow:  CSI + "38;2;229;192;123m",    // yellow
  fgRed:     CSI + "38;2;224;108;117m",    // red
  fgBlue:    CSI + "38;2;97;175;239m",     // blue
  fgMauve:   CSI + "38;2;180;180;220m",    // light blue-gray (replace purple)
  fgPeach:   CSI + "38;2;209;154;102m",    // orange
  bgHeader:  CSI + "48;2;10;10;10m",       // header: almost pure black
  bgInput:   CSI + "48;2;22;22;22m",       // input: slightly lighter than bg
  bgSuggest: CSI + "48;2;35;35;35m",       // suggestion popup bg
};

const T = {
  // Cursor
  hide:      CSI + "?25l",
  show:      CSI + "?25h",
  home:      CSI + "H",
  goto: (r: number, c: number) => CSI + r + ";" + c + "H",
  clearLine: CSI + "2K",
  clearDown: CSI + "J",
  altOn:     CSI + "?1049h",
  altOff:    CSI + "?1049l",
  // No mouse, no xterm version query — Termius safe
};

function write(s: string) { process.stdout.write(s); }
function writeln(s: string) { write(s + "\r\n"); }

function fillLine(text: string, width: number, fg = A.fgText, bg = A.bgSurface): string {
  const stripped = text.replace(/\x1b\[[^m]*m/g, "");
  const pad = Math.max(0, width - stripped.length);
  return bg + fg + text + " ".repeat(pad) + A.reset;
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + "…";
}

// ─── Terminal Size ───────────────────────────────────────────────────────────
function getSize(): { cols: number; rows: number } {
  return {
    cols: process.stdout.columns || 100,
    rows: process.stdout.rows || 30,
  };
}

// ─── State ───────────────────────────────────────────────────────────────────
const SPINNER = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
type Role = "user" | "assistant" | "system";
interface Msg { role: Role; content: string; }

let messages: Msg[] = [];
let inputBuffer = "";
let cursorPos = 0;
let scrollOffset = 0;    // how many lines scrolled up from bottom
let statusText = "";
let isStreaming = false;
let spinnerIdx = 0;
let spinnerTimer: ReturnType<typeof setInterval> | null = null;
let currentModel = "openai/gpt-4o";
let agentMode: "Build" | "Plan" = "Build";
let gatewayUrl = "http://127.0.0.1:20127";
let showHelp = false;
let showModelPicker = false;
let availableModels: string[] = [];
let modelPickerIdx = 0;
let abortController: AbortController | null = null;
let ctrlCCount = 0;
let ctrlCTimer: ReturnType<typeof setTimeout> | null = null;
let startTime = 0;
let elapsedDisplay = "";

// ─── Slash command suggestions ──────────────────────────────────────────────
const COMMANDS = [
  { name: "/exit",      desc: "Exit ToolNet CLI" },
  { name: "/help",      desc: "Toggle help/hints" },
  { name: "/model",     desc: "Pick AI model (Ctrl+K)" },
  { name: "/clear",     desc: "Clear chat history" },
  { name: "/agent",     desc: "Toggle Build/Plan mode" },
  { name: "/plan",      desc: "Switch to Plan mode" },
  { name: "/build",     desc: "Switch to Build mode" },
  { name: "/providers", desc: "Show providers (open Web UI)" },
  { name: "/keys",      desc: "Manage API keys (open Web UI)" },
  { name: "/settings",  desc: "Open gateway settings" },
  { name: "/status",    desc: "Show gateway connection status" },
];
let cmdSuggestIdx = 0;

function getSuggestions(input: string) {
  if (!input.startsWith("/")) return [];
  const search = input.toLowerCase();
  return COMMANDS.filter(c => c.name.startsWith(search));
}

// ─── Layout constants ────────────────────────────────────────────────────────
const HEADER_ROWS = 1;
const STATUS_ROWS = 1;
const INPUT_ROWS = 2;   // border + input line
const RESERVED = HEADER_ROWS + STATUS_ROWS + INPUT_ROWS;

// ─── Render ──────────────────────────────────────────────────────────────────
function renderAll() {
  const { cols, rows } = getSize();
  const chatRows = rows - RESERVED;
  const out: string[] = [];

  // Go home, hide cursor
  out.push(T.hide + T.home);

  // ── Header ──
  const modeLabel = A.fgPeach + A.bold + ` [${agentMode}] ` + A.reset;
  const modelLabel = A.fgSubtext + "Model: " + A.reset + A.fgCyan + A.bold + truncate(currentModel, 30) + A.reset;
  const gwLabel = A.fgSubtext + " │ GW: " + A.reset + A.fgGreen + "●" + A.reset;
  const title = A.fgMauve + A.bold + " TOOLNET " + A.reset;
  const headerRight = modelLabel + gwLabel + modeLabel;
  const headerRightStripped = headerRight.replace(/\x1b\[[^m]*m/g, "");
  const titleStripped = " TOOLNET ";
  const padding = Math.max(0, cols - titleStripped.length - headerRightStripped.length);

  out.push(
    A.bgHeader + A.bold +
    title +
    " ".repeat(padding) +
    headerRight +
    A.reset + A.bgHeader + " ".repeat(Math.max(0, cols - titleStripped.length - headerRightStripped.length - padding)) +
    A.reset + "\r\n"
  );

  // ── Chat area ──
  const chatLines: string[] = [];
  for (const msg of messages) {
    const isUser = msg.role === "user";
    const prefix = isUser
      ? A.fgYellow + A.bold + "  You  " + A.reset + " "
      : A.fgCyan + A.bold + " ToolNet" + A.reset + " ";
    const prefixStripped = isUser ? "  You   " : " ToolNet ";
    const wrapWidth = cols - prefixStripped.length - 2;

    const lines = wrapText(msg.content, wrapWidth);
    for (let i = 0; i < lines.length; i++) {
      const linePrefix = i === 0 ? prefix : " ".repeat(prefixStripped.length);
      chatLines.push(A.bg + linePrefix + A.fgText + lines[i] + A.reset);
    }
    chatLines.push(A.bg + A.reset); // blank line between messages
  }

  // Scroll: show last chatRows lines
  const totalLines = chatLines.length;
  const maxScroll = Math.max(0, totalLines - chatRows);
  const clampedScroll = Math.min(scrollOffset, maxScroll);
  const startLine = Math.max(0, totalLines - chatRows - clampedScroll);
  const visibleLines = chatLines.slice(startLine, startLine + chatRows);

  // Pad if fewer lines than chatRows
  for (let i = 0; i < chatRows; i++) {
    const line = visibleLines[i] ?? (A.bg + A.reset);
    // strip trailing ANSI and pad to cols
    const stripped = line.replace(/\x1b\[[^m]*m/g, "");
    const pad = Math.max(0, cols - stripped.length);
    out.push(line + A.bg + " ".repeat(pad) + A.reset + "\r\n");
  }

  // ── Slash command suggestions popup (above input) ──
  const activeSuggests = getSuggestions(inputBuffer);
  if (activeSuggests.length > 0) {
    const popupRows = Math.min(activeSuggests.length, 8);
    // Clamp cmdSuggestIdx
    if (cmdSuggestIdx >= activeSuggests.length) cmdSuggestIdx = activeSuggests.length - 1;
    for (let si = 0; si < popupRows; si++) {
      const cmd = activeSuggests[si];
      const selected = si === cmdSuggestIdx;
      const bg = selected ? A.bgOverlay : A.bgSuggest;
      const nameFg = selected ? A.fgCyan + A.bold : A.fgCyan;
      const descFg = A.fgSubtext;
      const nameText = cmd.name.padEnd(14);
      const descText = truncate(cmd.desc, cols - 18);
      const line = bg + "  " + nameFg + nameText + A.reset + bg + descFg + descText + A.reset;
      const stripped = ("  " + nameText + descText).length;
      const pad = Math.max(0, cols - stripped - 2);
      out.push(line + bg + " ".repeat(pad) + A.reset + "\r\n");
    }
    out.push(A.bgSuggest + A.fgSubtext + " ↑↓ navigate  Tab/Enter select  Esc cancel ".padEnd(cols) + A.reset + "\r\n");
  }

  // ── Input border ──
  const borderLine = A.bgSurface + A.fgSubtext + "─".repeat(cols) + A.reset;
  out.push(borderLine + "\r\n");

  // ── Input bar ──
  const prompt = A.fgPeach + A.bold + "▸ " + A.reset + A.bgInput;
  const promptWidth = 2;
  const inputVisible = inputBuffer.length > cols - promptWidth - 4
    ? "…" + inputBuffer.slice(-(cols - promptWidth - 5))
    : inputBuffer;
  const placeholder = inputBuffer === ""
    ? A.fgSubtext + A.dim + "Type a message…  (/help to see commands)" + A.reset
    : A.bgInput + A.fgText + inputVisible + A.reset;

  out.push(
    A.bgInput +
    prompt +
    (inputBuffer === "" ? placeholder : A.fgText + inputVisible + A.reset) +
    A.bgInput + A.reset + "\r\n"
  );

  // ── Status bar ──
  let statusContent: string;
  if (showHelp) {
    statusContent = A.fgYellow + " /model /providers /keys /settings /agent /plan /help /exit  │  Tab:mode  Ctrl+K:models  Esc:cancel" + A.reset;
  } else if (isStreaming) {
    const spinner = A.fgYellow + A.bold + SPINNER[spinnerIdx] + A.reset;
    statusContent = spinner + " " + A.fgYellow + statusText + A.reset + A.fgSubtext + elapsedDisplay + A.reset;
  } else if (statusText) {
    const isErr = statusText.startsWith("Error") || statusText.startsWith("✖");
    const fg = isErr ? A.fgRed : statusText.startsWith("✔") ? A.fgGreen : A.fgCyan;
    statusContent = fg + A.bold + statusText + A.reset + A.fgSubtext + elapsedDisplay + A.reset;
  } else {
    statusContent = A.fgGreen + A.bold + "● Ready" + A.reset + A.fgSubtext + "  │  Enter:send  Tab:mode  Ctrl+K:model  /help  /exit" + A.reset;
  }
  const statusStripped = statusContent.replace(/\x1b\[[^m]*m/g, "");
  const statusPad = Math.max(0, cols - statusStripped.length);
  out.push(A.bgSurface + statusContent + " ".repeat(statusPad) + A.reset);

  // Position cursor in input line
  const cursorRow = rows - INPUT_ROWS + 1;  // 1-indexed
  const cursorCol = Math.min(promptWidth + 1 + cursorPos, cols - 1) + 1;
  out.push(T.goto(cursorRow, cursorCol) + T.show);

  write(out.join(""));
}

// ─── Text wrapping ───────────────────────────────────────────────────────────
function wrapText(text: string, width: number): string[] {
  if (width <= 0) return [text];
  const lines: string[] = [];
  const paragraphs = text.split("\n");
  for (const para of paragraphs) {
    if (para === "") { lines.push(""); continue; }
    let current = "";
    for (const word of para.split(" ")) {
      if (current === "") {
        current = word;
      } else if (current.length + 1 + word.length <= width) {
        current += " " + word;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}

// ─── Streaming chat ─────────────────────────────────────────────────────────
async function sendMessage(text: string) {
  if (!text.trim()) return;

  // Slash commands
  if (text.startsWith("/")) {
    await handleCommand(text.trim());
    return;
  }

  messages.push({ role: "user", content: text });
  scrollOffset = 0;
  startTime = Date.now();
  elapsedDisplay = "";
  setStatus("Thinking…");
  isStreaming = true;
  abortController = new AbortController();

  spinnerTimer = setInterval(() => {
    spinnerIdx = (spinnerIdx + 1) % SPINNER.length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    elapsedDisplay = "  " + elapsed + "s";
    renderAll();
  }, 100);

  try {
    setStatus("Calling API…");

    const res = await fetch(gatewayUrl + "/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: currentModel,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: true,
      }),
      signal: abortController.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      let errMsg = `HTTP ${res.status}`;
      try { const j = JSON.parse(errText); errMsg = j.error?.message || errMsg; } catch {}
      stopSpinner();
      messages.push({ role: "assistant", content: "✖ Error: " + errMsg });
      setStatus("✖ " + errMsg);
      renderAll();
      return;
    }

    if (!res.body) {
      stopSpinner();
      messages.push({ role: "assistant", content: "✖ Error: No response body" });
      setStatus("✖ No response body");
      renderAll();
      return;
    }

    setStatus("Streaming response…");

    let fullText = "";
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    // Add placeholder message for live streaming display
    messages.push({ role: "assistant", content: "▊" });
    const assistantIdx = messages.length - 1;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";

      for (const line of parts) {
        const t = line.trim();
        if (!t || t === "data: [DONE]") continue;
        if (t.startsWith("data: ")) {
          try {
            const json = JSON.parse(t.slice(6));
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              messages[assistantIdx] = { role: "assistant", content: fullText + "▊" };
              scrollOffset = 0;
            }
          } catch {}
        }
      }
    }

    // Finalize message
    messages[assistantIdx] = { role: "assistant", content: fullText || "(empty response)" };
    scrollOffset = 0;
    stopSpinner();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    setStatus(`✔ Done in ${elapsed}s`);
    elapsedDisplay = "";

  } catch (err: any) {
    stopSpinner();
    if (err?.name === "AbortError") {
      messages.push({ role: "assistant", content: "(cancelled)" });
      setStatus("Cancelled");
    } else {
      messages.push({ role: "assistant", content: "✖ Error: " + (err?.message || String(err)) });
      setStatus("✖ " + (err?.message || "Unknown error"));
    }
  } finally {
    abortController = null;
  }
  renderAll();
}

function setStatus(s: string) {
  statusText = s;
}

function stopSpinner() {
  if (spinnerTimer) { clearInterval(spinnerTimer); spinnerTimer = null; }
  isStreaming = false;
}

// ─── Slash commands ──────────────────────────────────────────────────────────
async function handleCommand(cmd: string) {
  const parts = cmd.split(" ");
  const name = parts[0].toLowerCase();

  switch (name) {
    case "/exit":
    case "/quit":
      exitApp();
      break;

    case "/help":
      showHelp = !showHelp;
      break;

    case "/model":
      await openModelPicker();
      break;

    case "/providers":
    case "/keys": {
      messages.push({ role: "system", content: "→ Configure providers/keys at: " + gatewayUrl + "/settings" });
      break;
    }

    case "/clear":
      messages = [];
      setStatus("Chat cleared");
      break;

    case "/agent": {
      agentMode = agentMode === "Build" ? "Plan" : "Build";
      setStatus("Mode: " + agentMode);
      break;
    }

    case "/plan": {
      agentMode = "Plan";
      setStatus("Mode: Plan");
      break;
    }

    case "/build": {
      agentMode = "Build";
      setStatus("Mode: Build");
      break;
    }

    case "/combos":
    case "/settings":
      messages.push({ role: "system", content: "→ Open Web UI at: " + gatewayUrl + "/settings" });
      break;

    default:
      messages.push({ role: "system", content: "Unknown command: " + name + "  (type /help)" });
  }
  renderAll();
}

// ─── Model Picker ────────────────────────────────────────────────────────────
async function openModelPicker() {
  if (availableModels.length === 0) {
    setStatus("Loading models…");
    renderAll();
    try {
      const res = await fetch(gatewayUrl + "/v1/models");
      if (res.ok) {
        const data = await res.json() as any;
        availableModels = (data.data || []).map((m: any) => m.id as string);
      }
    } catch {}
  }
  modelPickerIdx = availableModels.indexOf(currentModel);
  if (modelPickerIdx < 0) modelPickerIdx = 0;
  showModelPicker = true;
  setStatus("↑↓ navigate  Enter select  Esc cancel");
  renderAll();
}

function renderModelPicker() {
  const { cols, rows } = getSize();
  const boxW = Math.min(60, cols - 4);
  const boxH = Math.min(20, rows - 6);
  const startRow = Math.floor((rows - boxH) / 2);
  const startCol = Math.floor((cols - boxW) / 2);

  const out: string[] = [];

  // Draw box
  out.push(T.goto(startRow, startCol));
  out.push(A.bgSurface + A.fgBlue + A.bold + "┌" + "─".repeat(boxW - 2) + "┐" + A.reset);

  // Title
  out.push(T.goto(startRow + 1, startCol));
  const titleText = " Select Model (" + availableModels.length + " available) ";
  const titlePad = Math.max(0, boxW - 2 - titleText.length);
  out.push(A.bgSurface + A.fgBlue + A.bold + "│" + titleText + " ".repeat(titlePad) + "│" + A.reset);

  // Separator
  out.push(T.goto(startRow + 2, startCol));
  out.push(A.bgSurface + A.fgBlue + "│" + "─".repeat(boxW - 2) + "│" + A.reset);

  // Models list
  const listRows = boxH - 4;
  const listStart = Math.max(0, modelPickerIdx - Math.floor(listRows / 2));
  const visible = availableModels.slice(listStart, listStart + listRows);

  for (let i = 0; i < listRows; i++) {
    out.push(T.goto(startRow + 3 + i, startCol));
    const modelIdx = listStart + i;
    const model = visible[i];
    if (!model) {
      out.push(A.bgSurface + A.fgBlue + "│" + " ".repeat(boxW - 2) + "│" + A.reset);
    } else {
      const selected = modelIdx === modelPickerIdx;
      const current = model === currentModel;
      const marker = selected ? "▸ " : current ? "✔ " : "  ";
      const text = truncate(marker + model, boxW - 3);
      const textPad = Math.max(0, boxW - 3 - text.replace(/\x1b\[[^m]*m/g, "").length);
      const fg = selected ? A.fgYellow + A.bold : current ? A.fgGreen : A.fgText;
      const bg = selected ? A.bgOverlay : A.bgSurface;
      out.push(bg + A.fgBlue + "│" + fg + " " + text + " ".repeat(textPad) + A.reset + A.bgSurface + A.fgBlue + "│" + A.reset);
    }
  }

  // Bottom border
  out.push(T.goto(startRow + boxH - 1, startCol));
  out.push(A.bgSurface + A.fgBlue + "└" + "─".repeat(boxW - 2) + "┘" + A.reset);

  write(out.join(""));
}

// ─── Input handling ──────────────────────────────────────────────────────────
function handleKey(data: Buffer) {
  const s = data.toString("utf8");
  const hex = data.toString("hex");

  // Model picker navigation
  if (showModelPicker) {
    if (hex === "1b5b41" || hex === "1b4f41") { // Up
      modelPickerIdx = Math.max(0, modelPickerIdx - 1);
      renderAll(); renderModelPicker();
    } else if (hex === "1b5b42" || hex === "1b4f42") { // Down
      modelPickerIdx = Math.min(availableModels.length - 1, modelPickerIdx + 1);
      renderAll(); renderModelPicker();
    } else if (hex === "0d" || hex === "0a") { // Enter
      if (availableModels[modelPickerIdx]) {
        currentModel = availableModels[modelPickerIdx];
        setStatus("Model: " + currentModel);
      }
      showModelPicker = false;
      renderAll();
    } else if (hex === "1b") { // Esc
      showModelPicker = false;
      setStatus("");
      renderAll();
    }
    return;
  }

  // Help toggle
  if (showHelp && (hex === "1b" || s === "?")) {
    showHelp = false;
    renderAll();
    return;
  }

  // Ctrl+C
  if (hex === "03") {
    if (isStreaming) {
      abortController?.abort();
      stopSpinner();
      setStatus("Cancelled");
      renderAll();
      return;
    }
    ctrlCCount++;
    if (ctrlCCount >= 2) {
      exitApp();
    } else {
      setStatus("Press Ctrl+C again to exit  (or type /exit)");
      renderAll();
      if (ctrlCTimer) clearTimeout(ctrlCTimer);
      ctrlCTimer = setTimeout(() => { ctrlCCount = 0; setStatus(""); renderAll(); }, 2000);
    }
    return;
  }

  // Esc — close popups or cancel stream, NEVER exit
  if (hex === "1b") {
    if (showHelp) { showHelp = false; renderAll(); return; }
    if (showModelPicker) { showModelPicker = false; renderAll(); return; }
    if (isStreaming) {
      abortController?.abort();
      stopSpinner();
      setStatus("Cancelled");
      renderAll();
    }
    return;
  }

  // Ctrl+K / Ctrl+M — model picker
  if (hex === "0b" || hex === "0d" && false) { /* placeholder */ }
  if (s === "\x0b") { openModelPicker(); return; } // Ctrl+K
  if (s === "\x0e") { openModelPicker(); return; } // Ctrl+N alternate

  // Slash command suggestions navigation
  const suggests = getSuggestions(inputBuffer);
  if (suggests.length > 0) {
    if (hex === "1b5b41" || hex === "1b4f41") { // Up
      cmdSuggestIdx = Math.max(0, cmdSuggestIdx - 1);
      renderAll(); return;
    }
    if (hex === "1b5b42" || hex === "1b4f42") { // Down
      cmdSuggestIdx = Math.min(suggests.length - 1, cmdSuggestIdx + 1);
      renderAll(); return;
    }
    if (hex === "09") { // Tab
      const selected = suggests[cmdSuggestIdx]?.name;
      if (selected) {
        inputBuffer = selected + " ";
        cursorPos = inputBuffer.length;
        renderAll();
      }
      return;
    }
    if (hex === "0d" || hex === "0a") { // Enter
      const selected = suggests[cmdSuggestIdx]?.name;
      if (selected && inputBuffer !== selected) {
        inputBuffer = selected;
        cursorPos = inputBuffer.length;
        // fall through to normal Enter handler
      }
    }
  }

  // Tab — toggle mode (only if not autocompleting)
  if (hex === "09") {
    agentMode = agentMode === "Build" ? "Plan" : "Build";
    setStatus("Mode: " + agentMode);
    renderAll();
    return;
  }

  // ? — help
  if (s === "?" && inputBuffer === "") {
    showHelp = !showHelp;
    renderAll();
    return;
  }

  // Page Up/Down — scroll
  if (hex === "1b5b357e") { scrollOffset += 5; renderAll(); return; } // PgUp
  if (hex === "1b5b367e") { scrollOffset = Math.max(0, scrollOffset - 5); renderAll(); return; } // PgDn
  if (hex === "1b5b41") { scrollOffset++; renderAll(); return; } // Up arrow (scroll)
  if (hex === "1b5b42") { scrollOffset = Math.max(0, scrollOffset - 1); renderAll(); return; } // Down arrow

  // Enter — send message (handle both \r and \n)
  if (hex === "0d" || hex === "0a") {
    if (isStreaming) return;
    const text = inputBuffer;
    inputBuffer = "";
    cursorPos = 0;
    cmdSuggestIdx = 0;
    setStatus("");
    renderAll();
    if (text.trim()) sendMessage(text);
    return;
  }

  // Backspace
  if (hex === "7f" || hex === "08") {
    if (cursorPos > 0) {
      inputBuffer = inputBuffer.slice(0, cursorPos - 1) + inputBuffer.slice(cursorPos);
      cursorPos--;
      cmdSuggestIdx = 0;
      renderAll();
    }
    return;
  }

  // Delete key
  if (hex === "1b5b337e") {
    if (cursorPos < inputBuffer.length) {
      inputBuffer = inputBuffer.slice(0, cursorPos) + inputBuffer.slice(cursorPos + 1);
      cmdSuggestIdx = 0;
      renderAll();
    }
    return;
  }

  // Left/Right arrows in input
  if (hex === "1b5b44") { cursorPos = Math.max(0, cursorPos - 1); renderAll(); return; }
  if (hex === "1b5b43") { cursorPos = Math.min(inputBuffer.length, cursorPos + 1); renderAll(); return; }
  if (hex === "1b5b48" || hex === "1b4f48") { cursorPos = 0; renderAll(); return; } // Home
  if (hex === "1b5b46" || hex === "1b4f46") { cursorPos = inputBuffer.length; renderAll(); return; } // End

  // Ctrl+U — clear line
  if (hex === "15") { inputBuffer = ""; cursorPos = 0; renderAll(); return; }

  // Ctrl+W — delete word back
  if (hex === "17") {
    const before = inputBuffer.slice(0, cursorPos);
    const after = inputBuffer.slice(cursorPos);
    const trimmed = before.replace(/\S+\s*$/, "");
    inputBuffer = trimmed + after;
    cursorPos = trimmed.length;
    cmdSuggestIdx = 0;
    renderAll();
    return;
  }

  // Shift+Enter / Ctrl+J — newline in input
  if (hex === "0a" || (s.length === 1 && s.charCodeAt(0) === 10)) {
    inputBuffer = inputBuffer.slice(0, cursorPos) + "\n" + inputBuffer.slice(cursorPos);
    cursorPos++;
    renderAll();
    return;
  }

  // Printable characters
  if (s.length === 1 && s.charCodeAt(0) >= 32) {
    inputBuffer = inputBuffer.slice(0, cursorPos) + s + inputBuffer.slice(cursorPos);
    cursorPos++;
    cmdSuggestIdx = 0;
    renderAll();
    return;
  }

  // Multi-byte UTF-8 (emoji, Vietnamese, etc.)
  if (data.length > 1 && !s.startsWith("\x1b")) {
    inputBuffer = inputBuffer.slice(0, cursorPos) + s + inputBuffer.slice(cursorPos);
    cursorPos += s.length;
    cmdSuggestIdx = 0;
    renderAll();
    return;
  }
}

// ─── Exit / Cleanup ──────────────────────────────────────────────────────────
function exitApp() {
  if (spinnerTimer) clearInterval(spinnerTimer);
  write(T.show + T.altOff + A.reset + "\r\n");
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.stdout.write("Goodbye!\r\n");
  process.exit(0);
}

function handleResize() {
  renderAll();
  if (showModelPicker) renderModelPicker();
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  // Check gateway
  try {
    const res = await fetch(gatewayUrl + "/api/health", { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error("not ok");
    setStatus("● Connected to " + gatewayUrl);
  } catch {
    setStatus("✖ Cannot reach gateway at " + gatewayUrl + " — start with ./start-all.sh");
  }

  // Load config
  try {
    const { readFileSync } = await import("node:fs");
    const cfg = JSON.parse(readFileSync(process.env.HOME + "/.toolnetapi/config.json", "utf8"));
    if (cfg.defaultModel) currentModel = cfg.defaultModel;
    if (cfg.baseUrl) gatewayUrl = cfg.baseUrl;
  } catch {}

  // Switch to alt screen, hide cursor
  write(T.altOn + T.hide + T.home + T.clearDown);

  // Set raw mode
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  // Handle resize
  process.stdout.on("resize", handleResize);

  // Initial render
  renderAll();

  // Read keystrokes — parse byte sequences properly
  process.stdin.on("data", (data: Buffer) => {
    let i = 0;
    while (i < data.length) {
      if (data[i] === 0x1b) {
        // ESC sequence
        if (i + 1 < data.length && (data[i+1] === 0x5b || data[i+1] === 0x4f)) {
          let j = i + 2;
          while (j < data.length && !((data[j] >= 0x40 && data[j] <= 0x7e))) j++;
          handleKey(data.slice(i, j + 1)); i = j + 1;
        } else if (i + 1 < data.length) {
          handleKey(data.slice(i, i + 2)); i += 2;
        } else {
          handleKey(data.slice(i, i + 1)); i++;
        }
      } else {
        // UTF-8 char
        const b = data[i];
        let len = 1;
        if ((b & 0xe0) === 0xc0) len = 2;
        else if ((b & 0xf0) === 0xe0) len = 3;
        else if ((b & 0xf8) === 0xf0) len = 4;
        handleKey(data.slice(i, i + len)); i += len;
      }
    }
  });

  // Cleanup on unexpected exit
  process.on("exit", () => {
    write(T.show + T.altOff + A.reset);
    if (process.stdin.isTTY) {
      try { process.stdin.setRawMode(false); } catch {}
    }
  });

  process.on("SIGTERM", exitApp);
}

export { main };
