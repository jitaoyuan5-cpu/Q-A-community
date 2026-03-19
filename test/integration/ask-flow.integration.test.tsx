import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderAppAt } from "./render-app";

describe("integration: ask flow", () => {
  it("navigates to detail page after successful submit", async () => {
    const user = userEvent.setup();
    renderAppAt("/ask");

    await user.type(screen.getByLabelText(/问题标题/), "集成测试问题标题");
    await user.type(screen.getByLabelText(/问题详情/), "这里是问题详情内容");
    await user.click(screen.getByRole("button", { name: "+ React" }));
    await user.click(screen.getByRole("button", { name: "发布问题" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "集成测试问题标题" })).toBeInTheDocument();
    });
  });
});