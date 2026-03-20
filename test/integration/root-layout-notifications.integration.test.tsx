import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiRequestMock = vi.fn();
const refreshNotificationsMock = vi.fn().mockResolvedValue(undefined);

vi.mock("../../src/app/api/client", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}));

vi.mock("../../src/app/auth-context", () => ({
  useAuth: () => ({
    user: { id: 1, name: "Alice", role: "user", avatar: "" },
    logout: vi.fn(),
  }),
}));

vi.mock("../../src/app/store/qa-context", () => ({
  useQA: () => ({
    state: {
      notifications: [{ id: "n1", title: "新评论", body: "body", link: "/question/1", isRead: false }],
    },
    actions: {
      refreshNotifications: refreshNotificationsMock,
    },
  }),
}));

import { RootLayout } from "../../src/app/pages/root-layout";

describe("root layout notifications integration", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    refreshNotificationsMock.mockClear();
    apiRequestMock.mockResolvedValue([]);
  });

  it("refreshes notifications on window focus and when opening the panel", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<RootLayout />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(refreshNotificationsMock).toHaveBeenCalledTimes(1));

    window.dispatchEvent(new Event("focus"));
    await waitFor(() => expect(refreshNotificationsMock).toHaveBeenCalledTimes(2));

    await user.click(screen.getByRole("button", { name: "打开消息通知" }));
    await waitFor(() => expect(refreshNotificationsMock).toHaveBeenCalledTimes(3));
    expect(screen.getByText("消息通知")).toBeInTheDocument();
  });
});
