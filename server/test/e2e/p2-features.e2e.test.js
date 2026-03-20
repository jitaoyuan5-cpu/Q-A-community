import { describe, expect, it } from "vitest";
import { useRealDatabase, readMany, readOne } from "./helpers/db.js";
import { api, authHeader, loginAs } from "./helpers/app.js";

useRealDatabase();

describe("p2 features e2e", () => {
  it("supports favorites, notifications, reports, and new tables", async () => {
    const admin = await loginAs("alice@example.com");
    const member = await loginAs("bob@example.com");

    const favoriteRes = await api()
      .post("/api/favorites/toggle")
      .set(authHeader(member.accessToken))
      .send({ targetType: "question", targetId: 1 });
    expect(favoriteRes.status).toBe(201);

    const favoriteRow = await readOne("SELECT target_type, target_id FROM favorites WHERE user_id = 2 AND target_type = 'question' AND target_id = 1");
    expect(favoriteRow?.target_type).toBe("question");

    const answerRes = await api()
      .post("/api/answers")
      .set(authHeader(member.accessToken))
      .send({ questionId: 1, content: "新的回答内容" });
    expect(answerRes.status).toBe(201);

    const notificationRows = await readMany("SELECT type, user_id FROM notifications WHERE user_id = 1 ORDER BY id DESC LIMIT 5");
    expect(notificationRows.filter((row) => row.type === "new_answer")).toHaveLength(1);
    expect(notificationRows.filter((row) => row.type === "follow_update")).toHaveLength(0);

    const reportRes = await api()
      .post("/api/reports")
      .set(authHeader(member.accessToken))
      .send({ targetType: "answer", targetId: 1, reason: "广告营销", detail: "spam" });
    expect(reportRes.status).toBe(201);

    const reviewRes = await api()
      .post(`/api/admin/reports/${reportRes.body.id}/review`)
      .set(authHeader(admin.accessToken))
      .send({ action: "hide", reviewNote: "已隐藏" });
    expect(reviewRes.status).toBe(200);

    const hiddenAnswer = await readOne("SELECT is_hidden FROM answers WHERE id = 1");
    expect(hiddenAnswer?.is_hidden).toBe(1);
  });

  it("filters hidden favorites from the favorites list", async () => {
    const admin = await loginAs("alice@example.com");
    const member = await loginAs("bob@example.com");

    const favoriteRes = await api()
      .post("/api/favorites/toggle")
      .set(authHeader(member.accessToken))
      .send({ targetType: "article", targetId: 1 });
    expect(favoriteRes.status).toBe(201);

    const reportRes = await api()
      .post("/api/reports")
      .set(authHeader(member.accessToken))
      .send({ targetType: "article", targetId: 1, reason: "广告营销", detail: "hidden favorite target" });
    expect(reportRes.status).toBe(201);

    const reviewRes = await api()
      .post(`/api/admin/reports/${reportRes.body.id}/review`)
      .set(authHeader(admin.accessToken))
      .send({ action: "hide", reviewNote: "隐藏文章" });
    expect(reviewRes.status).toBe(200);

    const favoritesList = await api().get("/api/favorites").set(authHeader(member.accessToken));
    expect(favoritesList.status).toBe(200);
    expect(favoritesList.body.some((item) => item.targetType === "article" && item.targetId === 1)).toBe(false);
  });

  it("stores uploads and serves uploaded assets", async () => {
    const member = await loginAs("bob@example.com");

    const uploadRes = await api()
      .post("/api/uploads")
      .set(authHeader(member.accessToken))
      .send({
        fileName: "pixel.png",
        mimeType: "image/png",
        dataBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y1koX8AAAAASUVORK5CYII=",
      });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.url).toContain("/uploads/");

    const uploadRow = await readOne("SELECT mime_type, url FROM uploads WHERE id = ?", [uploadRes.body.id]);
    expect(uploadRow?.mime_type).toBe("image/png");

    const assetPath = new URL(uploadRes.body.url).pathname;
    const assetRes = await api().get(assetPath);
    expect(assetRes.status).toBe(200);
  });

  it("creates an in-site notification after a new question comment", async () => {
    const owner = await loginAs("alice@example.com");
    const member = await loginAs("bob@example.com");

    const commentRes = await api()
      .post("/api/comments")
      .set(authHeader(member.accessToken))
      .send({ targetType: "question", targetId: 1, content: "**新的评论**" });
    expect(commentRes.status).toBe(201);

    const notificationRows = await readMany(
      "SELECT type, title, link FROM notifications WHERE user_id = 1 ORDER BY id DESC LIMIT 5",
    );
    expect(notificationRows.some((row) => row.type === "new_comment" && row.link === "/question/1")).toBe(true);

    const notificationRes = await api().get("/api/notifications").set(authHeader(owner.accessToken));
    expect(notificationRes.status).toBe(200);
    expect(notificationRes.body.items.some((item) => item.type === "new_comment" && item.link === "/question/1")).toBe(true);
  });
});
