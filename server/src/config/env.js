import dotenv from "dotenv";

dotenv.config();

const expandLoopbackOrigin = (origin) => {
  try {
    const url = new URL(origin);
    if (url.hostname === "localhost") {
      return [origin, `${url.protocol}//127.0.0.1${url.port ? `:${url.port}` : ""}`];
    }
    if (url.hostname === "127.0.0.1") {
      return [origin, `${url.protocol}//localhost${url.port ? `:${url.port}` : ""}`];
    }
  } catch {
    return [origin];
  }
  return [origin];
};

const required = ["DB_HOST", "DB_PORT", "DB_USER", "DB_NAME", "JWT_SECRET", "REFRESH_SECRET"];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing env: ${key}`);
  }
}

const corsOrigins = [
  ...(process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap(expandLoopbackOrigin),
];

const aiProviderPresets = {
  local: {
    baseUrl: "",
    model: "",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o-mini",
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
  },
  moonshot: {
    baseUrl: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-8k",
  },
  siliconflow: {
    baseUrl: "https://api.siliconflow.cn/v1",
    model: "deepseek-ai/DeepSeek-V3",
  },
  compatible: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
};

const rawAiProvider = String(process.env.AI_PROVIDER || "local").trim().toLowerCase();
const resolvedAiProvider = aiProviderPresets[rawAiProvider] ? rawAiProvider : "compatible";
const aiPreset = aiProviderPresets[resolvedAiProvider];

export const env = {
  port: Number(process.env.PORT || 4000),
  dbHost: process.env.DB_HOST,
  dbPort: Number(process.env.DB_PORT || 3306),
  dbUser: process.env.DB_USER,
  dbPassword: process.env.DB_PASSWORD || "",
  dbName: process.env.DB_NAME,
  corsOrigins: [...new Set(corsOrigins)],
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
  refreshSecret: process.env.REFRESH_SECRET,
  refreshExpiresIn: process.env.REFRESH_EXPIRES_IN || "7d",
  emailFrom: process.env.EMAIL_FROM || "",
  aiProvider: resolvedAiProvider,
  aiRemoteEnabled: resolvedAiProvider !== "local",
  aiApiKey: process.env.AI_API_KEY || "",
  aiBaseUrl: process.env.AI_BASE_URL || aiPreset.baseUrl,
  aiModel: process.env.AI_MODEL || aiPreset.model,
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS || 12000),
};
