import fs from "node:fs";
import path from "node:path";
import { pushSnapshot, commitSnapshot } from "./history";

export interface ToolResult {
  success: boolean;
  data?: string;
  error?: string;
  truncated?: boolean;
}

const MAX_OUTPUT_LINES = 500;
const MAX_OUTPUT_CHARS = 50000;

function truncateOutput(text: string): { data: string; truncated: boolean } {
  if (text.length <= MAX_OUTPUT_CHARS) return { data: text, truncated: false };
  return { data: text.slice(0, MAX_OUTPUT_CHARS) + `\n... (truncated, ${text.length - MAX_OUTPUT_CHARS} more chars)`, truncated: true };
}

export function toolRead(filePath: string, offset = 0, limit = MAX_OUTPUT_LINES): ToolResult {
  try {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) return { success: false, error: `File not found: ${absPath}` };
    const stat = fs.statSync(absPath);
    if (!stat.isFile()) return { success: false, error: `Not a file: ${absPath}` };

    const content = fs.readFileSync(absPath, "utf8");
    const lines = content.split("\n");

    const startLine = Math.max(0, offset);
    const endLine = limit > 0 ? Math.min(lines.length, startLine + limit) : lines.length;
    const selected = lines.slice(startLine, endLine);

    let result = selected.join("\n");
    if (endLine < lines.length) {
      result += `\n... (${lines.length - endLine} more lines)`;
    }

    const { data, truncated } = truncateOutput(result);
    return { success: true, data, truncated };
  } catch (err: unknown) {
    return { success: false, error: `Read error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export function toolGlob(pattern: string, searchPath = "."): ToolResult {
  try {
    const absPath = path.resolve(searchPath);
    if (!fs.existsSync(absPath)) return { success: false, error: `Path not found: ${absPath}` };

    const { Glob } = require("bun") as any;
    const glob = new Glob(pattern);
    const matches: string[] = [];
    let count = 0;
    for (const match of glob.scanSync({ cwd: absPath, absolute: false })) {
      if (count >= 1000) {
        matches.push(`... (1000+ matches, truncated)`);
        break;
      }
      matches.push(match);
      count++;
    }

    if (matches.length === 0) return { success: true, data: "No matches found." };
    const result = matches.join("\n");
    return { success: true, data: `${matches.length} match(es):\n${result}` };
  } catch (err: unknown) {
    return { success: false, error: `Glob error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export function toolGrep(pattern: string, searchPath = ".", include?: string): ToolResult {
  try {
    const absPath = path.resolve(searchPath);
    if (!fs.existsSync(absPath)) return { success: false, error: `Path not found: ${absPath}` };
    const stat = fs.statSync(absPath);
    if (!stat.isDirectory()) return { success: false, error: `Not a directory: ${absPath}` };

    const regex = new RegExp(pattern, "g");
    const results: string[] = [];
    let fileCount = 0;
    let totalLines = 0;

    function walkDir(dir: string): void {
      if (totalLines >= MAX_OUTPUT_LINES) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (totalLines >= MAX_OUTPUT_LINES) return;
          if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else if (entry.isFile()) {
            if (include && !entry.name.endsWith(include.replace("*", ""))) continue;
            try {
              const content = fs.readFileSync(fullPath, "utf8");
              const lines = content.split("\n");
              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  const relPath = path.relative(absPath, fullPath);
                  results.push(`${relPath}:${i + 1}: ${lines[i].trim()}`);
                  totalLines++;
                  regex.lastIndex = 0;
                  if (totalLines >= MAX_OUTPUT_LINES) break;
                }
              }
              fileCount++;
            } catch {}
          }
        }
      } catch {}
    }

    walkDir(absPath);

    if (results.length === 0) return { success: true, data: "No matches found." };
    const result = results.join("\n");
    const truncated = totalLines >= MAX_OUTPUT_LINES;
    return { success: true, data: `${results.length} match(es) in ${fileCount} file(s):\n${result}${truncated ? "\n... (truncated)" : ""}` };
  } catch (err: unknown) {
    return { success: false, error: `Grep error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export function toolEdit(filePath: string, oldString: string, newString: string): ToolResult {
  try {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) return { success: false, error: `File not found: ${absPath}` };
    const stat = fs.statSync(absPath);
    if (!stat.isFile()) return { success: false, error: `Not a file: ${absPath}` };

    const content = fs.readFileSync(absPath, "utf8");
    const idx = content.indexOf(oldString);
    if (idx === -1) return { success: false, error: `"${oldString}" not found in file` };

    const newContent = content.replace(oldString, newString);
    if (newContent === content) return { success: false, error: "No changes made (oldString == newString?)" };

    pushSnapshot(absPath, `edit: replace "${oldString.substring(0, 40)}" in ${path.basename(absPath)}`);
    fs.writeFileSync(absPath, newContent, "utf8");
    commitSnapshot(absPath);
    return { success: true, data: `Edited ${path.relative(process.cwd(), absPath)}: replaced "${oldString}" → "${newString}"` };
  } catch (err: unknown) {
    return { success: false, error: `Edit error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export function toolReplaceAll(filePath: string, oldString: string, newString: string): ToolResult {
  try {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) return { success: false, error: `File not found: ${absPath}` };
    const stat = fs.statSync(absPath);
    if (!stat.isFile()) return { success: false, error: `Not a file: ${absPath}` };

    const content = fs.readFileSync(absPath, "utf8");
    const newContent = content.replaceAll(oldString, newString);
    if (newContent === content) return { success: false, error: "No matches found" };

    pushSnapshot(absPath, `replaceAll: "${oldString.substring(0, 40)}" in ${path.basename(absPath)}`);
    fs.writeFileSync(absPath, newContent, "utf8");
    commitSnapshot(absPath);
    const count = (content.match(new RegExp(oldString.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
    return { success: true, data: `Replaced ${count} occurrence(s) in ${path.relative(process.cwd(), absPath)}` };
  } catch (err: unknown) {
    return { success: false, error: `ReplaceAll error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export function toolWrite(filePath: string, content: string): ToolResult {
  try {
    const absPath = path.resolve(filePath);
    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    pushSnapshot(absPath, `write: ${path.basename(absPath)}`);
    fs.writeFileSync(absPath, content, "utf8");
    commitSnapshot(absPath);
    return { success: true, data: `Written ${content.length} bytes to ${path.relative(process.cwd(), absPath)}` };
  } catch (err: unknown) {
    return { success: false, error: `Write error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export function toolBash(command: string, timeoutMs = 30000): ToolResult {
  try {
    const { execSync } = require("node:child_process");
    const output = execSync(command, {
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      cwd: process.cwd(),
    });

    const { data, truncated } = truncateOutput(output.trim() || "(no output)");
    return { success: true, data, truncated };
  } catch (err: any) {
    if (err.stdout || err.stderr) {
      const combined = [err.stderr, err.stdout].filter(Boolean).join("\n").trim();
      return { success: false, error: combined || err.message, data: combined || err.message };
    }
    return { success: false, error: `Bash error: ${err.message}` };
  }
}
