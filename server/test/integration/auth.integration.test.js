import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DB_HOST = process.env.DB_HOST || "127.0.0.1";
process.env.DB_PORT = process.env.DB_PORT || "3306";
process.env.DB_USER = process.env.DB_USER || "root";
process.env.DB_NAME = process.env.DB_NAME || "qa_community";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_access_secret";
process.env.REFRESH_SECRET = process.env.REFRESH_SECRET || "test_refresh_secret";

const queryMock = vi.fn();

vi.mock("../../src/db/pool.js", () => ({
  pool: { query: queryMock },
  withTx: async (fn) => fn({ query: queryMock }),
}));

const { app } = await import("../../src/app.js");

describe("auth integration", () => {
  beforeEach(() => queryMock.mockReset());

  it("registers new user and returns token pair", async () => {
    queryMock.mockResolvedValueOnce([[]]);
    queryMock.mockResolvedValueOnce([{ insertId: 9 }]);
    queryMock.mockResolvedValueOnce([{ insertId: 1 }]);

    const res = await request(app).post("/api/auth/register").send({
      email: "new@example.com",
      password: "123456",
      name: "新人",
      preferredLocale: "en-US",
    });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.id).toBe(9);
    expect(res.body.user.preferredLocale).toBe("en-US");
  });

  it("logs in and refreshes token", async () => {
    const passwordHash = await bcrypt.hash("123456", 10);
    queryMock.mockResolvedValueOnce([[{ id: 1, email: "alice@example.com", name: "Alice", avatar: "", reputation: 10, password_hash: passwordHash }]]);
    queryMock.mockResolvedValueOnce([{ insertId: 11 }]);

    const loginRes = await request(app).post("/api/auth/login").send({ email: "alice@example.com", password: "123456" });
    expect(loginRes.status).toBe(200);

    const refreshToken = loginRes.body.refreshToken;
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);

    queryMock.mockResolvedValueOnce([[{ id: 11, user_id: decoded.userId, revoked_at: null, expires_at: new Date(Date.now() + 3600_000) }]]);
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    queryMock.mockResolvedValueOnce([{ insertId: 12 }]);

    const refreshRes = await request(app).post("/api/auth/refresh").send({ refreshToken });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeTruthy();
    expect(refreshRes.body.refreshToken).toBeTruthy();
  });

  it("preserves invalid credential message without refresh fallback", async () => {
    queryMock.mockResolvedValueOnce([[]]);

    const res = await request(app).post("/api/auth/login").send({ email: "missing@example.com", password: "123456" });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid credentials");
  });

  it("allows loopback dev origins for cors preflight", async () => {
    const res = await request(app)
      .options("/api/auth/login")
      .set("Origin", "http://127.0.0.1:5173")
      .set("Access-Control-Request-Method", "POST");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5173");
  });
});
