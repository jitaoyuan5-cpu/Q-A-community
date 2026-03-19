import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { getDbConfig } from "./db-config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../migrations");

export const ensureDatabaseExists = async (dbName) => {
  const conn = await mysql.createConnection(getDbConfig(process.env, { includeDatabase: false }));
  try {
    await conn.query("CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci", [dbName]);
  } finally {
    await conn.end();
  }
};

export const applyMigrations = async (conn) => {
  const [exists] = await conn.query("SHOW TABLES LIKE 'schema_migrations'");
  if (!exists.length) {
    await conn.query(`CREATE TABLE schema_migrations (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  }

  const [appliedRows] = await conn.query("SELECT name FROM schema_migrations");
  const applied = new Set(appliedRows.map((row) => row.name));
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    await conn.query(sql);
    await conn.query("INSERT INTO schema_migrations (name) VALUES (?)", [file]);
    console.log(`migrated: ${file}`);
  }
};

export const runMigrations = async () => {
  await ensureDatabaseExists(process.env.DB_NAME);
  const conn = await mysql.createConnection(getDbConfig());
  try {
    await applyMigrations(conn);
  } finally {
    await conn.end();
  }
};

