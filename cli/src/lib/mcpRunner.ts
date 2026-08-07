import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  disabled?: boolean;
}

export interface LocalMcpServer {
  name: string;
  config: McpServerConfig;
  sourceFile: string;
}

/**
 * Loads stdio MCP configurations from mcp.json or .gemini/mcp.json or .toolnet/mcp.json.
 * Supports both standard Claude Desktop style `{ "mcpServers": { "name": { "command": ... } } }`
 * and direct map formats `{ "name": { "command": ... } }`.
 * @param baseDir Optional base directory (defaults to process.cwd()).
 */
export function loadLocalMcpConfig(baseDir: string = process.cwd()): Record<string, McpServerConfig> {
  const candidatePaths = [
    path.join(baseDir, "mcp.json"),
    path.join(baseDir, ".gemini", "mcp.json"),
    path.join(baseDir, ".toolnet", "mcp.json"),
  ];

  const configs: Record<string, McpServerConfig> = {};

  for (const filePath of candidatePaths) {
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf8");
        const parsed = JSON.parse(raw);
        const servers = parsed.mcpServers || parsed.servers || parsed;

        if (servers && typeof servers === "object") {
          for (const [name, cfg] of Object.entries(servers)) {
            if (cfg && typeof cfg === "object" && typeof (cfg as any).command === "string") {
              if (!configs[name]) {
                configs[name] = cfg as McpServerConfig;
              }
            }
          }
        }
      } catch {
        // Ignore read/parse error gracefully
      }
    }
  }

  return configs;
}

/**
 * Returns array of LocalMcpServer objects including source file path information.
 * @param baseDir Optional base directory (defaults to process.cwd()).
 */
export function getLocalMcpServers(baseDir: string = process.cwd()): LocalMcpServer[] {
  const candidatePaths = [
    path.join(baseDir, "mcp.json"),
    path.join(baseDir, ".gemini", "mcp.json"),
    path.join(baseDir, ".toolnet", "mcp.json"),
  ];

  const serversMap = new Map<string, LocalMcpServer>();

  for (const filePath of candidatePaths) {
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf8");
        const parsed = JSON.parse(raw);
        const servers = parsed.mcpServers || parsed.servers || parsed;

        if (servers && typeof servers === "object") {
          for (const [name, cfg] of Object.entries(servers)) {
            if (cfg && typeof cfg === "object" && typeof (cfg as any).command === "string") {
              if (!serversMap.has(name)) {
                serversMap.set(name, {
                  name,
                  config: cfg as McpServerConfig,
                  sourceFile: filePath,
                });
              }
            }
          }
        }
      } catch {
        // Ignore parse error
      }
    }
  }

  return Array.from(serversMap.values());
}

/**
 * Spawns a stdio MCP server child process based on config.
 */
export function spawnMcpServer(name: string, config: McpServerConfig, baseDir: string = process.cwd()): ChildProcess {
  const env = { ...process.env, ...(config.env || {}) };
  const cwd = config.cwd ? path.resolve(baseDir, config.cwd) : baseDir;

  return spawn(config.command, config.args || [], {
    cwd,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });
}


function editLocalMcpConfig(
  baseDir: string,
  editor: (configs: Record<string, McpServerConfig>) => void
): void {
  const candidatePaths = [
    path.join(baseDir, "mcp.json"),
    path.join(baseDir, ".gemini", "mcp.json"),
    path.join(baseDir, ".toolnet", "mcp.json"),
  ];
  
  let targetPath = candidatePaths[1];
  let existingData: any = {};
  
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      targetPath = p;
      try {
        existingData = JSON.parse(fs.readFileSync(p, "utf8"));
      } catch {}
      break;
    }
  }

  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let targetField = "mcpServers";
  let configs = existingData.mcpServers || existingData.servers;
  if (!configs) {
    if (Object.keys(existingData).length > 0) {
      configs = existingData;
      targetField = "";
    } else {
      configs = {};
    }
  }

  editor(configs);

  if (targetField) {
    existingData[targetField] = configs;
  } else {
    existingData = configs;
  }

  fs.writeFileSync(targetPath, JSON.stringify(existingData, null, 2), "utf8");
}

export function addLocalMcpServer(name: string, config: McpServerConfig, baseDir: string = process.cwd()): void {
  editLocalMcpConfig(baseDir, (configs) => {
    configs[name] = config;
  });
}

export function removeLocalMcpServer(name: string, baseDir: string = process.cwd()): void {
  editLocalMcpConfig(baseDir, (configs) => {
    delete configs[name];
  });
}
