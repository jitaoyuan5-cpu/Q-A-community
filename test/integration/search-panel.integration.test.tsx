import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderAppAt } from "./render-app";

describe("integration: search panel", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("closes the search history panel when clicking outside", async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/search/history")) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: 1, query_text: "React" }],
        };
      }
      if (url.includes("/search/suggest")) {
        return {
          ok: true,
          status: 200,
          json: async () => [],
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => [],
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderAppAt("/");

    await user.click(screen.getByPlaceholderText("搜索问题、文章、用户..."));
    expect(await screen.findByText("搜索历史")).toBeInTheDocument();

    await user.click(screen.getByText("问答社区"));

    await waitFor(() => {
      expect(screen.queryByText("搜索历史")).not.toBeInTheDocument();
    });
  });
});
