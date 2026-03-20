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
const createNotificationMock = vi.fn();
const shouldSendEmailForTypeMock = vi.fn();
const mkdirMock = vi.fn();
const writeFileMock = vi.fn();

vi.mock("../../src/db/pool.js", () => ({
  pool: { query: queryMock },
  withTx: async (fn) => fn({ query: queryMock }),
}));

vi.mock("../../src/utils/notifications.js", () => ({
  notificationTypes: {
    newAnswer: "new_answer",
    newComment: "new_comment",
    answerAccepted: "answer_accepted",
    followUpdate: "follow_update",
  },
  createNotification: (...args) => createNotificationMock(...args),
  shouldSendEmailForType: (...args) => shouldSendEmailForTypeMock(...args),
  mapNotificationRow: (row) => ({
    id: row.id,
    type: row.type,
    targetType: row.target_type,
    targetId: row.target_id,
    title: row.title,
    body: row.body,
    link: row.link,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
    readAt: row.read_at,
    actor: row.actor_id
      ? {
          id: row.actor_id,
          name: row.actor_name,
          avatar: row.actor_avatar,
        }
      : null,
  }),
}));

vi.mock("node:fs/promises", () => ({
  mkdir: (...args) => mkdirMock(...args),
  writeFile: (...args) => writeFileMock(...args),
}));

vi.mock("../../src/utils/mailer.js", () => ({
  sendTemplatedEmail: vi.fn().mockResolvedValue({ delivered: false, mode: "test" }),
}));

const { app } = await import("../../src/app.js");

const bearer = (userId = 1) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1h" });
  return `Bearer ${token}`;
};

describe("p2 features integration", () => {
  beforeEach(() => {
    queryMock.mockReset();
    createNotificationMock.mockReset();
    shouldSendEmailForTypeMock.mockReset();
    mkdirMock.mockReset();
    writeFileMock.mockReset();
    shouldSendEmailForTypeMock.mockResolvedValue(false);
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);
  });

  it("toggles favorites", async () => {
    queryMock
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 9 }]);

    const res = await request(app).post("/api/favorites/toggle").set("Authorization", bearer()).send({ targetType: "question", targetId: 1 });
    expect(res.status).toBe(201);
    expect(res.body.favorited).toBe(true);
  });

  it("returns notifications with unread count", async () => {
    queryMock
      .mockResolvedValueOnce([[
        {
          id: 3,
          type: "new_answer",
          target_type: "question",
          target_id: 1,
          title: "title",
          body: "body",
          link: "/question/1",
          is_read: 0,
          created_at: "2026-03-19",
          read_at: null,
          actor_id: 2,
          actor_name: "Bob",
          actor_avatar: "",
        },
      ]])
      .mockResolvedValueOnce([[{ unreadCount: 1 }]]);

    const res = await request(app).get("/api/notifications").set("Authorization", bearer());
    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(1);
    expect(res.body.items[0].title).toBe("title");
  });

  it("rejects removed admin delete action", async () => {
    queryMock.mockResolvedValueOnce([[{ role: "admin" }]]);

    const res = await request(app)
      .post("/api/admin/reports/7/review")
      .set("Authorization", bearer())
      .send({ action: "delete", reviewNote: "" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid review action");
  });

  it("creates report and blocks duplicate pending report", async () => {
    queryMock
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 7 }]);

    const first = await request(app).post("/api/reports").set("Authorization", bearer()).send({ targetType: "question", targetId: 1, reason: "垃圾内容", detail: "" });
    expect(first.status).toBe(201);

    queryMock
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([[{ id: 7 }]]);

    const second = await request(app).post("/api/reports").set("Authorization", bearer()).send({ targetType: "question", targetId: 1, reason: "垃圾内容", detail: "" });
    expect(second.status).toBe(409);
  });

  it("accepts image upload requests on the latest route", async () => {
    queryMock.mockResolvedValueOnce([{ insertId: 5 }]);

    const res = await request(app)
      .post("/api/uploads")
      .set("Authorization", bearer())
      .send({
        fileName: "pixel.png",
        mimeType: "image/png",
        dataBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y1koX8AAAAASUVORK5CYII=",
      });

    expect(res.status).toBe(201);
    expect(res.body.url).toContain("/uploads/");
    expect(mkdirMock).toHaveBeenCalledTimes(1);
    expect(writeFileMock).toHaveBeenCalledTimes(1);
  });

  it("creates a question comment and triggers an in-site notification", async () => {
    queryMock
      .mockResolvedValueOnce([[{ id: 1, title: "React 问题", owner_id: 9, owner_email: "owner@example.com" }]])
      .mockResolvedValueOnce([{ insertId: 12 }]);
    createNotificationMock.mockResolvedValueOnce(33);

    const res = await request(app)
      .post("/api/comments")
      .set("Authorization", bearer(2))
      .send({ targetType: "question", targetId: 1, content: "**新评论**" });

    expect(res.status).toBe(201);
    expect(createNotificationMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 9,
        actorId: 2,
        type: "new_comment",
        targetType: "comment",
        targetId: 12,
        title: "你的问题收到了新评论",
        link: "/question/1",
      }),
    );
  });
});
