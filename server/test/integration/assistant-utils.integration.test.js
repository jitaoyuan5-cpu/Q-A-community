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

const { generateAssistantReply, searchAssistantSources, streamAssistantReply } = await import("../../src/utils/assistant.js");
const { env } = await import("../../src/config/env.js");

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

  it("retries timed out remote replies with a compacted follow-up prompt", async () => {
    const original = {
      aiRemoteEnabled: env.aiRemoteEnabled,
      aiApiKey: env.aiApiKey,
      aiBaseUrl: env.aiBaseUrl,
      aiModel: env.aiModel,
      aiProvider: env.aiProvider,
      aiTimeoutMs: env.aiTimeoutMs,
    };

    env.aiRemoteEnabled = true;
    env.aiApiKey = "test-key";
    env.aiBaseUrl = "https://example.com/v1";
    env.aiModel = "test-model";
    env.aiProvider = "compatible";
    env.aiTimeoutMs = 50;

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("timed out"), { name: "AbortError" }))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "这是压缩上下文后的模型回答。" } }],
        }),
      });

    const originalFetch = global.fetch;
    global.fetch = fetchMock;

    try {
      const result = await generateAssistantReply({
        query: "那你帮我总结一下上面的能力",
        citations: [],
        history: [
          { role: "user", content: "你能干什么" },
          { role: "assistant", content: "这里是一段比较长的第一轮回答。".repeat(60) },
          { role: "user", content: "那你帮我总结一下上面的能力" },
        ],
        locale: "zh-CN",
      });

      expect(result.provider).toBe("compatible");
      expect(result.degraded).toBe(false);
      expect(result.content).toContain("压缩上下文");
      expect(fetchMock).toHaveBeenCalledTimes(2);

      const firstPrompt = JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content;
      const secondPrompt = JSON.parse(fetchMock.mock.calls[1][1].body).messages[0].content;
      expect(secondPrompt.length).toBeLessThan(firstPrompt.length);
    } finally {
      global.fetch = originalFetch;
      Object.assign(env, original);
    }
  });

  it("does not abort an in-flight stream after the remote response has started", async () => {
    const original = {
      aiRemoteEnabled: env.aiRemoteEnabled,
      aiApiKey: env.aiApiKey,
      aiBaseUrl: env.aiBaseUrl,
      aiModel: env.aiModel,
      aiProvider: env.aiProvider,
      aiTimeoutMs: env.aiTimeoutMs,
    };

    env.aiRemoteEnabled = true;
    env.aiApiKey = "test-key";
    env.aiBaseUrl = "https://example.com/v1";
    env.aiModel = "test-model";
    env.aiProvider = "compatible";
    env.aiTimeoutMs = 10;

    const originalFetch = global.fetch;
    const encoder = new TextEncoder();

    global.fetch = vi.fn((_url, options) => {
      const { signal } = options;
      let step = 0;
      const body = new ReadableStream({
        async pull(controller) {
          if (signal?.aborted) {
            controller.error(Object.assign(new Error("This operation was aborted"), { name: "AbortError" }));
            return;
          }

          if (step === 0) {
            controller.enqueue(
              encoder.encode(
                'data: {"choices":[{"delta":{"content":"第一段"}}]}\n\n',
              ),
            );
            step += 1;
            await new Promise((resolve) => setTimeout(resolve, 30));
            return;
          }

          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"第二段"}}]}\n\ndata: [DONE]\n\n',
            ),
          );
          controller.close();
        },
      });

      return Promise.resolve({
        ok: true,
        body,
      });
    });

    const chunks = [];

    try {
      const result = await streamAssistantReply({
        query: "帮我分析这个问题",
        citations: [
          {
            targetType: "question",
            targetId: 4,
            title: "Vibe Coding中怎么保证大模型代码的质量",
            excerpt: "强约束输入 + 小步实现 + 自动验证 + 独立审查。",
            link: "/question/4",
          },
        ],
        history: [],
        locale: "zh-CN",
        onChunk: async (chunk) => {
          chunks.push(chunk);
        },
      });

      expect(result.provider).toBe("compatible");
      expect(result.degraded).toBe(false);
      expect(result.content).toBe("第一段第二段");
      expect(chunks).toEqual(["第一段", "第二段"]);
    } finally {
      global.fetch = originalFetch;
      Object.assign(env, original);
    }
  });
});
