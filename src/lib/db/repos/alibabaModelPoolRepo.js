import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";
import { ALIBABA_GROUP_NAMES } from "@/shared/constants/alibabaModelGroup.js";

export { ALIBABA_GROUP_NAMES };

// Per-model token quota defaults (tokens). A model holds its own quota limit,
// e.g. Alibaba Studio grants each model 1,000,000 tokens.
export const DEFAULT_QUOTA_LIMIT = 1_000_000;
export const DEFAULT_QUOTA_PERIOD_DAYS = 30;

function toInt(val, fallback) {
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function rowToPool(row) {
  if (!row) return null;
  return {
    id: row.id,
    connectionId: row.connectionId,
    groupName: row.groupName,
    models: parseJson(row.models, []),
    quotaLimit: toInt(row.quotaLimit, DEFAULT_QUOTA_LIMIT),
    quotaPeriodDays: toInt(row.quotaPeriodDays, DEFAULT_QUOTA_PERIOD_DAYS),
    isActive: row.isActive === 1 || row.isActive === true,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getAlibabaModelPools(filter = {}) {
  const db = await getAdapter();
  const where = [];
  const params = [];
  if (filter.connectionId) { where.push("connectionId = ?"); params.push(filter.connectionId); }
  if (filter.groupName) { where.push("groupName = ?"); params.push(filter.groupName); }
  if (filter.isActive !== undefined) { where.push("isActive = ?"); params.push(filter.isActive ? 1 : 0); }
  const sql = `SELECT * FROM alibabaModelPools${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY groupName ASC`;
  const rows = db.all(sql, params);
  return rows.map(rowToPool);
}

export async function getAlibabaModelPoolById(id) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM alibabaModelPools WHERE id = ?`, [id]);
  return rowToPool(row);
}

export async function getAlibabaModelPoolByGroup(connectionId, groupName) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM alibabaModelPools WHERE connectionId = ? AND groupName = ?`, [connectionId, groupName]);
  return rowToPool(row);
}

export async function upsertAlibabaModelPool(connectionId, groupName, models, options = {}) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  const quotaLimit = toInt(options.quotaLimit, DEFAULT_QUOTA_LIMIT);
  const quotaPeriodDays = toInt(options.quotaPeriodDays, DEFAULT_QUOTA_PERIOD_DAYS);
  let result;
  db.transaction(() => {
    const existing = db.get(`SELECT * FROM alibabaModelPools WHERE connectionId = ? AND groupName = ?`, [connectionId, groupName]);
    if (existing) {
      db.run(
        `UPDATE alibabaModelPools SET models = ?, quotaLimit = ?, quotaPeriodDays = ?, isActive = 1, updatedAt = ? WHERE id = ?`,
        [stringifyJson(models), quotaLimit, quotaPeriodDays, now, existing.id]
      );
      result = rowToPool({ ...existing, models: stringifyJson(models), quotaLimit, quotaPeriodDays, isActive: 1, updatedAt: now });
    } else {
      const id = uuidv4();
      db.run(
        `INSERT INTO alibabaModelPools(id, connectionId, groupName, models, quotaLimit, quotaPeriodDays, isActive, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [id, connectionId, groupName, stringifyJson(models), quotaLimit, quotaPeriodDays, now, now]
      );
      result = { id, connectionId, groupName, models, quotaLimit, quotaPeriodDays, isActive: true, createdAt: now, updatedAt: now };
    }
  });
  return result;
}

export async function deleteAlibabaModelPool(id) {
  const db = await getAdapter();
  const res = db.run(`DELETE FROM alibabaModelPools WHERE id = ?`, [id]);
  return (res?.changes ?? 0) > 0;
}

export async function deleteAlibabaModelPoolsByConnection(connectionId) {
  const db = await getAdapter();
  const before = db.get(`SELECT COUNT(*) AS n FROM alibabaModelPools WHERE connectionId = ?`, [connectionId]);
  db.run(`DELETE FROM alibabaModelPools WHERE connectionId = ?`, [connectionId]);
  return before?.n || 0;
}
