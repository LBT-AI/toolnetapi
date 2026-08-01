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

    const matches: string[] = [];
    let count = 0;

    const regexPattern = pattern
      .replace(/[.+^${}()|[\\]\\\\]/g, '\\\\$&')
      .replace(/\\\\\\*/g, '.*')
      .replace(/\\\\\\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);

    function walkDir(dir: string, relBase: string): void {
      if (count >= 1000) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (count >= 1000) return;
          if (entry.name.startsWith(".") && entry.name !== ".env") continue;
          if (entry.name === "node_modules") continue;

          const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
          if (regex.test(relPath) || regex.test(entry.name)) {
            matches.push(relPath);
            count++;
          }
          
          if (entry.isDirectory()) {
            walkDir(path.join(dir, entry.name), relPath);
          }
        }
      } catch {}
    }
    
    walkDir(absPath, "");

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

    const { spawnSync } = require("node:child_process");
    const args = ["-rnI"]; // recursive, line number, ignore binary
    // Emulate original exclusions: exclude hidden files and node_modules
    args.push("--exclude-dir=.*", "--exclude-dir=node_modules", "--exclude=.*");
    
    if (include) {
      args.push(`--include=${include}`);
    }
    args.push(pattern, ".");

    const result = spawnSync("grep", args, { cwd: absPath, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });

    if (result.error) {
      return { success: false, error: `Grep execution error: ${result.error.message}` };
    }

    if (result.status === 1) {
      return { success: true, data: "No matches found." };
    }

    if (result.status === 0) {
      const lines = result.stdout.trim().split("\n");
      const { data, truncated } = truncateOutput(`${lines.length} match(es):\n${result.stdout}`);
      return { success: true, data, truncated };
    }

    return { success: false, error: `Grep error: ${result.stderr}` };
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

export async function toolBash(command: string, timeoutMs = 30000): Promise<ToolResult> {
  const { exec } = require("node:child_process");
  return new Promise((resolve) => {
    exec(command, {
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      cwd: process.cwd(),
    }, (error: any, stdout: string, stderr: string) => {
      if (error) {
        const combined = [stderr, stdout].filter(Boolean).join("\n").trim();
        resolve({ success: false, error: combined || error.message, data: combined || error.message });
      } else {
        const { data, truncated } = truncateOutput(stdout.trim() || "(no output)");
        resolve({ success: true, data, truncated });
      }
    });
  });
}
