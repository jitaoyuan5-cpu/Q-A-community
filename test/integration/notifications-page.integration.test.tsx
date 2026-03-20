import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiRequestMock = vi.fn();
const refreshNotificationsMock = vi.fn();

vi.mock("../../src/app/api/client", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}));

vi.mock("../../src/app/store/qa-context", () => ({
  useQA: () => ({
    actions: {
      refreshNotifications: refreshNotificationsMock,
    },
  }),
}));

import { NotificationsPage } from "../../src/app/pages/notifications-page";

describe("notifications page integration", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    refreshNotificationsMock.mockReset();
  });

  it("refreshes shared notifications after marking all as read", async () => {
    const user = userEvent.setup();
    apiRequestMock
      .mockResolvedValueOnce({
        unreadCount: 1,
        items: [
          {
            id: "n1",
            title: "你的问题收到了新回答",
            body: "React",
            link: "/question/q1",
            isRead: false,
            createdAt: "2026-03-19T00:00:00.000Z",
          },
        ],
      })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({
        unreadCount: 0,
        items: [
          {
            id: "n1",
            title: "你的问题收到了新回答",
            body: "React",
            link: "/question/q1",
            isRead: true,
            createdAt: "2026-03-19T00:00:00.000Z",
          },
        ],
      });

    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("你的问题收到了新回答")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "全部已读" }));

    await waitFor(() => expect(refreshNotificationsMock).toHaveBeenCalledTimes(1));
    expect(apiRequestMock).toHaveBeenCalledWith("/notifications/read-all", { method: "POST" });
  });
});
