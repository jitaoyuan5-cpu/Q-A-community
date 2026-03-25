import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DB_HOST = process.env.DB_HOST || "127.0.0.1";
process.env.DB_PORT = process.env.DB_PORT || "3306";
process.env.DB_USER = process.env.DB_USER || "root";
process.env.DB_NAME = process.env.DB_NAME || "qa_community";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_access_secret";
process.env.REFRESH_SECRET = process.env.REFRESH_SECRET || "test_refresh_secret";

const queryMock = vi.fn();
const broadcastMock = vi.fn();
const getOnlineCountMock = vi.fn();
const searchSourcesMock = vi.fn();
const generateReplyMock = vi.fn();
const streamReplyMock = vi.fn();

vi.mock("../../src/db/pool.js", () => ({
  pool: { query: queryMock },
  withTx: async (fn) => fn({ query: queryMock }),
}));

vi.mock("../../src/realtime/question-chat.js", () => ({
  broadcastQuestionChatMessage: (...args) => broadcastMock(...args),
  getOnlineCount: (...args) => getOnlineCountMock(...args),
  attachQuestionChatServer: vi.fn(),
}));

vi.mock("../../src/utils/assistant.js", () => ({
  searchAssistantSources: (...args) => searchSourcesMock(...args),
  generateAssistantReply: (...args) => generateReplyMock(...args),
  streamAssistantReply: (...args) => streamReplyMock(...args),
}));

vi.mock("../../src/utils/api-keys.js", () => ({
  generateApiKey: () => ({
    raw: "qak_test_secret_value",
    keyHash: "a".repeat(64),
    keyPrefix: "qak_test_sec",
  }),
  publicApiLimitPerHour: 120,
}));

const { app } = await import("../../src/app.js");

const bearer = (userId = 1) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1h" });
  return `Bearer ${token}`;
};

describe("p3 features integration", () => {
  beforeEach(() => {
    queryMock.mockReset();
    broadcastMock.mockReset();
    getOnlineCountMock.mockReset();
    searchSourcesMock.mockReset();
    generateReplyMock.mockReset();
    streamReplyMock.mockReset();
    getOnlineCountMock.mockReturnValue(0);
  });

  it("creates an assistant thread and reply with citations", async () => {
    searchSourcesMock.mockResolvedValueOnce([
      {
        targetType: "question",
        targetId: 1,
        title: "React Hooks 深入训练营",
        excerpt: "Hooks 组合与性能优化",
        link: "/tutorials/1",
      },
    ]);
    generateReplyMock.mockResolvedValueOnce({
      content: "优先梳理状态边界，再决定是否使用 reducer。",
      provider: "local",
      degraded: true,
      reason: "timeout",
    });
    queryMock
      .mockResolvedValueOnce([[{ preferred_locale: "en-US" }]])
      .mockResolvedValueOnce([{ insertId: 5 }])
      .mockResolvedValueOnce([{ insertId: 6 }])
      .mockResolvedValueOnce([[{ role: "user", content: "什么时候应该用 useReducer" }]])
      .mockResolvedValueOnce([{ insertId: 7 }])
      .mockResolvedValueOnce([{}]);

    const res = await request(app)
      .post("/api/assistant/query")
      .set("Authorization", bearer())
      .send({ query: "什么时候应该用 useReducer" });

    expect(res.status).toBe(201);
    expect(res.body.threadId).toBe(5);
    expect(res.body.message.content).toContain("状态边界");
    expect(res.body.message.citations).toHaveLength(1);
    expect(res.body.message.meta).toEqual({
      provider: "local",
      degraded: true,
      reason: "timeout",
    });
    expect(searchSourcesMock).toHaveBeenCalledWith("什么时候应该用 useReducer");
    expect(generateReplyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "en-US",
        query: "什么时候应该用 useReducer",
      }),
    );
  });

  it("merges explicit assistant context refs into the generated citations", async () => {
    searchSourcesMock.mockResolvedValueOnce([]);
    generateReplyMock.mockResolvedValueOnce({
      content: "我会优先引用你指定的问题。",
      provider: "compatible",
      degraded: false,
      reason: null,
    });
    queryMock
      .mockResolvedValueOnce([[{ preferred_locale: "zh-CN" }]])
      .mockResolvedValueOnce([{ insertId: 15 }])
      .mockResolvedValueOnce([{ insertId: 16 }])
      .mockResolvedValueOnce([[{ role: "user", content: "帮我引用这条内容" }]])
      .mockResolvedValueOnce([[{ id: 21, title: "React Hooks 深入训练营", excerpt: "用 6 节课系统掌握 Hooks 组合与性能优化。" }]])
      .mockResolvedValueOnce([{ insertId: 17 }])
      .mockResolvedValueOnce([{}]);

    const res = await request(app)
      .post("/api/assistant/query")
      .set("Authorization", bearer())
      .send({
        query: "帮我引用这条内容",
        contextRefs: [{ targetType: "question", targetId: 21 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.message.citations).toEqual([
      {
        targetType: "question",
        targetId: 21,
        title: "React Hooks 深入训练营",
        excerpt: "用 6 节课系统掌握 Hooks 组合与性能优化。",
        link: "/question/21",
      },
    ]);
    expect(generateReplyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        citations: [
          {
            targetType: "question",
            targetId: 21,
            title: "React Hooks 深入训练营",
            excerpt: "用 6 节课系统掌握 Hooks 组合与性能优化。",
            link: "/question/21",
          },
        ],
      }),
    );
  });

  it("streams an assistant reply and flushes the final message payload", async () => {
    searchSourcesMock.mockResolvedValueOnce([
      {
        targetType: "question",
        targetId: 1,
        title: "React Hooks 深入训练营",
        excerpt: "Hooks 组合与性能优化",
        link: "/tutorials/1",
      },
    ]);
    streamReplyMock.mockImplementationOnce(async ({ onChunk }) => {
      await onChunk("先看状态边界，");
      await onChunk("再决定是否拆 reducer。");
      return {
        content: "先看状态边界，再决定是否拆 reducer。",
        provider: "compatible",
        degraded: false,
        reason: null,
      };
    });
    queryMock
      .mockResolvedValueOnce([[{ preferred_locale: "en-US" }]])
      .mockResolvedValueOnce([{ insertId: 5 }])
      .mockResolvedValueOnce([{ insertId: 6 }])
      .mockResolvedValueOnce([[{ role: "user", content: "什么时候应该用 useReducer" }]])
      .mockResolvedValueOnce([{ insertId: 7 }])
      .mockResolvedValueOnce([{}]);

    const res = await request(app)
      .post("/api/assistant/query/stream")
      .set("Authorization", bearer())
      .send({ query: "什么时候应该用 useReducer" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("event: thread");
    expect(res.text).toContain("event: delta");
    expect(res.text).toContain("event: done");
    expect(res.text).toContain("先看状态边界，再决定是否拆 reducer。");
    expect(streamReplyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "en-US",
        query: "什么时候应该用 useReducer",
      }),
    );
  });

  it("returns assistant reference suggestions for questions, articles, answers, and comments", async () => {
    queryMock
      .mockResolvedValueOnce([[{ id: 21, title: "React Hooks 深入训练营", excerpt: "问题摘要" }]])
      .mockResolvedValueOnce([[{ id: 22, title: "React Hooks 文章", excerpt: "文章摘要" }]])
      .mockResolvedValueOnce([[{ id: 31, question_id: 21, title: "React Hooks 深入训练营", excerpt: "回答摘要" }]])
      .mockResolvedValueOnce([[{ id: 41, question_id: 21, question_title: "React Hooks 深入训练营", excerpt: "评论摘要" }]]);

    const res = await request(app)
      .get("/api/assistant/references?q=React")
      .set("Authorization", bearer());

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        targetType: "question",
        targetId: 21,
        title: "React Hooks 深入训练营",
        excerpt: "问题摘要",
        link: "/question/21",
      },
      {
        targetType: "article",
        targetId: 22,
        title: "React Hooks 文章",
        excerpt: "文章摘要",
        link: "/articles/22",
      },
      {
        targetType: "answer",
        targetId: 31,
        title: "回答 · React Hooks 深入训练营",
        excerpt: "回答摘要",
        link: "/question/21#answer-31",
      },
      {
        targetType: "comment",
        targetId: 41,
        title: "评论 · React Hooks 深入训练营",
        excerpt: "评论摘要",
        link: "/question/21#comment-41",
      },
    ]);
  });

  it("returns assistant thread detail for the current user", async () => {
    queryMock
      .mockResolvedValueOnce([[{ id: 8, title: "Hooks 调试", created_at: "2026-03-20", updated_at: "2026-03-20" }]])
      .mockResolvedValueOnce([[
        {
          id: 10,
          role: "assistant",
          content: "先定位状态来源。",
          citations_json: JSON.stringify([{ targetType: "question", targetId: 1, title: "Hooks", excerpt: "desc", link: "/question/1" }]),
          created_at: "2026-03-20",
        },
      ]]);

    const res = await request(app).get("/api/assistant/threads/8").set("Authorization", bearer());

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(8);
    expect(res.body.messages[0].citations[0].link).toBe("/question/1");
  });

  it("deletes an assistant thread owned by the current user", async () => {
    queryMock.mockResolvedValueOnce([[{ id: 8 }]]).mockResolvedValueOnce([{}]);

    const res = await request(app).delete("/api/assistant/threads/8").set("Authorization", bearer());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("lists and creates question chat messages with online count", async () => {
    getOnlineCountMock.mockReturnValue(4);
    queryMock
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([[
        {
          id: 11,
          question_id: 1,
          content: "这里可以先拆 reducer。",
          created_at: "2026-03-20T00:00:00.000Z",
          updated_at: "2026-03-20T00:00:00.000Z",
          user_id: 2,
          author_name: "Bob",
          author_avatar: "",
        },
      ]]);

    const listRes = await request(app).get("/api/question-chats/1/messages");
    expect(listRes.status).toBe(200);
    expect(listRes.body.onlineCount).toBe(4);
    expect(listRes.body.items[0].author.name).toBe("Bob");

    queryMock
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([{ insertId: 12 }])
      .mockResolvedValueOnce([[
        {
          id: 12,
          question_id: 1,
          content: "先确认 action 设计。",
          created_at: "2026-03-20T00:00:01.000Z",
          updated_at: "2026-03-20T00:00:01.000Z",
          user_id: 1,
          author_name: "Alice",
          author_avatar: "",
        },
      ]]);

    const createRes = await request(app)
      .post("/api/question-chats/1/messages")
      .set("Authorization", bearer())
      .send({ content: "先确认 action 设计。" });

    expect(createRes.status).toBe(201);
    expect(createRes.body.messageId).toBe(12);
    expect(broadcastMock).toHaveBeenCalledWith(1, 12);
  });

  it("updates tutorial progress for a valid lesson", async () => {
    queryMock
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([[{ id: 2 }]])
      .mockResolvedValueOnce([{}]);

    const res = await request(app)
      .put("/api/tutorials/1/progress")
      .set("Authorization", bearer())
      .send({ lessonId: 2, progressPercent: 75 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("returns a friendly tutorial validation error", async () => {
    queryMock.mockResolvedValueOnce([[{ role: "admin" }]]);

    const res = await request(app)
      .post("/api/admin/tutorials")
      .set("Authorization", bearer())
      .send({
        title: "A",
        summary: "too short",
        description: "still short",
        difficulty: "beginner",
        lessons: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("教程标题至少 2 个字");
  });

  it("returns a friendly unsupported tutorial video error", async () => {
    queryMock.mockResolvedValueOnce([[{ role: "admin" }]]).mockResolvedValueOnce([{ insertId: 3 }]);

    const res = await request(app)
      .post("/api/admin/tutorials")
      .set("Authorization", bearer())
      .send({
        title: "React Hooks 深入训练营",
        summary: "一门用于验证后台表单错误提示的测试课程摘要",
        description: "这门课程会覆盖 Hooks 的职责划分和常见状态设计。",
        difficulty: "beginner",
        tags: [],
        lessons: [
          {
            title: "第一课",
            description: "先看整体结构",
            sortOrder: 1,
            videoUrl: "https://example.com/not-supported",
            durationSeconds: 300,
            starterTemplate: null,
            starterFiles: null,
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("第 1 个课时的视频地址只支持 YouTube、Bilibili 或 Vimeo");
  });

  it("creates and revokes developer api keys", async () => {
    queryMock
      .mockResolvedValueOnce([[{ count: 0 }]])
      .mockResolvedValueOnce([{ insertId: 6 }]);

    const createRes = await request(app)
      .post("/api/developer/keys")
      .set("Authorization", bearer())
      .send({ name: "Readonly key" });

    expect(createRes.status).toBe(201);
    expect(createRes.body.secret).toBe("qak_test_secret_value");
    expect(createRes.body.keyPrefix).toBe("qak_test_sec");

    queryMock.mockResolvedValueOnce([{}]);
    const revokeRes = await request(app).delete("/api/developer/keys/6").set("Authorization", bearer());

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.success).toBe(true);
  });

  it("returns an expanded openapi document for the public api", async () => {
    const res = await request(app).get("/api/public/v1/openapi.json");

    expect(res.status).toBe(200);
    expect(res.body.components.securitySchemes.apiKeyAuth.name).toBe("x-api-key");
    expect(res.body.paths["/api/public/v1/questions"].get.responses["200"].description).toBeTruthy();
    expect(res.body.paths["/api/public/v1/questions/{id}"].get.parameters[0].$ref).toBe("#/components/parameters/QuestionId");
  });
});
