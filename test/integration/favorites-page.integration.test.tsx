import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderAppAt } from "./render-app";

describe("favorites page integration", () => {
  it("renders seeded favorite items", async () => {
    renderAppAt("/favorites");
    expect(await screen.findByRole("heading", { name: "我的收藏" })).toBeInTheDocument();
    expect(screen.getByText("React 中 useState 和 useReducer 的区别是什么？")).toBeInTheDocument();
    expect(screen.getByText("深入理解 React Server Components")).toBeInTheDocument();
  });
});
