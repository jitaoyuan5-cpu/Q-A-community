import request from "supertest";
import { app } from "../../../src/app.js";

export const api = () => request(app);

export const loginAs = async (email, password = "123456") => {
  const response = await api().post("/api/auth/login").send({ email, password });
  return {
    response,
    accessToken: response.body.accessToken,
    refreshToken: response.body.refreshToken,
  };
};

export const authHeader = (token) => ({ Authorization: `Bearer ${token}` });
