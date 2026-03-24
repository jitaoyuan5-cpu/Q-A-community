import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock, state } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  state: {
    threads: [] as any[],
    threadDetails: {} as Record<number, any>,
    developerKeys: [] as any[],
  },
}));

vi.mock("../../src/app/api/client", () => ({
  apiRequest: (...args: any[]) => apiRequestMock(...args),
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

    apiRequestMock.mockReset();
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

      if (path === "/assistant/threads") return state.threads;
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
      if (path === "/assistant/query" && options?.method === "POST") {
        const payload = JSON.parse(options.body || "{}");
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
              meta: {
                provider: "local",
                degraded: true,
                reason: "timeout",
              },
            },
          ],
        };
        return {
          threadId: 9,
          message: {
            id: 2,
            role: "assistant",
            content: "基于现有社区内容，建议先梳理状态边界，再决定是否升级到 reducer。",
            citations: state.threadDetails[9].messages[1].citations,
            meta: state.threadDetails[9].messages[1].meta,
          },
        };
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

      throw new Error(`Unhandled apiRequest mock for ${path}`);
    });
  });

  it("submits a prompt and renders assistant citations", async () => {
    const user = userEvent.setup();
    renderAppAt("/assistant");

    const input = await screen.findByPlaceholderText("例如：如何判断该用 useState 还是 useReducer？");
    await user.type(input, "什么时候应该用 useReducer");
    await user.click(screen.getByRole("button", { name: "开始分析" }));

    expect(await screen.findByText("React Hooks 深入训练营")).toBeInTheDocument();
    expect(screen.getByText("基于现有社区内容，建议先梳理状态边界，再决定是否升级到 reducer。")).toBeInTheDocument();
    expect(screen.getByText("远端 AI 服务当前不可用，本次结果已自动降级为站内本地回答。")).toBeInTheDocument();
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

  it("renders tutorial cards from the API", async () => {
    renderAppAt("/tutorials");

    expect(await screen.findByRole("heading", { name: "视频教程" })).toBeInTheDocument();
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
});
