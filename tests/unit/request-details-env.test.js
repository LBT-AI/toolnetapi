// Priority chain for request-log observability:
//   ENABLE_REQUEST_LOGS (force) > dashboard UI setting > OBSERVABILITY_ENABLED fallback
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

let tempDir;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "toolnetapi-reqlogs-"));
});

afterAll(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
  delete process.env.ENABLE_REQUEST_LOGS;
  vi.resetModules();
});

async function resetDb() {
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  const db = await import("@/lib/db/index.js");
  await db.initDb();
  const { getAdapter } = await import("@/lib/db/driver.js");
  const adapter = await getAdapter();
  adapter.run(`DELETE FROM requestDetails`);
  return { db, adapter };
}

async function save(db) {
  await db.saveRequestDetail({
    provider: "openai",
    model: "gpt-4",
    status: "ok",
    tokens: {},
    request: { method: "POST", headers: { authorization: "Bearer sk-secret" } },
    response: { content: "hi" },
  });
  await new Promise((r) => setTimeout(r, 130));
}

describe("ENABLE_REQUEST_LOGS env override", () => {
  beforeEach(async () => {
    process.env.DATA_DIR = tempDir;
  });

  it("ENABLE_REQUEST_LOGS=false forces logging OFF even when UI enables it", async () => {
    process.env.ENABLE_REQUEST_LOGS = "false";
    const { db, adapter } = await resetDb();
    await db.updateSettings({ enableObservability: true, observabilityBatchSize: 1 });

    await save(db);
    const cnt = adapter.get(`SELECT COUNT(*) AS c FROM requestDetails`);
    expect(cnt.c).toBe(0);
  });

  it("ENABLE_REQUEST_LOGS=true forces logging ON even when UI disables it", async () => {
    process.env.ENABLE_REQUEST_LOGS = "true";
    const { db, adapter } = await resetDb();
    await db.updateSettings({ enableObservability: false, observabilityBatchSize: 1 });

    await save(db);
    const cnt = adapter.get(`SELECT COUNT(*) AS c FROM requestDetails`);
    expect(cnt.c).toBeGreaterThan(0);

    // Sensitive headers never persist
    const { details } = await db.getRequestDetails({ pageSize: 50 });
    expect(JSON.stringify(details)).not.toMatch(/Bearer sk-secret/i);
  });

  it("env unset → UI setting governs (opt-in default off)", async () => {
    delete process.env.ENABLE_REQUEST_LOGS;
    const { db, adapter } = await resetDb();
    await db.updateSettings({ enableObservability: false, observabilityBatchSize: 1 });

    await save(db);
    const cnt = adapter.get(`SELECT COUNT(*) AS c FROM requestDetails`);
    expect(cnt.c).toBe(0);
  });
});