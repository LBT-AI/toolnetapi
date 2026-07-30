import { loadConfig, saveConfig, getConfig } from "./config";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ChatSession {
  id: string;
  name: string;
  messages: Message[];
  model: string;
  agentMode: "build" | "plan";
  createdAt: number;
}

let sessions: ChatSession[] = [];
let currentIndex = 0;
let nextId = 1;
let _onChange: (() => void) | null = null;

const SESSION_NAMES = ["Main", "Explore", "Debug", "Refactor", "Review", "Docs", "Test", "Deploy"];

function generateId(): string {
  return `sess_${nextId++}_${Date.now()}`;
}

function defaultName(index: number): string {
  if (index < SESSION_NAMES.length) return SESSION_NAMES[index];
  return `Session ${index + 1}`;
}

export function onSessionsChange(fn: () => void) {
  _onChange = fn;
}

function notify() {
  if (_onChange) _onChange();
}

function persistSessionNames() {
  const cfg = getConfig();
  const names: Record<string, string> = {};
  for (const s of sessions) {
    names[s.id] = s.name;
  }
  cfg.sessionNames = names;
  cfg.sessionOrder = sessions.map(s => s.id);
  cfg.lastSession = sessions[currentIndex]?.id ?? null;
  saveConfig();
}

function loadSessionNames() {
  const cfg = getConfig();
  for (const s of sessions) {
    const saved = cfg.sessionNames[s.id];
    if (saved) s.name = saved;
  }
}

export function initSessions(): void {
  const cfg = getConfig();
  if (cfg.sessionOrder.length > 0) {
    for (const id of cfg.sessionOrder) {
      const name = cfg.sessionNames[id] || "";
      sessions.push({
        id,
        name,
        messages: [],
        model: cfg.defaultModel,
        agentMode: "build",
        createdAt: Date.now(),
      });
    }
  }
  if (sessions.length === 0) {
    sessions.push({
      id: generateId(),
      name: defaultName(0),
      messages: [
        { role: "assistant", content: "Hello! I'm TOOLNET, your AI coding assistant.\nType a message or /help to get started." },
      ],
      model: cfg.defaultModel,
      agentMode: "build",
      createdAt: Date.now(),
    });
  }
  if (cfg.lastSession) {
    const idx = sessions.findIndex(s => s.id === cfg.lastSession);
    if (idx >= 0) currentIndex = idx;
  }
  loadSessionNames();
  notify();
}

export function getSessions(): ChatSession[] {
  return sessions;
}

export function getCurrentSession(): ChatSession {
  return sessions[currentIndex];
}

export function getCurrentIndex(): number {
  return currentIndex;
}

export function switchSession(index: number): boolean {
  if (index < 0 || index >= sessions.length) return false;
  currentIndex = index;
  persistSessionNames();
  notify();
  return true;
}

export function switchSessionById(id: string): boolean {
  const idx = sessions.findIndex(s => s.id === id);
  return switchSession(idx);
}

export function newSession(name?: string): ChatSession {
  const session: ChatSession = {
    id: generateId(),
    name: name || defaultName(sessions.length),
    messages: [
      { role: "assistant", content: "New session started. How can I help you?" },
    ],
    model: getCurrentSession().model,
    agentMode: getCurrentSession().agentMode,
    createdAt: Date.now(),
  };
  sessions.push(session);
  currentIndex = sessions.length - 1;
  persistSessionNames();
  notify();
  return session;
}

export function removeSession(index: number): boolean {
  if (sessions.length <= 1) return false;
  if (index < 0 || index >= sessions.length) return false;
  sessions.splice(index, 1);
  if (currentIndex >= sessions.length) currentIndex = sessions.length - 1;
  persistSessionNames();
  notify();
  return true;
}

export function renameSession(index: number, name: string): boolean {
  if (index < 0 || index >= sessions.length) return false;
  sessions[index].name = name;
  persistSessionNames();
  notify();
  return true;
}

export function addMessage(role: "user" | "assistant", content: string): void {
  const session = getCurrentSession();
  session.messages.push({ role, content });
  notify();
}

export function setModel(model: string): void {
  getCurrentSession().model = model;
  persistSessionNames();
  notify();
}

export function setAgentMode(mode: "build" | "plan"): void {
  getCurrentSession().agentMode = mode;
  notify();
}

export function toggleAgentMode(): void {
  const session = getCurrentSession();
  session.agentMode = session.agentMode === "build" ? "plan" : "build";
  notify();
}

export function getSessionCount(): number {
  return sessions.length;
}
