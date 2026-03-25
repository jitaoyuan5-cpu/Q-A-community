import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock, apiFetchMock, state } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  apiFetchMock: vi.fn(),
  state: {
    threads: [] as any[],
    threadDetails: {} as Record<number, any>,
    developerKeys: [] as any[],
    lastAssistantPayload: null as any,
  },
}));

vi.mock("../../src/app/api/client", () => ({
  apiRequest: (...args: any[]) => apiRequestMock(...args),
  apiFetch: (...args: any[]) => apiFetchMock(...args),
  apiBase: "http://localhost:4000/api",
  tokenStore: {
    getAccess: () => "test-access-token",
    getRefresh: () => "test-refresh-token",
    set: () => undefined,
    clear: () => undefined,
  },
}));

import { renderAppAt } from "./render-app";

describe("p3 pages integration", () => {
  beforeEach(() => {
    localStorage.setItem("qa_locale", "zh-CN");
    state.threads = [];
    state.threadDetails = {};
    state.developerKeys = [
      {
        id: 1,
        name: "Readonly key",
        keyPrefix: "qak_existing",
        lastUsedAt: null,
        revokedAt: null,
        createdAt: "2026-03-20T00:00:00.000Z",
      },
    ];
    state.lastAssistantPayload = null;

    apiRequestMock.mockReset();
    apiFetchMock.mockReset();
    apiRequestMock.mockImplementation(async (path: string, options?: { method?: string; body?: string }) => {
      if (path === "/questions?tab=newest") return [];
      if (path === "/meta/topics") return [];
      if (path === "/meta/jobs") return [];
      if (path === "/meta/articles") return [];
      if (path === "/meta/tags") return [{ id: 1, name: "React" }, { id: 2, name: "TypeScript" }];
      if (path === "/favorites") return [];
      if (path === "/follows") return [];
      if (path === "/notifications") return { unreadCount: 0, items: [] };
      if (path === "/search/history") return [];
      if (path.startsWith("/search?")) {
        return {
          questions: [
            {
              id: 4,
              title: "Vibe Coding中怎么保证大模型代码的质量",
              content: "强约束输入、小步实现、自动验证和独立审查。",
            },
          ],
          articles: [],
          users: [],
        };
      }

      if (path === "/assistant/threads") return state.threads;
      if (path.startsWith("/assistant/references")) {
        return [
          {
            targetType: "question",
            targetId: 21,
            title: "React Hooks 深入训练营",
            excerpt: "用 6 节课系统掌握 Hooks 组合与性能优化。",
            link: "/question/21",
          },
          {
            targetType: "answer",
            targetId: 31,
            title: "回答 · React Hooks 深入训练营",
            excerpt: "先梳理状态边界，再决定是否拆 reducer。",
            link: "/question/21#answer-31",
          },
        ];
      }
      if (path.startsWith("/assistant/threads/") && options?.method === "DELETE") {
        const threadId = Number(path.split("/").pop());
        state.threads = state.threads.filter((item) => item.id !== threadId);
        delete state.threadDetails[threadId];
        return { success: true };
      }
      if (path.startsWith("/assistant/threads/")) {
        const threadId = Number(path.split("/").pop());
        return state.threadDetails[threadId];
      }
      if (path === "/tutorials") {
        return [
          {
            id: 1,
            title: "React Hooks 深入训练营",
            summary: "用 6 节课系统掌握 Hooks 组合与性能优化。",
            description: "## 课程目标",
            cover: "https://example.com/react-hooks.png",
            difficulty: "intermediate",
            lessonCount: 6,
            tags: ["React", "Hooks"],
            isFavorited: true,
            progressPercent: 50,
            lastLessonId: 1,
            createdAt: "2026-03-20T00:00:00.000Z",
            updatedAt: "2026-03-20T00:00:00.000Z",
            author: { id: 1, name: "张三", avatar: "" },
            lessons: [],
          },
        ];
      }

      if (path === "/developer/keys" && !options?.method) return state.developerKeys;
      if (path === "/developer/keys" && options?.method === "POST") {
        const payload = JSON.parse(options.body || "{}");
        const next = {
          id: 2,
          name: payload.name,
          keyPrefix: "qak_new_demo",
          lastUsedAt: null,
          revokedAt: null,
          createdAt: "2026-03-20T00:05:00.000Z",
        };
        state.developerKeys = [next, ...state.developerKeys];
        return { ...next, secret: "qak_demo_secret_value" };
      }
      if (path === "/public/v1/openapi.json") {
        return {
          info: {
            title: "QA Community Public API",
            version: "v1",
            description: "Read-only public endpoints for questions and articles.",
          },
          components: {
            parameters: {
              QuestionId: {
                name: "id",
                in: "path",
                required: true,
                description: "Question identifier",
              },
            },
            responses: {
              Unauthorized: {
                description: "Missing or invalid API key",
                content: {
                  "application/json": {
                    example: { message: "Invalid API key" },
                  },
                },
              },
            },
          },
          paths: {
            "/api/public/v1/questions": {
              get: {
                summary: "List public questions",
                description: "Returns public questions.",
                responses: {
                  200: {
                    description: "Question list",
                    content: {
                      "application/json": {
                        example: [{ id: 1, title: "Hooks", author: { id: 1, name: "张三" } }],
                      },
                    },
                  },
                  401: { $ref: "#/components/responses/Unauthorized" },
                },
              },
            },
            "/api/public/v1/questions/{id}": {
              get: {
                summary: "Get public question detail",
                parameters: [{ $ref: "#/components/parameters/QuestionId" }],
                responses: {
                  200: {
                    description: "Question detail",
                    content: {
                      "application/json": {
                        schema: { type: "object" },
                      },
                    },
                  },
                  404: {
                    description: "Question not found",
                  },
                },
              },
            },
          },
        };
      }

      throw new Error(`Unhandled apiRequest mock for ${path}`);
    });

    apiFetchMock.mockImplementation(async (path: string, options?: { method?: string; body?: string }) => {
      if (path === "/assistant/query/stream" && options?.method === "POST") {
        const payload = JSON.parse(options.body || "{}");
        state.lastAssistantPayload = payload;
        state.threads = [
          {
            id: 9,
            title: payload.query,
            createdAt: "2026-03-20T00:00:00.000Z",
            updatedAt: "2026-03-20T00:00:00.000Z",
            lastMessage: "给出基于站内内容的结论",
          },
        ];
        state.threadDetails[9] = {
          id: 9,
          title: payload.query,
          createdAt: "2026-03-20T00:00:00.000Z",
          updatedAt: "2026-03-20T00:00:00.000Z",
          messages: [
            {
              id: 1,
              role: "user",
              content: payload.query,
              createdAt: "2026-03-20T00:00:00.000Z",
              citations: [],
            },
            {
              id: 2,
              role: "assistant",
              content: "基于现有社区内容，建议先梳理状态边界，再决定是否升级到 reducer。",
              createdAt: "2026-03-20T00:00:01.000Z",
              citations: [
                {
                  targetType: "question",
                  targetId: 1,
                  title: "React Hooks 深入训练营",
                  excerpt: "用 6 节课系统掌握 Hooks 组合与性能优化。",
                  link: "/tutorials/1",
                },
              ],
            },
          ],
        };

        const finalMessage = {
          id: 2,
          role: "assistant",
          content: "基于现有社区内容，建议先梳理状态边界，再决定是否升级到 reducer。",
          citations: [
            {
              targetType: "question",
              targetId: 1,
              title: "React Hooks 深入训练营",
              excerpt: "用 6 节课系统掌握 Hooks 组合与性能优化。",
              link: "/tutorials/1",
            },
          ],
          meta: {
            provider: "local",
            degraded: true,
            reason: "timeout",
          },
        };

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            controller.enqueue(encoder.encode(`event: thread\ndata: ${JSON.stringify({ threadId: 9 })}\n\n`));
            controller.enqueue(encoder.encode(`event: delta\ndata: ${JSON.stringify({ content: "基于现有社区内容，建议先梳理状态边界，" })}\n\n`));
            await new Promise((resolve) => setTimeout(resolve, 30));
            controller.enqueue(encoder.encode(`event: delta\ndata: ${JSON.stringify({ content: "再决定是否升级到 reducer。" })}\n\n`));
            await new Promise((resolve) => setTimeout(resolve, 30));
            controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ threadId: 9, message: finalMessage })}\n\n`));
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
          },
        });
      }

      throw new Error(`Unhandled apiFetch mock for ${path}`);
    });
  });

  it("submits a prompt and renders assistant citations", async () => {
    const user = userEvent.setup();
    renderAppAt("/assistant");

    const input = await screen.findByPlaceholderText("例如：如何判断该用 useState 还是 useReducer？");
    await user.type(input, "什么时候应该用 useReducer");
    const submitPromise = user.click(screen.getByRole("button", { name: "开始分析" }));

    expect(await screen.findByText("正在生成")).toBeInTheDocument();
    expect(screen.getByText("基于现有社区内容，建议先梳理状态边界，")).toBeInTheDocument();

    await submitPromise;

    expect(await screen.findByText("React Hooks 深入训练营")).toBeInTheDocument();
    expect(screen.getByText("基于现有社区内容，建议先梳理状态边界，再决定是否升级到 reducer。")).toBeInTheDocument();
    expect(screen.getByText("远端 AI 服务当前不可用，本次结果已自动降级为站内本地回答。")).toBeInTheDocument();
    expect(screen.getByText("本地兜底")).toBeInTheDocument();
  });

  it("deletes an assistant thread from the sidebar", async () => {
    const user = userEvent.setup();
    state.threads = [
      {
        id: 9,
        title: "什么时候应该用 useReducer",
        createdAt: "2026-03-20T00:00:00.000Z",
        updatedAt: "2026-03-20T00:00:00.000Z",
        lastMessage: "给出基于站内内容的结论",
      },
    ];
    state.threadDetails[9] = {
      id: 9,
      title: "什么时候应该用 useReducer",
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
      messages: [],
    };

    renderAppAt("/assistant?thread=9");

    expect((await screen.findAllByText("什么时候应该用 useReducer")).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "删除会话 什么时候应该用 useReducer" }));

    expect(await screen.findByText("还没有历史会话。")).toBeInTheDocument();
  });

  it("selects a cited reference via @ mention and sends context refs with the assistant request", async () => {
    const user = userEvent.setup();
    renderAppAt("/assistant");

    const input = await screen.findByPlaceholderText("例如：如何判断该用 useState 还是 useReducer？");
    await user.type(input, "@React");

    expect(await screen.findByText("回答 · React Hooks 深入训练营")).toBeInTheDocument();
    const questionOptionLabel = await screen.findByText("用 6 节课系统掌握 Hooks 组合与性能优化。");
    await user.click(questionOptionLabel.closest("button") as HTMLButtonElement);

    expect(await screen.findByText("已选引用")).toBeInTheDocument();
    expect(screen.getByText("React Hooks 深入训练营")).toBeInTheDocument();

    await user.type(input, "什么时候应该用 useReducer");

    await user.click(screen.getByRole("button", { name: "开始分析" }));

    expect(state.lastAssistantPayload.contextRefs).toEqual([{ targetType: "question", targetId: 21 }]);
  });

  it("falls back to search results when the dedicated reference endpoint is unavailable", async () => {
    const user = userEvent.setup();
    const baseImpl = apiRequestMock.getMockImplementation();
    apiRequestMock.mockImplementation(async (path: string, options?: { method?: string; body?: string }) => {
      if (path.startsWith("/assistant/references")) {
        throw new Error("Not Found");
      }
      return baseImpl?.(path, options);
    });
    renderAppAt("/assistant");

    const input = await screen.findByPlaceholderText("例如：如何判断该用 useState 还是 useReducer？");
    await user.type(input, "@vibe");

    expect(await screen.findByText("Vibe Coding中怎么保证大模型代码的质量")).toBeInTheDocument();
  });

  it("renders tutorial cards from the API", async () => {
    renderAppAt("/tutorials");

    expect(await screen.findByText(/用课程页、章节线索和可嵌入视频/)).toBeInTheDocument();
    expect(screen.getByText("React Hooks 深入训练营")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看课程" })).toHaveAttribute("href", "/tutorials/1");
  });

  it("creates and displays a developer api key", async () => {
    const user = userEvent.setup();
    renderAppAt("/developers/keys");

    expect(await screen.findByRole("heading", { name: "API Keys" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "创建 API Key" }));

    expect(await screen.findByText(/qak_demo_secret_value/)).toBeInTheDocument();
    expect(screen.getByText("Public data key")).toBeInTheDocument();
  });

  it("renders p3 pages in english when locale is switched", async () => {
    localStorage.setItem("qa_locale", "en-US");

    const first = renderAppAt("/assistant");
    expect(await screen.findByRole("heading", { name: "Assistant" })).toBeInTheDocument();
    expect(screen.getByText("Start a new thread")).toBeInTheDocument();
    first.unmount();

    renderAppAt("/developers/docs");
    expect(await screen.findByRole("heading", { name: "API docs" })).toBeInTheDocument();
    expect(screen.getByText("Authentication")).toBeInTheDocument();
    expect(screen.getByText("Question identifier")).toBeInTheDocument();
  });

  it("separates success responses from errors and shows a neutral empty-example state", async () => {
    renderAppAt("/developers/docs");

    const questionListCard = (await screen.findByRole("heading", { name: "List public questions" })).closest("article");
    expect(questionListCard).not.toBeNull();
    const responsesPanel = within(questionListCard as HTMLElement).getByLabelText("List public questions 响应");
    const errorsPanel = within(questionListCard as HTMLElement).getByLabelText("List public questions 错误码");

    expect(within(responsesPanel).getByText("200")).toBeInTheDocument();
    expect(within(errorsPanel).queryByText("200")).not.toBeInTheDocument();
    expect(within(errorsPanel).getByText("401")).toBeInTheDocument();

    const detailCard = screen.getByRole("heading", { name: "Get public question detail" }).closest("article");
    expect(detailCard).not.toBeNull();
    expect(within(detailCard as HTMLElement).getByText("暂无示例。")).toBeInTheDocument();
  });
});
