import { Copy, RefreshCcw, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { apiRequest } from "../api/client";
import { MarkdownRenderer } from "../components/content/markdown-renderer";
import type { AssistantMessage, AssistantReplyMeta, AssistantThread } from "../types";

type AssistantThreadDetail = AssistantThread & { messages: AssistantMessage[] };
type AssistantQueryResponse = { threadId: number; message: AssistantMessage & { meta?: AssistantReplyMeta } };

export function AssistantPage() {
  const [params, setParams] = useSearchParams();
  const [threads, setThreads] = useState<AssistantThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [query, setQuery] = useState(params.get("q") || "");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [assistantNotice, setAssistantNotice] = useState("");
  const selectedThread = useMemo(() => threads.find((thread) => thread.id === selectedThreadId) || null, [selectedThreadId, threads]);

  const refreshThreads = async () => {
    const nextThreads = await apiRequest<AssistantThread[]>("/assistant/threads");
    setThreads(nextThreads);
    return nextThreads;
  };

  const loadThread = async (threadId: number) => {
    const detail = await apiRequest<AssistantThreadDetail>(`/assistant/threads/${threadId}`);
    setAssistantNotice("");
    setSelectedThreadId(threadId);
    setMessages(detail.messages || []);
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("thread", String(threadId));
      return next;
    }, { replace: true });
  };

  const askAssistant = async (nextQuery: string) => {
    const trimmed = nextQuery.trim();
    if (!trimmed) return;
    setPending(true);
    setError("");
    setAssistantNotice("");
    try {
      const response = await apiRequest<AssistantQueryResponse>("/assistant/query", {
        method: "POST",
        body: JSON.stringify({ threadId: selectedThreadId ?? undefined, query: trimmed }),
      });
      await refreshThreads();
      await loadThread(response.threadId);
      if (response.message.meta?.degraded) {
        setAssistantNotice("远端 AI 服务当前不可用，本次结果已自动降级为站内本地回答。");
      }
      setQuery("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  const clearSelection = () => {
    setAssistantNotice("");
    setSelectedThreadId(null);
    setMessages([]);
    setParams(new URLSearchParams(), { replace: true });
  };

  const deleteThread = async (threadId: number) => {
    setError("");
    try {
      await apiRequest(`/assistant/threads/${threadId}`, { method: "DELETE" });
      const nextThreads = await refreshThreads();
      if (selectedThreadId === threadId) {
        const nextThreadId = nextThreads[0]?.id ?? null;
        if (nextThreadId) {
          await loadThread(nextThreadId);
        } else {
          clearSelection();
        }
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const nextThreads = await refreshThreads();
        const requestedThread = Number(params.get("thread"));
        const targetThread = requestedThread || nextThreads[0]?.id || null;
        if (active && targetThread) {
          await loadThread(targetThread);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const initialPrompt = params.get("q");
    if (!initialPrompt || loading || pending || messages.length > 0 || selectedThreadId) return;
    askAssistant(initialPrompt).catch(() => undefined);
  }, [loading, pending, messages.length, selectedThreadId]);

  const lastUserPrompt = [...messages].reverse().find((item) => item.role === "user")?.content || "";

  return (
    <section className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="app-panel-dark rounded-[2rem] p-4">
        <div className="mb-4">
          <p className="app-kicker !text-[#d8c6a3]">Research desk</p>
          <h1 className="app-display mt-2 text-3xl font-semibold text-[#f8f1e3]">AI 助手</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">优先检索站内的问题、答案和文章，再整理成可继续追问的分析记录。</p>
        </div>
        <button type="button" className="mb-4 w-full rounded-[1rem] border border-white/12 bg-white/10 px-3 py-2.5 text-sm text-white hover:bg-white/14" onClick={clearSelection}>
          新会话
        </button>
        <div className="space-y-2">
          {threads.map((thread) => (
            <div key={thread.id} className={`rounded-[1.2rem] border px-3 py-3 ${selectedThreadId === thread.id ? "border-[#e1c18c] bg-white/12" : "border-white/10 bg-black/10"}`}>
              <div className="flex items-start gap-2">
                <button type="button" onClick={() => loadThread(thread.id)} className="min-w-0 flex-1 text-left">
                  <p className="line-clamp-1 text-sm font-medium text-[#f8f1e3]">{thread.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-300">{thread.lastMessage || "暂无摘要"}</p>
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/12 bg-white/10 p-2 text-slate-200 hover:text-[#f0c06f]"
                  aria-label={`删除会话 ${thread.title}`}
                  onClick={() => deleteThread(thread.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {!threads.length && <p className="rounded-[1.2rem] border border-dashed border-white/16 p-4 text-sm text-slate-300">还没有历史会话。</p>}
        </div>
      </aside>

      <div className="space-y-4">
        <header className="app-panel app-mesh rounded-[2rem] px-6 py-6">
          <p className="app-kicker">Context-first assistant</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="app-display text-3xl font-semibold text-slate-900">{selectedThread?.title || "开始一个新会话"}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">回答默认优先引用社区里的问题、答案和文章，避免变成没有上下文的通用闲聊。</p>
            </div>
            {lastUserPrompt ? (
              <button type="button" className="app-button-ghost inline-flex items-center rounded-[1rem] px-3 py-2 text-xs font-semibold" onClick={() => askAssistant(lastUserPrompt)}>
                <RefreshCcw className="mr-1 h-3.5 w-3.5" />
                重新生成
              </button>
            ) : null}
          </div>
        </header>

        {assistantNotice ? <div className="rounded-[1.3rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{assistantNotice}</div> : null}

        <div className="app-panel rounded-[2rem] p-4 sm:p-5">
          <div className="mb-4 space-y-3">
            {messages.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white/60 p-10 text-center text-sm text-slate-500">
                输入一个技术问题，AI 助手会先检索站内内容，再生成带引用的建议。
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`rounded-[1.5rem] p-4 ${message.role === "assistant" ? "border border-slate-200 bg-white/80" : "border border-emerald-100 bg-emerald-50/70"}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-900">
                      {message.role === "assistant" ? <Sparkles className="h-4 w-4 text-[var(--accent)]" /> : null}
                      {message.role === "assistant" ? "AI 助手" : "你"}
                    </span>
                    {message.role === "assistant" ? (
                      <button
                        type="button"
                        className="app-button-ghost inline-flex items-center rounded-full px-3 py-1.5 text-xs"
                        onClick={() => navigator.clipboard.writeText(message.content).catch(() => undefined)}
                      >
                        <Copy className="mr-1 h-3 w-3" />
                        复制
                      </button>
                    ) : null}
                  </div>
                  <MarkdownRenderer content={message.content} />
                  {message.citations?.length ? (
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {message.citations.map((citation) => (
                        <a key={`${citation.targetType}-${citation.targetId}`} href={citation.link} className="rounded-[1.2rem] border border-slate-200 bg-[rgba(245,240,232,0.86)] p-3 text-sm hover:border-[var(--accent)]">
                          <p className="mb-1 font-medium text-slate-900">{citation.title}</p>
                          <p className="line-clamp-2 text-xs leading-5 text-slate-500">{citation.excerpt}</p>
                          <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[var(--primary)]">{citation.targetType}</p>
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              await askAssistant(query);
            }}
          >
            <textarea
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例如：如何判断该用 useState 还是 useReducer？"
              className="app-input min-h-32 rounded-[1.5rem] p-4 text-sm leading-7"
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex justify-end">
              <button type="submit" disabled={!query.trim() || pending} className="app-button-primary rounded-[1rem] px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">
                {pending ? "分析中..." : "开始分析"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
