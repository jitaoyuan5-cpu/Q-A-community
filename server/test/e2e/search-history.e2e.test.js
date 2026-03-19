import { describe, expect, it } from "vitest";
import { api, authHeader, loginAs } from "./helpers/app.js";
import { readOne, useRealDatabase } from "./helpers/db.js";

describe("search history e2e", () => {
  useRealDatabase();

  it("persists search history rows in the real database", async () => {
    const { accessToken } = await loginAs("alice@example.com");

    const search = await api()
      .get("/api/search?q=React&types=questions,articles,users")
      .set(authHeader(accessToken));
    expect(search.status).toBe(200);
    expect(search.body.questions.length).toBeGreaterThan(0);

    const history = await api().get("/api/search/history").set(authHeader(accessToken));
    expect(history.status).toBe(200);
    expect(history.body[0].query_text).toBe("React");

    const row = await readOne("SELECT query_text FROM search_history WHERE user_id = 1 ORDER BY id DESC LIMIT 1");
    expect(row?.query_text).toBe("React");
  });
});

