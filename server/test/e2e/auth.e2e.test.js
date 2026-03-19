import { describe, expect, it } from "vitest";
import { api } from "./helpers/app.js";
import { readMany, readOne, useRealDatabase } from "./helpers/db.js";

describe("auth e2e", () => {
  useRealDatabase();

  it("registers a user and persists auth token rows", async () => {
    const response = await api().post("/api/auth/register").send({
      email: "e2e-user@example.com",
      password: "123456",
      name: "E2E User",
    });

    expect(response.status).toBe(201);
    expect(response.body.accessToken).toBeTruthy();
    expect(response.body.refreshToken).toBeTruthy();

    const user = await readOne("SELECT id, email, name FROM users WHERE email = ?", ["e2e-user@example.com"]);
    expect(user?.email).toBe("e2e-user@example.com");

    const tokenRow = await readOne("SELECT user_id, revoked_at FROM auth_tokens WHERE user_id = ?", [user.id]);
    expect(tokenRow?.user_id).toBe(user.id);
    expect(tokenRow?.revoked_at).toBeNull();
  });

  it("refresh rotates refresh tokens in the real database", async () => {
    const login = await api().post("/api/auth/login").send({ email: "alice@example.com", password: "123456" });
    expect(login.status).toBe(200);

    const refreshed = await api().post("/api/auth/refresh").send({ refreshToken: login.body.refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeTruthy();
    expect(refreshed.body.refreshToken).toBeTruthy();

    const rows = await readMany(
      "SELECT revoked_at FROM auth_tokens WHERE user_id = 1 ORDER BY id ASC",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].revoked_at).not.toBeNull();
    expect(rows[1].revoked_at).toBeNull();
  });
});
