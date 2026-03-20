import dotenv from "dotenv";

dotenv.config();

const required = ["DB_HOST", "DB_PORT", "DB_USER", "DB_NAME", "JWT_SECRET", "REFRESH_SECRET"];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing env: ${key}`);
  }
}

export const env = {
  port: Number(process.env.PORT || 4000),
  dbHost: process.env.DB_HOST,
  dbPort: Number(process.env.DB_PORT || 3306),
  dbUser: process.env.DB_USER,
  dbPassword: process.env.DB_PASSWORD || "",
  dbName: process.env.DB_NAME,
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
  refreshSecret: process.env.REFRESH_SECRET,
  refreshExpiresIn: process.env.REFRESH_EXPIRES_IN || "7d",
  emailFrom: process.env.EMAIL_FROM || "",
};
