import crypto from "node:crypto";
import { sha256 } from "./crypto.js";

export const generateApiKey = () => {
  const raw = `qak_${crypto.randomBytes(24).toString("base64url")}`;
  return {
    raw,
    keyHash: sha256(raw),
    keyPrefix: raw.slice(0, 12),
  };
};

export const publicApiLimitPerHour = Number(process.env.PUBLIC_API_RATE_LIMIT || 120);
