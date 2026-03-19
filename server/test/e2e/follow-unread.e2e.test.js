import { describe, expect, it } from "vitest";
import { api, authHeader, loginAs } from "./helpers/app.js";
import { readOne, useRealDatabase } from "./helpers/db.js";

describe("follow unread e2e", () => {
  useRealDatabase();

  it("marks follow unread after a new answer and clears it when seen", async () => {
    const alice = await loginAs("alice@example.com");
    const bob = await loginAs("bob@example.com");

    const follow = await api().post("/api/follows/toggle/2").set(authHeader(alice.accessToken));
    expect(follow.status).toBe(200);
    expect(follow.body.followed).toBe(true);

    const answer = await api()
      .post("/api/answers")
      .set(authHeader(bob.accessToken))
      .send({ questionId: 2, content: "real db e2e answer" });
    expect(answer.status).toBe(201);

    const list = await api().get("/api/follows").set(authHeader(alice.accessToken));
    expect(list.status).toBe(200);
    const followed = list.body.find((item) => item.questionId === 2);
    expect(followed?.hasNewAnswers).toBe(true);

    const seen = await api().post("/api/follows/seen/2").set(authHeader(alice.accessToken));
    expect(seen.status).toBe(200);

    const row = await readOne("SELECT has_new_answers FROM follows WHERE user_id = 1 AND question_id = 2");
    expect(row?.has_new_answers).toBe(0);
  });
});

