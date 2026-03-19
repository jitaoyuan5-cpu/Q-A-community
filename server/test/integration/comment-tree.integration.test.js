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

describe("comment tree integration", () => {
  beforeEach(() => queryMock.mockReset());

  it("returns nested comment tree for question target", async () => {
    queryMock.mockResolvedValueOnce([
      [
        { id: 1, parent_id: null, content: "root", created_at: "2026-01-01", updated_at: "2026-01-01", author_id: 1, author_name: "A", author_avatar: "" },
        { id: 2, parent_id: 1, content: "child", created_at: "2026-01-01", updated_at: "2026-01-01", author_id: 2, author_name: "B", author_avatar: "" },
      ],
    ]);

    const res = await request(app).get("/api/comments?targetType=question&targetId=1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].replies).toHaveLength(1);
    expect(res.body[0].replies[0].content).toBe("child");
  });
});