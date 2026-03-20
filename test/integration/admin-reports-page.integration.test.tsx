import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiRequestMock = vi.fn();
const refreshAllMock = vi.fn();

vi.mock("../../src/app/api/client", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}));

vi.mock("../../src/app/store/qa-context", () => ({
  useQA: () => ({
    actions: {
      refreshAll: refreshAllMock,
    },
  }),
}));

import { AdminReportsPage } from "../../src/app/pages/admin-reports-page";

describe("admin reports page integration", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    refreshAllMock.mockReset();
  });

  it("refreshes shared QA state after hiding a report target", async () => {
    const user = userEvent.setup();
    apiRequestMock
      .mockResolvedValueOnce([
        {
          id: 1,
          targetType: "question",
          targetId: 42,
          reason: "垃圾信息",
          detail: "",
          status: "pending",
          reporter: { id: 2, name: "张三" },
          createdAt: "2026-03-20T08:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce([]);

    render(<AdminReportsPage />);

    expect(await screen.findByText("垃圾信息")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "hide" }));

    await waitFor(() => expect(refreshAllMock).toHaveBeenCalledTimes(1));
    expect(apiRequestMock).toHaveBeenCalledWith("/admin/reports/1/review", {
      method: "POST",
      body: JSON.stringify({ action: "hide", reviewNote: "" }),
    });
    expect(apiRequestMock).toHaveBeenCalledWith("/admin/reports?status=pending");
  });
});
