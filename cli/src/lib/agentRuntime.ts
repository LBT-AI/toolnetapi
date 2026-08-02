import { detectGatewayUrl } from "./gateway";
import { agentTools, executeTool } from "./agentTools";

export interface AgentRuntimeOptions {
  model?: string;
  gatewayUrl?: string;
  maxTurns?: number;
  timeoutMs?: number;
  onEvent?: (event: string, data: any) => void;
}

export interface AgentRuntimeResult {
  success: boolean;
  output: string;
  toolCallsCount: number;
  turnsUsed: number;
  error?: string;
}

const AGENT_SYSTEM_PROMPT = `You are ToolNet Agent, an advanced AI coding assistant.
Your goal is to solve the user request accurately using available tools.

Guidelines:
1. Prefer dedicated tools over bash commands when possible:
   - Use 'read_file' to view file content.
   - Use 'edit_file' for precise string replacement in files.
   - Use 'replace_all' for global string replacements in a file.
   - Use 'grep_search' for searching code text across files.
   - Use 'glob_search' for locating files by pattern.
   - Use 'write_file' for creating new files.
   - Use 'run_command' for shell execution (run 'pwd'/'ls' if unsure of directories).
2. COMPLETE THE QA LOOP (Automatic Verification):
   - Whenever you edit or create code files, you MUST automatically detect the project framework (by checking package.json, scripts, config files).
   - Automatically run the appropriate verification commands (e.g. typecheck, lint, build, or unit tests) using 'run_command'.
   - If a test or command fails, read the stderr/stdout, identify the root cause, fix the code, and re-verify. 
   - Limit retry attempts to avoid infinite loops. Only report completion when verification passes.
   - For sandboxed artifact testing, use 'mktemp -d' to create a clean temporary workspace if needed.
3. Complete tasks efficiently in minimum iterations.
4. ALWAYS provide a final textual response summarizing your work when tool iterations finish.`;

export class AgentRuntime {
  private gatewayUrl: string;
  private maxTurns: number;
  private timeoutMs: number;

  constructor(options: AgentRuntimeOptions = {}) {
    this.gatewayUrl = options.gatewayUrl || detectGatewayUrl();
    this.maxTurns = options.maxTurns ?? 30;
    this.timeoutMs = options.timeoutMs ?? 60000;
  }

  /**
   * Executes a full ReAct tool loop for a user request.
   * Can be invoked from REPL, TUI, or CLI headless mode.
   */
  async runLoop(
    messages: Array<{ role: string; content: string; tool_calls?: any[]; tool_call_id?: string; name?: string }>,
    options: AgentRuntimeOptions = {}
  ): Promise<AgentRuntimeResult> {
    const startTime = Date.now();
    const model = options.model || "default";
    const maxTurns = options.maxTurns || this.maxTurns;
    const onEvent = options.onEvent;

    // Ensure system prompt is present
    if (!messages.some((m) => m.role === "system")) {
      messages.unshift({ role: "system", content: AGENT_SYSTEM_PROMPT });
    }

    let turnCount = 0;
    let toolCallsCount = 0;
    const toolCallHistory: string[] = [];

    while (turnCount < maxTurns) {
      turnCount++;

      if (Date.now() - startTime > this.timeoutMs) {
        return {
          success: false,
          output: "",
          toolCallsCount,
          turnsUsed: turnCount,
          error: `Execution timed out after ${this.timeoutMs}ms`,
        };
      }

      // Filter out temporary TUI placeholders
      let apiMessages = messages.filter((m) => m.content !== "Thinking...");

      // Sliding window context truncation
      const MAX_CONTEXT_CHARS = 32000;
      let totalLength = apiMessages.reduce((sum, m) => sum + (m.content ? m.content.length : 0), 0);
      if (totalLength > MAX_CONTEXT_CHARS && apiMessages.length > 2) {
        const sys = apiMessages[0];
        const rest = apiMessages.slice(1);
        while (totalLength > MAX_CONTEXT_CHARS && rest.length > 2) {
          const removed = rest.shift();
          totalLength -= (removed?.content?.length || 0);
        }
        apiMessages = [sys, ...rest];
      }

      let response: Response;
      try {
        response = await fetch(`${this.gatewayUrl}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: apiMessages,
            tools: agentTools,
            tool_choice: "auto",
            temperature: 0.1,
          }),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (netErr: any) {
        return {
          success: false,
          output: "",
          toolCallsCount,
          turnsUsed: turnCount,
          error: `Gateway connection error: ${netErr.message}`,
        };
      }

      if (!response.ok) {
        const errText = await response.text();
        return {
          success: false,
          output: "",
          toolCallsCount,
          turnsUsed: turnCount,
          error: `HTTP ${response.status}: ${errText}`,
        };
      }

      const data = await response.json();
      const assistantMsg = data.choices?.[0]?.message;

      if (!assistantMsg) {
        return {
          success: false,
          output: "",
          toolCallsCount,
          turnsUsed: turnCount,
          error: "Invalid assistant response from model gateway",
        };
      }

      messages.push(assistantMsg);
      if (onEvent) onEvent("ASSISTANT_MESSAGE", assistantMsg);

      const toolCalls = assistantMsg.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        // Loop finished, final textual answer obtained
        return {
          success: true,
          output: assistantMsg.content || "Task completed.",
          toolCallsCount,
          turnsUsed: turnCount,
        };
      }

      // Execute tool calls
      for (const call of toolCalls) {
        const toolName = call.function.name;
        const toolArgsStr = call.function.arguments || "{}";
        let toolArgs: any = {};
        try {
          toolArgs = JSON.parse(toolArgsStr);
        } catch {}

        // Infinite loop detection: trigger abort if the same call signature appears 3 times
        const callSignature = `${toolName}:${JSON.stringify(toolArgs)}`;
        const repeatCount = toolCallHistory.filter((sig) => sig === callSignature).length;
        if (repeatCount >= 2) {
          const loopErr = `Infinite loop detected: tool '${toolName}' was called 3 times with identical arguments. Aborting loop.`;
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            name: toolName,
            content: JSON.stringify({ stdout: "", stderr: loopErr, exitCode: 1 }),
          });
          return {
            success: false,
            output: "",
            toolCallsCount,
            turnsUsed: turnCount,
            error: loopErr,
          };
        }
        toolCallHistory.push(callSignature);

        toolCallsCount++;
        if (onEvent) onEvent("TOOL_START", { toolName, toolArgs, id: call.id });

        const resultJson = await executeTool(toolName, toolArgs);

        if (onEvent) onEvent("TOOL_END", { toolName, result: resultJson, id: call.id });

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: toolName,
          content: resultJson,
        });
      }
    }

    return {
      success: false,
      output: "",
      toolCallsCount,
      turnsUsed: maxTurns,
      error: `Agent reached maximum iteration limit (${maxTurns} turns)`,
    };
  }
}
