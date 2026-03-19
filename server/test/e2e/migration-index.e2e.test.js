import { describe, expect, it } from "vitest";
import { createConnection, readMany, readOne, useRealDatabase } from "./helpers/db.js";

describe("migration and index e2e", () => {
  useRealDatabase();

  it("creates schema_migrations, core tables and required indexes", async () => {
    const migration = await readOne("SELECT name FROM schema_migrations WHERE name = '001_init.sql'");
    expect(migration?.name).toBe("001_init.sql");

    const tables = await readMany(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = ?
         AND table_name IN ('users','questions','answers','comments','follows','votes','search_history','articles','tags')`,
      [process.env.DB_NAME],
    );
    expect(tables).toHaveLength(9);

    const indexes = await readMany(
      `SELECT DISTINCT index_name AS indexName
       FROM information_schema.statistics
       WHERE table_schema = ?
         AND (
           (table_name = 'questions' AND index_name = 'ftx_question_text') OR
           (table_name = 'articles' AND index_name = 'ftx_article_text') OR
           (table_name = 'comments' AND index_name = 'idx_comment_target') OR
           (table_name = 'follows' AND index_name = 'uniq_follow') OR
           (table_name = 'votes' AND index_name = 'uniq_vote') OR
           (table_name = 'search_history' AND index_name = 'idx_search_history_user')
         )`,
      [process.env.DB_NAME],
    );

    expect(indexes.map((item) => item.indexName).sort()).toEqual([
      "ftx_article_text",
      "ftx_question_text",
      "idx_comment_target",
      "idx_search_history_user",
      "uniq_follow",
      "uniq_vote",
    ]);
  });

  it("enforces unique follow constraint in the real database", async () => {
    const conn = await createConnection();
    try {
      await conn.query("INSERT INTO follows (user_id, question_id, has_new_answers) VALUES (2, 2, 0)");
      await expect(conn.query("INSERT INTO follows (user_id, question_id, has_new_answers) VALUES (2, 2, 0)")).rejects.toMatchObject({
        code: "ER_DUP_ENTRY",
      });
    } finally {
      await conn.end();
    }
  });
});
