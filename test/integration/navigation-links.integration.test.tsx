import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderAppAt } from "./render-app";

describe("integration: navigation links", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("opens article detail when clicking an article title", async () => {
    const user = userEvent.setup();
    renderAppAt("/articles");

    await user.click(screen.getAllByRole("link", { name: "深入理解 React Server Components" })[1]);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "深入理解 React Server Components" })).toBeInTheDocument();
    });
    expect(screen.getByText("从组件边界、数据获取策略到性能权衡，拆解 React Server Components 在真实项目中的定位与成本。")).toBeInTheDocument();
  });

  it("opens hot question from the sidebar", async () => {
    const user = userEvent.setup();
    renderAppAt("/");

    await user.click(screen.getAllByRole("link", { name: "TypeScript 中 interface 和 type 有什么区别？" })[1]);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "TypeScript 中 interface 和 type 有什么区别？" })).toBeInTheDocument();
    });
  });

  it("opens recommended profile from the sidebar", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        user: { id: 3, name: "王五", avatar: "", reputation: 4100, bio: "资深开发者", location: "上海", website: "" },
        questions: [{ id: 3, title: "TypeScript 中 interface 和 type 有什么区别？" }],
        answers: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderAppAt("/");

    await user.click(screen.getByRole("link", { name: "王五" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "王五" })).toBeInTheDocument();
    });
  });

  it("filters questions from a hot tag link", async () => {
    const user = userEvent.setup();
    renderAppAt("/");

    await user.click(screen.getAllByRole("link", { name: "Hooks" })[1]);
    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: "React 中 useState 和 useReducer 的区别是什么？" }).length).toBeGreaterThan(0);
    });
  });
});
