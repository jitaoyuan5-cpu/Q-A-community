import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderAppAt } from "./render-app";

describe("integration: login page", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("shows the backend invalid credential message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "Invalid credentials" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderAppAt("/login", { authenticated: false });

    await user.clear(screen.getByPlaceholderText("邮箱"));
    await user.type(screen.getByPlaceholderText("邮箱"), "missing@example.com");
    await user.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
