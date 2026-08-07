import { toolBash, toolRead, toolWrite, toolEdit, toolReplaceAll, toolGrep, toolGlob } from "./codingAgent";
import { resolve } from "node:path";

export const agentTools = [
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Run a bash shell command on the user's local machine. Use absolute paths or check CWD with pwd first.",
      parameters: {
        type: "object",
        properties: { command: { type: "string", description: "The bash command to run" } },
        required: ["command"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a file from the user's filesystem with optional line offset and limit.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to read" },
          offset: { type: "number", description: "Line offset to start reading from (0-indexed)" },
          limit: { type: "number", description: "Maximum number of lines to read" }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file on the user's filesystem.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to write to" },
          content: { type: "string", description: "File content to write" }
        },
        required: ["path", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description: "Replace exact string target in a file with new replacement string.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to edit" },
          old_string: { type: "string", description: "Exact target string to find and replace" },
          new_string: { type: "string", description: "New replacement string" }
        },
        required: ["path", "old_string", "new_string"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "replace_all",
      description: "Replace all occurrences of a string in a file with a new string.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to modify" },
          old_string: { type: "string", description: "Target string to replace" },
          new_string: { type: "string", description: "Replacement string" }
        },
        required: ["path", "old_string", "new_string"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "grep_search",
      description: "Search for text matching regex or substring pattern recursively in files.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Regex or substring to search for" },
          path: { type: "string", description: "Directory or file path to search in (default '.')" },
          include: { type: "string", description: "File pattern filter e.g. '*.ts'" }
        },
        required: ["pattern"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "glob_search",
      description: "Find files matching pattern recursively.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "File glob pattern e.g. '*.ts'" },
          path: { type: "string", description: "Directory to search from (default '.')" }
        },
        required: ["pattern"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_artifact",
      description: "Create an artifact in the .artifacts directory.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the artifact" },
          content: { type: "string", description: "Content of the artifact" }
        },
        required: ["name", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_artifact",
      description: "Update an existing artifact in the .artifacts directory.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the artifact" },
          content: { type: "string", description: "New content of the artifact" }
        },
        required: ["name", "content"]
      }
    }
  }
];

export function isDangerousCommand(name: string, args: any, cwd: string): boolean {
  if (name === "run_command") {
    const cmd = args.command || "";
    if (cmd.includes("rm -rf") || cmd.includes("mkfs") || cmd.includes("sudo")) return true;
    return false;
  }
  if (name === "write_file" || name === "edit_file" || name === "replace_all" || name === "create_artifact" || name === "update_artifact") {
    const targetPath = name.includes("artifact") ? `.artifacts/${args.name || ""}` : (args.path || "");
    try {
      const resolved = resolve(cwd, targetPath);
      const cwdResolved = resolve(cwd);
      if (!resolved.startsWith(cwdResolved)) {
        return true;
      }
    } catch {
      return true;
    }
  }
  return false;
}

export async function executeTool(name: string, args: any): Promise<string> {
  try {
    if (name === "run_command") {
      const res = await toolBash(args.command, 30000);
      return JSON.stringify({
        stdout: res.stdout || "",
        stderr: res.stderr || "",
        exitCode: res.exitCode
      });
    } else if (name === "read_file") {
      const res = toolRead(args.path, args.offset || 0, args.limit || 500);
      return JSON.stringify({
        stdout: res.data || "",
        stderr: res.error || "",
        exitCode: res.success ? 0 : 1
      });
    } else if (name === "write_file") {
      const res = toolWrite(args.path, args.content);
      return JSON.stringify({
        stdout: res.data || "",
        stderr: res.error || "",
        exitCode: res.success ? 0 : 1
      });
    } else if (name === "edit_file") {
      const oldStr = args.old_string || args.oldString || "";
      const newStr = args.new_string || args.newString || "";
      const res = toolEdit(args.path, oldStr, newStr);
      return JSON.stringify({
        stdout: res.data || "",
        stderr: res.error || "",
        exitCode: res.success ? 0 : 1
      });
    } else if (name === "replace_all") {
      const oldStr = args.old_string || args.oldString || "";
      const newStr = args.new_string || args.newString || "";
      const res = toolReplaceAll(args.path, oldStr, newStr);
      return JSON.stringify({
        stdout: res.data || "",
        stderr: res.error || "",
        exitCode: res.success ? 0 : 1
      });
    } else if (name === "grep_search") {
      const searchPath = args.path || ".";
      const res = toolGrep(args.pattern, searchPath, args.include);
      return JSON.stringify({
        stdout: res.data || "",
        stderr: res.error || "",
        exitCode: res.success ? 0 : 1
      });
    } else if (name === "glob_search") {
      const searchPath = args.path || ".";
      const res = toolGlob(args.pattern, searchPath);
      return JSON.stringify({
        stdout: res.data || "",
        stderr: res.error || "",
        exitCode: res.success ? 0 : 1
      });
    } else if (name === "create_artifact" || name === "update_artifact") {
      const artifactName = args.name || "";
      const content = args.content || "";
      if (!artifactName) {
        return JSON.stringify({ stdout: "", stderr: "Missing artifact name", exitCode: 1 });
      }
      const targetPath = `.artifacts/${artifactName}`;
      const res = toolWrite(targetPath, content);
      return JSON.stringify({
        stdout: res.success ? `Artifact ${name === "create_artifact" ? "created" : "updated"}: ${artifactName}` : "",
        stderr: res.error || "",
        exitCode: res.success ? 0 : 1
      });
    } else {
      return JSON.stringify({ stdout: "", stderr: `Unknown tool: ${name}`, exitCode: 1 });
    }
  } catch (e: any) {
    return JSON.stringify({ stdout: "", stderr: `Error executing tool: ${e.message}`, exitCode: 1 });
  }
}
