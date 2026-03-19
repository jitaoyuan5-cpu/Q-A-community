import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const hashPassword = async (password) => bcrypt.hash(password, 10);
export const verifyPassword = async (password, hash) => bcrypt.compare(password, hash);

export const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

export const signAccessToken = (payload) => jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
export const signRefreshToken = (payload) => jwt.sign(payload, env.refreshSecret, { expiresIn: env.refreshExpiresIn });

export const verifyAccessToken = (token) => jwt.verify(token, env.jwtSecret);
export const verifyRefreshToken = (token) => jwt.verify(token, env.refreshSecret);