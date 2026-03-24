import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
}));

vi.mock("../../src/app/api/client", () => ({
  apiRequest: (...args: any[]) => apiRequestMock(...args),
}));

import { AdminTutorialsPage } from "../../src/app/pages/admin-tutorials-page";

describe("admin tutorials page integration", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/admin/tutorials") return [];
      throw new Error(`Unhandled apiRequest mock for ${path}`);
    });
  });

  it("renders field requirements and explanations", async () => {
    render(<AdminTutorialsPage />);

    expect(await screen.findByText("教程管理")).toBeInTheDocument();
    expect(screen.getAllByText("必填").length).toBeGreaterThan(0);
    expect(screen.getAllByText("选填").length).toBeGreaterThan(0);
    expect(screen.getByText("课程在前台列表和详情页显示的主标题。")).toBeInTheDocument();
    expect(screen.getByText("只支持 YouTube、Bilibili、Vimeo 的合法链接。")).toBeInTheDocument();
  });

  it("shows a friendly validation error before submitting an invalid tutorial form", async () => {
    const user = userEvent.setup();
    render(<AdminTutorialsPage />);

    await screen.findByText("教程管理");
    expect(screen.getByLabelText("标题")).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "保存教程" }));

    expect(await screen.findByText("请填写教程标题，至少 2 个字")).toBeInTheDocument();
    expect(apiRequestMock).toHaveBeenCalledTimes(1);
  });
});
