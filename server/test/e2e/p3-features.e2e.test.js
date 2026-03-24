import { describe, expect, it } from "vitest";
import { useRealDatabase, readMany, readOne } from "./helpers/db.js";
import { api, authHeader, loginAs } from "./helpers/app.js";

useRealDatabase();

describe("p3 features e2e", () => {
  it("creates P3 tables and indexes in the real database", async () => {
    const migration = await readOne("SELECT name FROM schema_migrations WHERE name = '003_p3_features.sql'");
    expect(migration?.name).toBe("003_p3_features.sql");

    const tables = await readMany(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = ?
         AND table_name IN ('assistant_threads','assistant_messages','question_chat_messages','tutorials','tutorial_lessons','tutorial_progress','playground_shares','developer_api_keys','api_usage_logs')`,
      [process.env.DB_NAME],
    );
    expect(tables).toHaveLength(9);

    const indexes = await readMany(
      `SELECT DISTINCT index_name AS indexName
       FROM information_schema.statistics
       WHERE table_schema = ?
         AND (
           (table_name = 'assistant_threads' AND index_name = 'idx_assistant_threads_user_updated') OR
           (table_name = 'question_chat_messages' AND index_name = 'idx_question_chat_hidden') OR
           (table_name = 'tutorial_progress' AND index_name = 'uniq_tutorial_progress') OR
           (table_name = 'developer_api_keys' AND index_name = 'key_hash') OR
           (table_name = 'api_usage_logs' AND index_name = 'idx_api_usage_key_created')
         )`,
      [process.env.DB_NAME],
    );

    expect(indexes.map((item) => item.indexName).sort()).toEqual([
      "idx_api_usage_key_created",
      "idx_assistant_threads_user_updated",
      "idx_question_chat_hidden",
      "key_hash",
      "uniq_tutorial_progress",
    ]);
  });

  it("persists assistant threads and messages", async () => {
    const member = await loginAs("alice@example.com");

    const queryRes = await api()
      .post("/api/assistant/query")
      .set(authHeader(member.accessToken))
      .send({ query: "什么时候应该用 useReducer" });

    expect(queryRes.status).toBe(201);
    expect(queryRes.body.threadId).toBeGreaterThan(0);

    const threadRow = await readOne("SELECT title FROM assistant_threads WHERE id = ?", [queryRes.body.threadId]);
    expect(threadRow?.title).toContain("什么时候应该用 useReducer");

    const messageRows = await readMany(
      "SELECT role FROM assistant_messages WHERE thread_id = ? ORDER BY created_at ASC",
      [queryRes.body.threadId],
    );
    expect(messageRows.map((row) => row.role)).toEqual(["user", "assistant"]);

    const detailRes = await api()
      .get(`/api/assistant/threads/${queryRes.body.threadId}`)
      .set(authHeader(member.accessToken));
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.messages).toHaveLength(2);
  });

  it("stores realtime question chat messages in the database", async () => {
    const member = await loginAs("bob@example.com");

    const createRes = await api()
      .post("/api/question-chats/1/messages")
      .set(authHeader(member.accessToken))
      .send({ content: "这题可以先从状态转移图开始拆解。" });

    expect(createRes.status).toBe(201);
    expect(createRes.body.items.some((item) => item.content.includes("状态转移图"))).toBe(true);

    const storedRow = await readOne("SELECT content FROM question_chat_messages WHERE id = ?", [createRes.body.messageId]);
    expect(storedRow?.content).toContain("状态转移图");

    const listRes = await api().get("/api/question-chats/1/messages");
    expect(listRes.status).toBe(200);
    expect(listRes.body.items.some((item) => item.id === createRes.body.messageId)).toBe(true);
  });

  it("updates tutorial progress and stores playground shares", async () => {
    const member = await loginAs("bob@example.com");

    const progressRes = await api()
      .put("/api/tutorials/1/progress")
      .set(authHeader(member.accessToken))
      .send({ lessonId: 1, progressPercent: 75 });
    expect(progressRes.status).toBe(200);

    const progressRow = await readOne(
      "SELECT lesson_id, progress_percent FROM tutorial_progress WHERE user_id = 2 AND tutorial_id = 1",
    );
    expect(progressRow?.lesson_id).toBe(1);
    expect(Number(progressRow?.progress_percent)).toBe(75);

    const shareRes = await api()
      .post("/api/playground/shares")
      .set(authHeader(member.accessToken))
      .send({
        title: "Reducer Playground",
        templateKey: "typescript",
        files: { "index.ts": "type Action = { type: 'inc' };" },
      });
    expect(shareRes.status).toBe(201);

    const savedShare = await api().get(`/api/playground/shares/${shareRes.body.id}`);
    expect(savedShare.status).toBe(200);
    expect(savedShare.body.title).toBe("Reducer Playground");
  });

  it("creates, uses, and revokes public api keys", async () => {
    const member = await loginAs("alice@example.com");

    const createRes = await api()
      .post("/api/developer/keys")
      .set(authHeader(member.accessToken))
      .send({ name: "Public docs key" });
    expect(createRes.status).toBe(201);
    expect(createRes.body.secret.startsWith("qak_")).toBe(true);

    const publicRes = await api()
      .get("/api/public/v1/questions")
      .set("x-api-key", createRes.body.secret);
    expect(publicRes.status).toBe(200);
    expect(Array.isArray(publicRes.body)).toBe(true);

    const keyRow = await readOne("SELECT last_used_at, revoked_at FROM developer_api_keys WHERE id = ?", [createRes.body.id]);
    expect(keyRow?.revoked_at).toBeNull();

    const revokeRes = await api()
      .delete(`/api/developer/keys/${createRes.body.id}`)
      .set(authHeader(member.accessToken));
    expect(revokeRes.status).toBe(200);

    const afterRevoke = await api()
      .get("/api/public/v1/questions")
      .set("x-api-key", createRes.body.secret);
    expect(afterRevoke.status).toBe(401);
  });
});
