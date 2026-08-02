import { test, expect, describe, beforeEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import {
  toolBash,
  toolRead,
  toolWrite,
  getCwdInfo
} from "../../lib/codingAgent";

describe("codingAgent Cross-Workspace Filesystem & CWD Tracking", () => {
  const testRoot = path.resolve(process.cwd(), "test_sandbox");
  const extDir = path.resolve(testRoot, "external_project");
  
  beforeEach(() => {
    // Reset test environment
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
    fs.mkdirSync(testRoot, { recursive: true });
    fs.mkdirSync(extDir, { recursive: true });
    fs.writeFileSync(path.join(extDir, "hello.txt"), "external hello", "utf8");
  });

  test("toolBash tracks CWD changes across commands", async () => {
    // Navigate to external dir
    const res1 = await toolBash(`cd ${extDir}`);
    expect(res1.success).toBe(true);
    
    // Check if CWD state is correctly synchronized
    const { currentCwd: newCwd } = getCwdInfo();
    expect(newCwd).toBe(extDir);

    // Ensure subsequent shell commands use the updated CWD
    const res2 = await toolBash(`pwd`);
    expect(res2.success).toBe(true);
    expect(res2.stdout?.trim()).toBe(extDir);
    
    // Ensure ls lists the external directory
    const res3 = await toolBash(`ls hello.txt`);
    expect(res3.success).toBe(true);
    expect(res3.stdout?.trim()).toBe("hello.txt");
  });

  test("Filesystem tools resolve absolute paths bypassing default CWD", () => {
    const absPath = path.join(extDir, "hello.txt");
    
    // toolRead should access absolute path even if CWD is not there
    const readRes = toolRead(absPath);
    expect(readRes.success).toBe(true);
    expect(readRes.data).toBe("external hello");

    // toolWrite should write to absolute path correctly
    const writePath = path.join(extDir, "new.txt");
    const writeRes = toolWrite(writePath, "new external data");
    expect(writeRes.success).toBe(true);
    expect(fs.readFileSync(writePath, "utf8")).toBe("new external data");
  });

  test("Filesystem tools resolve relative paths based on dynamic CWD", async () => {
    // CD into external dir
    await toolBash(`cd ${extDir}`);
    
    // Read relative path
    const readRes = toolRead("hello.txt");
    expect(readRes.success).toBe(true);
    expect(readRes.data).toBe("external hello");
  });
});
