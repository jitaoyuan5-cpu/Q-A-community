import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toggleFavoriteMock = vi.fn();
const apiRequestMock = vi.fn();

vi.mock("../../src/app/store/qa-context", () => ({
  useQA: () => ({
    actions: {
      toggleFavorite: toggleFavoriteMock,
    },
  }),
}));

vi.mock("../../src/app/auth-context", () => ({
  useAuth: () => ({
    user: { id: 1, name: "Alice" },
  }),
}));

vi.mock("../../src/app/api/client", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}));

import { FavoriteButton } from "../../src/app/components/content/favorite-button";
import { ReportButton } from "../../src/app/components/content/report-button";

describe("content actions integration", () => {
  beforeEach(() => {
    toggleFavoriteMock.mockReset();
    apiRequestMock.mockReset();
  });

  it("shows a visible error when favorite toggle fails", async () => {
    const user = userEvent.setup();
    toggleFavoriteMock.mockRejectedValueOnce(new Error("Request failed"));

    render(
      <MemoryRouter>
        <FavoriteButton targetType="question" targetId="1" active={false} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "收藏" }));

    expect(await screen.findByText("收藏失败：Request failed")).toBeInTheDocument();
  });

  it("shows success feedback after submitting a report", async () => {
    const user = userEvent.setup();
    apiRequestMock.mockResolvedValueOnce({ id: 9 });

    render(
      <MemoryRouter>
        <ReportButton targetType="question" targetId="1" />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "举报" }));
    await user.click(screen.getByRole("button", { name: "提交" }));

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledWith("/reports", expect.any(Object)));
    expect(await screen.findByText("举报已提交")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "已提交" })).toBeDisabled();
  });
});
