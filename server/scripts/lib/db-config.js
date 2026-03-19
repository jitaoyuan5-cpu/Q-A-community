import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export const getDbConfig = (env = process.env, { includeDatabase = true } = {}) => ({
  host: env.DB_HOST,
  port: Number(env.DB_PORT || 3306),
  user: env.DB_USER,
  password: env.DB_PASSWORD || "",
  ...(includeDatabase ? { database: env.DB_NAME } : {}),
  multipleStatements: true,
});

