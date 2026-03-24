import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DB_HOST = process.env.DB_HOST || "127.0.0.1";
process.env.DB_PORT = process.env.DB_PORT || "3306";
process.env.DB_USER = process.env.DB_USER || "root";
process.env.DB_NAME = process.env.DB_NAME || "qa_community";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_access_secret";
process.env.REFRESH_SECRET = process.env.REFRESH_SECRET || "test_refresh_secret";
process.env.AI_PROVIDER = "local";

const queryMock = vi.fn();

vi.mock("../../src/db/pool.js", () => ({
  pool: { query: queryMock },
}));

const { generateAssistantReply, searchAssistantSources } = await import("../../src/utils/assistant.js");

describe("assistant utils integration", () => {
  beforeEach(() => queryMock.mockReset());

  it("splits long prompts into assistant search terms instead of exact full-text like", async () => {
    queryMock.mockResolvedValue([[]]);

    await searchAssistantSources("React 中 useState 和 useReducer 的区别是什么\n我现在状态更新很多");

    expect(queryMock).toHaveBeenCalledTimes(3);
    const questionParams = queryMock.mock.calls[0][1];
    expect(questionParams.length).toBeGreaterThan(2);
    expect(questionParams).toContain("%React%");
    expect(questionParams.some((item) => /useReducer/i.test(item))).toBe(true);
  });

  it("returns a useful local triage answer when there are no citations", async () => {
    const result = await generateAssistantReply({
      query: "React 中 useState 和 useReducer 的区别是什么",
      citations: [],
      history: [],
      locale: "zh-CN",
    });

    expect(result.provider).toBe("local");
    expect(result.content).toContain("快速拆解");
    expect(result.content).toContain("先明确目标");
  });
});
