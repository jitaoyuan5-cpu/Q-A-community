import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock, updateUserMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  updateUserMock: vi.fn(),
}));

vi.mock("../../src/app/api/client", () => ({
  apiRequest: (...args: any[]) => apiRequestMock(...args),
}));

vi.mock("../../src/app/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      preferredLocale: "zh-CN",
    },
    updateUser: updateUserMock,
  }),
}));

import { I18nProvider, useI18n } from "../../src/app/i18n";

function LocaleProbe() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div>
      <p>{locale}</p>
      <p>{t("appName")}</p>
      <button type="button" onClick={() => void setLocale("en-US")}>
        switch
      </button>
    </div>
  );
}

describe("i18n integration", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    updateUserMock.mockReset();
    localStorage.removeItem("qa_locale");
    apiRequestMock.mockResolvedValue({});
  });

  it("updates locale without forcing a profile refetch", async () => {
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    );

    await user.click(screen.getByRole("button", { name: "switch" }));

    expect(screen.getByText("QA Community")).toBeInTheDocument();
    await waitFor(() => expect(updateUserMock).toHaveBeenCalledWith({ preferredLocale: "en-US" }));
    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    expect(apiRequestMock).toHaveBeenCalledWith("/users/me", {
      method: "PATCH",
      body: JSON.stringify({ preferredLocale: "en-US" }),
    });
  });
});
