import mysql from "mysql2/promise";
import { beforeAll, beforeEach } from "vitest";
import { getDbConfig } from "../../../scripts/lib/db-config.js";
import { runMigrations } from "../../../scripts/lib/migrate-core.js";
import { runSeed } from "../../../scripts/lib/seed-core.js";

export const createConnection = async ({ includeDatabase = true } = {}) =>
  mysql.createConnection(getDbConfig(process.env, { includeDatabase }));

export const resetDatabase = async () => {
  await runMigrations();
  await runSeed();
};

export const useRealDatabase = () => {
  beforeAll(async () => {
    await runMigrations();
  });

  beforeEach(async () => {
    await resetDatabase();
  });
};

export const readOne = async (sql, params = []) => {
  const conn = await createConnection();
  try {
    const [rows] = await conn.query(sql, params);
    return rows[0] || null;
  } finally {
    await conn.end();
  }
};

export const readMany = async (sql, params = []) => {
  const conn = await createConnection();
  try {
    const [rows] = await conn.query(sql, params);
    return rows;
  } finally {
    await conn.end();
  }
};

