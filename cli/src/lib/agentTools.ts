import { toolBash, toolRead, toolWrite } from "./codingAgent";

export const agentTools = [
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Run a bash shell command on the user's local machine.",
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
      description: "Read a file from the user's filesystem.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
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
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"]
      }
    }
  }
];

export async function executeTool(name: string, args: any): Promise<string> {
  try {
    if (name === "run_command") {
      const res = await toolBash(args.command, 30000);
      return res.success ? (res.data || "") : (res.error || "");
    } else if (name === "read_file") {
      const res = toolRead(args.path);
      return res.success ? (res.data || "") : (res.error || "");
    } else if (name === "write_file") {
      const res = toolWrite(args.path, args.content);
      return res.success ? (res.data || "") : (res.error || "");
    } else {
      return "Unknown tool: " + name;
    }
  } catch (e: any) {
    return "Error executing tool: " + e.message;
  }
}
