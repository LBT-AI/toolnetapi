import fs from "node:fs";
import path from "node:path";
import { pushSnapshot, commitSnapshot } from "./history";

export interface ToolResult {
  success: boolean;
  data?: string;
  error?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  truncated?: boolean;
}

export let currentCwd = process.cwd();
export let workspaceRoot = process.cwd();
export let bypassPolicy = false;

export function getCwdInfo() {
  return { currentCwd, workspaceRoot, bypassPolicy };
}

export function setCwd(newPath: string) {
  const abs = path.resolve(currentCwd, newPath);
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    currentCwd = abs;
    return true;
  }
  return false;
}

function resolvePath(filePath: string): string {
  return path.resolve(currentCwd, filePath);
}

function checkAccess(absPath: string): { allowed: boolean; error?: string } {
  if (bypassPolicy) return { allowed: true };
  
  // OS-level permission is the primary boundary if bypassing, but by default we allow
  // anything the Node process can access. The user explicitly asked that CWD is not a boundary
  // and absolute paths should work if OS permits.
  // "Nếu user yêu cầu /root, /var/www, /home/... thì run_command phải truy cập được"
  // So access is always allowed as long as the OS doesn't throw EACCES.
  // We'll return true here and let fs operations throw naturally, unless specifically blocked.
  return { allowed: true };
}

const MAX_OUTPUT_LINES = 500;
const MAX_OUTPUT_CHARS = 50000;

function truncateOutput(text: string): { data: string; truncated: boolean } {
  if (text.length <= MAX_OUTPUT_CHARS) return { data: text, truncated: false };
  return { data: text.slice(0, MAX_OUTPUT_CHARS) + `\n... (truncated, ${text.length - MAX_OUTPUT_CHARS} more chars)`, truncated: true };
}

export function toolRead(filePath: string, offset = 0, limit = MAX_OUTPUT_LINES): ToolResult {
  try {
    const absPath = resolvePath(filePath);
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
    const absPath = resolvePath(searchPath);
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
    const absPath = resolvePath(searchPath);
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
    const absPath = resolvePath(filePath);
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
    return { success: true, data: `Edited ${path.relative(currentCwd, absPath)}: replaced "${oldString}" → "${newString}"` };
  } catch (err: unknown) {
    return { success: false, error: `Edit error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export function toolReplaceAll(filePath: string, oldString: string, newString: string): ToolResult {
  try {
    const absPath = resolvePath(filePath);
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
    return { success: true, data: `Replaced ${count} occurrence(s) in ${path.relative(currentCwd, absPath)}` };
  } catch (err: unknown) {
    return { success: false, error: `ReplaceAll error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export function toolWrite(filePath: string, content: string): ToolResult {
  try {
    const absPath = resolvePath(filePath);
    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    pushSnapshot(absPath, `write: ${path.basename(absPath)}`);
    fs.writeFileSync(absPath, content, "utf8");
    commitSnapshot(absPath);
    return { success: true, data: `Written ${content.length} bytes to ${path.relative(currentCwd, absPath)}` };
  } catch (err: unknown) {
    return { success: false, error: `Write error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function toolBash(command: string, timeoutMs = 30000): Promise<ToolResult> {
  const { exec } = require("node:child_process");
  return new Promise((resolve) => {
    // Inject a trap to capture the final PWD after the command executes
    const wrappedCommand = `${command}\necho "---CWD---"\npwd`;
    
    exec(wrappedCommand, {
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      cwd: currentCwd,
    }, (error: any, stdout: string, stderr: string) => {
      let finalStdout = stdout || "";
      const cwdMarkerIdx = finalStdout.lastIndexOf("---CWD---");
      
      if (cwdMarkerIdx !== -1) {
        const afterMarker = finalStdout.substring(cwdMarkerIdx + 9).trim();
        const newCwd = afterMarker.split("\n")[0].trim();
        if (newCwd && newCwd.startsWith("/")) {
          if (fs.existsSync(newCwd)) {
            currentCwd = newCwd; // Sync the agent's virtual CWD with the bash session
          }
        }
        finalStdout = finalStdout.substring(0, cwdMarkerIdx).trim();
      }

      const exitCode = error ? (error.code ?? 1) : 0;
      const { data: stdoutData, truncated: stdoutTrunc } = truncateOutput(finalStdout);
      const { data: stderrData, truncated: stderrTrunc } = truncateOutput(stderr || "");
      
      if (error) {
        const combined = [stderrData, stdoutData].filter(Boolean).join("\\n").trim();
        resolve({
          success: false,
          error: combined || error.message,
          data: combined || error.message,
          stdout: stdoutData,
          stderr: stderrData,
          exitCode,
          truncated: stdoutTrunc || stderrTrunc
        });
      } else {
        const data = stdoutData.trim() || "(no output)";
        resolve({
          success: true,
          data,
          stdout: stdoutData,
          stderr: stderrData,
          exitCode,
          truncated: stdoutTrunc || stderrTrunc
        });
      }
    });
  });
}
