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

describe("follow unread integration", () => {
  beforeEach(() => queryMock.mockReset());

  it("returns follow list and marks seen", async () => {
    queryMock.mockResolvedValueOnce([
      [
        {
          question_id: 1,
          has_new_answers: 1,
          followed_at: "2026-01-01",
          title: "question",
          votes: 10,
          views: 20,
          answers_count: 2,
          updated_at: "2026-01-02",
          author_id: 1,
          author_name: "Alice",
          author_avatar: "",
          tag_names: "React,TypeScript",
        },
      ],
    ]);

    const listRes = await request(app).get("/api/follows").set("Authorization", bearer());
    expect(listRes.status).toBe(200);
    expect(listRes.body[0].hasNewAnswers).toBe(true);

    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const seenRes = await request(app).post("/api/follows/seen/1").set("Authorization", bearer());
    expect(seenRes.status).toBe(200);
    expect(seenRes.body.success).toBe(true);
  });

  it("returns 404 when answering a missing question", async () => {
    queryMock.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .post("/api/answers")
      .set("Authorization", bearer())
      .send({ questionId: 999, content: "ghost answer" });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Question not found");
  });
});
