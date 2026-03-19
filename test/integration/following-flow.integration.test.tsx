import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderAppAt } from "./render-app";

describe("integration: question to following flow", () => {
  it("marks followed question with new answers in following page", async () => {
    const user = userEvent.setup();
    renderAppAt("/question/q2");

    await user.click(screen.getByRole("button", { name: "关注问题" }));
    await user.type(screen.getByPlaceholderText("请输入你的回答"), "这是新增回答，用于联动关注页。" );
    await user.click(screen.getByRole("button", { name: "发布回答" }));
    await user.click(screen.getByRole("link", { name: "关注的问题" }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "如何优化 Next.js 应用的首屏加载速度？" })).toBeInTheDocument();
      expect(screen.getAllByText("有新回答").length).toBeGreaterThan(0);
    });
  });
});
