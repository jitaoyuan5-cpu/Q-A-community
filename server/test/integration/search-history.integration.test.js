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

const bearer = () => {
  const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET, { expiresIn: "1h" });
  return `Bearer ${token}`;
};

describe("search history integration", () => {
  beforeEach(() => queryMock.mockReset());

  it("adds history on search and reads history list", async () => {
    queryMock.mockResolvedValueOnce([[{ id: 1, title: "react", content: "c", votes: 1, views: 1 }]]);
    queryMock.mockResolvedValueOnce([[{ id: 2, title: "article", excerpt: "e", views: 1, likes: 1, comments_count: 1 }]]);
    queryMock.mockResolvedValueOnce([[{ id: 3, name: "user", avatar: "", reputation: 10 }]]);
    queryMock.mockResolvedValueOnce([{ insertId: 1 }]);

    const searchRes = await request(app)
      .get("/api/search?q=react&types=questions,articles,users")
      .set("Authorization", bearer());
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.questions).toHaveLength(1);

    queryMock.mockResolvedValueOnce([[{ id: 9, query_text: "react", created_at: "2026-01-01" }]]);
    const historyRes = await request(app).get("/api/search/history").set("Authorization", bearer());
    expect(historyRes.status).toBe(200);
    expect(historyRes.body[0].query_text).toBe("react");
  });
});