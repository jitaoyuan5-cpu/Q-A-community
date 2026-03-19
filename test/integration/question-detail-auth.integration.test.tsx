import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { renderAppAt } from "./render-app";

describe("integration: question detail auth gate", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("hides the answer composer for anonymous visitors", async () => {
    renderAppAt("/question/q2", { authenticated: false });

    expect(await screen.findByText("登录后可发布回答")).toBeInTheDocument();
    expect(screen.getByText("登录后可投票、关注问题和采纳回答")).toBeInTheDocument();
    expect(screen.getByText("登录后可关注问题")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("请输入你的回答")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "关注问题" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "赞成问题" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "反对问题" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "赞成回答" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "反对回答" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "采纳此答案" })).not.toBeInTheDocument();
  });

  it("keeps interaction buttons visible for authenticated visitors", async () => {
    renderAppAt("/question/q2");

    expect(await screen.findByRole("button", { name: "关注问题" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "赞成问题" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "反对问题" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "赞成回答" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "反对回答" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "采纳此答案" })).toBeInTheDocument();
  });
});
