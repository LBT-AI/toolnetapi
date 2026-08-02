import fs from "node:fs";
import path from "node:path";
import type { Command, CommandContext } from "./index";
import { toolBash, currentCwd } from "../lib/codingAgent";

// ─── Types ───────────────────────────────────────────────────────────────────

interface QaStep {
  label: string;
  command: string;
  suggestion: string;
}

// ─── Framework detection ──────────────────────────────────────────────────────

function detectSteps(cwd: string): QaStep[] {
  const has = (file: string) => fs.existsSync(path.join(cwd, file));

  // Node / Bun project
  if (has("package.json")) {
    let pkg: Record<string, unknown> = {};
    try {
      pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));
    } catch {
      // ignore parse errors — treat as no scripts
    }
    const scripts = (pkg.scripts ?? {}) as Record<string, string>;
    const steps: QaStep[] = [];

    if (scripts.typecheck) {
      steps.push({
        label: "typecheck",
        command: "npm run typecheck",
        suggestion: "Fix TypeScript errors reported above.",
      });
    }
    if (scripts.test) {
      steps.push({
        label: "tests",
        command: "npm test",
        suggestion: "Fix failing tests reported above.",
      });
    }
    if (steps.length > 0) return steps;

    // package.json exists but no relevant scripts — fall through to Makefile check
  }

  // Rust project
  if (has("Cargo.toml")) {
    return [
      {
        label: "cargo check",
        command: "cargo check",
        suggestion: "Fix Rust compilation errors reported above.",
      },
      {
        label: "cargo test",
        command: "cargo test",
        suggestion: "Fix failing Rust tests reported above.",
      },
    ];
  }

  // Python project
  if (has("pyproject.toml")) {
    return [
      {
        label: "pytest",
        command: "python -m pytest",
        suggestion: "Fix failing Python tests reported above.",
      },
      {
        label: "mypy",
        command: "python -m mypy .",
        suggestion: "Fix Python type errors reported above.",
      },
    ];
  }

  // Go project
  if (has("go.mod")) {
    return [
      {
        label: "go build",
        command: "go build ./...",
        suggestion: "Fix Go compilation errors reported above.",
      },
      {
        label: "go test",
        command: "go test ./...",
        suggestion: "Fix failing Go tests reported above.",
      },
    ];
  }

  // Makefile with a test target
  if (has("Makefile")) {
    const makefile = (() => {
      try {
        return fs.readFileSync(path.join(cwd, "Makefile"), "utf8");
      } catch {
        return "";
      }
    })();
    if (/^test\s*:/m.test(makefile)) {
      return [
        {
          label: "make test",
          command: "make test",
          suggestion: "Fix errors reported by make test above.",
        },
      ];
    }
  }

  // Fallback: list files
  return [
    {
      label: "directory listing",
      command: `ls -la "${cwd}"`,
      suggestion: "No recognized build system found in this directory.",
    },
  ];
}

// ─── QA loop ─────────────────────────────────────────────────────────────────

async function runQaLoop(
  cwd: string,
  addMessage: CommandContext["addMessage"]
): Promise<void> {
  const steps = detectSteps(cwd);

  addMessage(
    "assistant",
    `\x1b[36mQA verification starting in:\x1b[0m ${cwd}\n` +
      `Found ${steps.length} step(s): ${steps.map((s) => s.label).join(", ")}`
  );

  let retryCount = 0;
  const MAX_FAILURES = 3;
  const summaryLines: string[] = [];

  for (const step of steps) {
    if (retryCount >= MAX_FAILURES) {
      addMessage(
        "assistant",
        `\x1b[33m⚠ Stopped after ${MAX_FAILURES} failures.\x1b[0m`
      );
      break;
    }

    addMessage("assistant", `Running: \x1b[90m${step.command}\x1b[0m`);

    const result = await toolBash(`cd "${cwd}" && ${step.command}`, 120_000);
    const exitCode = result.exitCode ?? (result.success ? 0 : 1);

    if (exitCode === 0) {
      const line = `\x1b[32m✓\x1b[0m ${step.label} passed`;
      summaryLines.push(line);
      addMessage("assistant", line);
    } else {
      retryCount++;
      const stderr =
        result.stderr?.trim() || result.error?.trim() || "(no output)";
      const line = `\x1b[31m✗\x1b[0m ${step.label} failed (exit ${exitCode})`;
      summaryLines.push(line);
      addMessage(
        "assistant",
        `${line}\n\n${stderr}\n\n\x1b[33mSuggestion:\x1b[0m ${step.suggestion}`
      );
    }
  }

  addMessage(
    "assistant",
    `\n\x1b[36m── QA Summary ──\x1b[0m\n${summaryLines.join("\n")}`
  );
}

// ─── Command export ───────────────────────────────────────────────────────────

export const qaCommand: Command = {
  name: "qa",
  aliases: ["verify"],
  description:
    "Run a QA verification loop (typecheck, tests, build) on the current workspace",
  usage: "/qa [path]",
  async handler(args: string[], ctx: CommandContext) {
    const { addMessage } = ctx;
    const targetDir =
      args.length > 0 ? path.resolve(args[0]) : currentCwd;

    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
      addMessage(
        "assistant",
        `\x1b[31mError:\x1b[0m Not a directory: ${targetDir}`
      );
      return;
    }

    await runQaLoop(targetDir, addMessage);
  },
};
