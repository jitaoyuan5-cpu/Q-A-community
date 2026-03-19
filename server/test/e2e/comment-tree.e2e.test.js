import { describe, expect, it } from "vitest";
import { api, authHeader, loginAs } from "./helpers/app.js";
import { readMany, useRealDatabase } from "./helpers/db.js";

describe("comment tree e2e", () => {
  useRealDatabase();

  it("stores and returns nested comments from the real database", async () => {
    const { accessToken } = await loginAs("alice@example.com");

    const root = await api()
      .post("/api/comments")
      .set(authHeader(accessToken))
      .send({ targetType: "question", targetId: 1, content: "root comment" });
    expect(root.status).toBe(201);

    const reply = await api()
      .post("/api/comments")
      .set(authHeader(accessToken))
      .send({ targetType: "question", targetId: 1, parentId: root.body.id, content: "child comment" });
    expect(reply.status).toBe(201);

    const list = await api().get("/api/comments?targetType=question&targetId=1");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].content).toBe("root comment");
    expect(list.body[0].replies).toHaveLength(1);
    expect(list.body[0].replies[0].content).toBe("child comment");

    const rows = await readMany("SELECT id, parent_id, content FROM comments WHERE target_type = 'question' AND target_id = 1 ORDER BY id ASC");
    expect(rows).toHaveLength(2);
    expect(rows[1].parent_id).toBe(rows[0].id);
  });
});

