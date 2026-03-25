import { Copy, RefreshCcw, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { apiFetch, apiRequest } from "../api/client";
import { MarkdownRenderer } from "../components/content/markdown-renderer";
import { useI18n } from "../i18n";
import { getP3Copy } from "../utils/p3-copy";
import type { AssistantCitation, AssistantContextRef, AssistantMessage, AssistantReplyMeta, AssistantThread } from "../types";

type AssistantThreadDetail = AssistantThread & { messages: AssistantMessage[] };
type AssistantQueryResponse = { threadId: number; message: AssistantMessage & { meta?: AssistantReplyMeta } };
type MentionState = { query: string; start: number; end: number };
type LegacySearchResponse = {
  questions?: Array<{ id: number; title: string; content?: string }>;
  articles?: Array<{ id: number; title: string; excerpt?: string; content?: string }>;
};

const parseAssistantStreamBlock = (block: string) => {
  let event = "message";
  let data = "";

  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      data += line.slice(5).trim();
    }
  }

  if (!data) return null;
  return {
    event,
    data: JSON.parse(data),
  };
};

const consumeAssistantStream = async (
  response: Response,
  handlers: {
    onThread: (threadId: number) => void;
    onDelta: (content: string) => void;
    onDone: (payload: AssistantQueryResponse) => void;
    onError: (message: string) => void;
  },
): Promise<AssistantQueryResponse | null> => {
  if (!response.body) {
    throw new Error("Assistant stream unavailable");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload: AssistantQueryResponse | null = null;

  const flushBlock = (block: string) => {
    const payload = parseAssistantStreamBlock(block);
    if (!payload) return;
    if (payload.event === "thread") {
      handlers.onThread(payload.data.threadId);
      return;
    }
    if (payload.event === "delta") {
      handlers.onDelta(payload.data.content || "");
      return;
    }
    if (payload.event === "done") {
      finalPayload = payload.data;
      handlers.onDone(payload.data);
      return;
    }
    if (payload.event === "error") {
      handlers.onError(payload.data.message || "Stream failed");
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";
    for (const block of blocks) {
      flushBlock(block);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    flushBlock(buffer);
  }

  return finalPayload;
};

const extractMentionState = (value: string, caret: number): MentionState | null => {
  const beforeCaret = value.slice(0, caret);
  const match = beforeCaret.match(/(?:^|\s)@([^\s@]*)$/);
  if (!match) return null;
  const query = match[1] || "";
  const end = caret;
  const start = end - query.length - 1;
  return { query, start, end };
};

const uniqueReferences = (items: AssistantCitation[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.targetType}:${item.targetId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeExcerpt = (value?: string) => (value || "").replace(/\s+/g, " ").trim().slice(0, 140);

const mapLegacySearchToReferences = (payload: LegacySearchResponse): AssistantCitation[] =>
  uniqueReferences([
    ...(payload.questions || []).map((item) => ({
      targetType: "question" as const,
      targetId: item.id,
      title: item.title,
      excerpt: normalizeExcerpt(item.content),
      link: `/question/${item.id}`,
    })),
    ...(payload.articles || []).map((item) => ({
      targetType: "article" as const,
      targetId: item.id,
      title: item.title,
      excerpt: normalizeExcerpt(item.excerpt || item.content),
      link: `/articles/${item.id}`,
    })),
  ]);

export function AssistantPage() {
  const { locale } = useI18n();
  const copy = getP3Copy(locale).assistant;
  const [params, setParams] = useSearchParams();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [threads, setThreads] = useState<AssistantThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [messageMetaMap, setMessageMetaMap] = useState<Record<number, AssistantReplyMeta>>({});
  const [streamingMessageId, setStreamingMessageId] = useState<number | null>(null);
  const [query, setQuery] = useState(params.get("q") || "");
  const [selectedRefs, setSelectedRefs] = useState<AssistantCitation[]>([]);
  const [mentionState, setMentionState] = useState<MentionState | null>(null);
  const [referenceOptions, setReferenceOptions] = useState<AssistantCitation[]>([]);
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [referenceError, setReferenceError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [assistantNotice, setAssistantNotice] = useState("");
  const selectedThread = useMemo(() => threads.find((thread) => thread.id === selectedThreadId) || null, [selectedThreadId, threads]);
  const referenceTypeLabels = {
    question: copy.referenceTypeQuestion,
    article: copy.referenceTypeArticle,
    answer: copy.referenceTypeAnswer,
    comment: copy.referenceTypeComment,
  } as const;

  const decorateMessages = (items: AssistantMessage[], transientMeta: Record<number, AssistantReplyMeta> = {}) =>
    items.map((message) => ({
      ...message,
      meta: message.meta || transientMeta[message.id] || messageMetaMap[message.id],
    }));

  const refreshThreads = async () => {
    const nextThreads = await apiRequest<AssistantThread[]>("/assistant/threads");
    setThreads(nextThreads);
    return nextThreads;
  };

  const loadThread = async (threadId: number, transientMeta: Record<number, AssistantReplyMeta> = {}) => {
    const detail = await apiRequest<AssistantThreadDetail>(`/assistant/threads/${threadId}`);
    setAssistantNotice("");
    setSelectedThreadId(threadId);
    setMessages(decorateMessages(detail.messages || [], transientMeta));
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
    const previousMessages = messages;
    const optimisticUserId = -Date.now();
    const optimisticAssistantId = optimisticUserId - 1;
    setMessages((current) => [
      ...current,
      { id: optimisticUserId, role: "user", content: trimmed },
      { id: optimisticAssistantId, role: "assistant", content: "" },
    ]);
    setStreamingMessageId(optimisticAssistantId);

    let sawStreamEvent = false;
    try {
      const response = await apiFetch("/assistant/query/stream", {
        method: "POST",
        body: JSON.stringify({
          threadId: selectedThreadId ?? undefined,
          query: trimmed,
          contextRefs: selectedRefs.map((item): AssistantContextRef => ({ targetType: item.targetType, targetId: item.targetId })),
        }),
      });
      const finalPayload: AssistantQueryResponse | null = await consumeAssistantStream(response, {
        onThread: (threadId) => {
          sawStreamEvent = true;
          setSelectedThreadId(threadId);
          setParams((current) => {
            const next = new URLSearchParams(current);
            next.set("thread", String(threadId));
            return next;
          }, { replace: true });
        },
        onDelta: (content) => {
          sawStreamEvent = true;
          setMessages((current) =>
            current.map((message) => (message.id === optimisticAssistantId ? { ...message, content: `${message.content}${content}` } : message)),
          );
        },
        onDone: (payload) => {
          sawStreamEvent = true;
        },
        onError: (message) => {
          throw new Error(message);
        },
      });
      if (!finalPayload) {
        throw new Error("Assistant stream ended unexpectedly");
      }
      const transientMeta = finalPayload.message.meta ? { [finalPayload.message.id]: finalPayload.message.meta } : {};
      if (finalPayload.message.meta) {
        setMessageMetaMap((current) => ({ ...current, [finalPayload.message.id]: finalPayload.message.meta as AssistantReplyMeta }));
      }
      await refreshThreads();
      await loadThread(finalPayload.threadId, transientMeta);
      if (finalPayload.message.meta?.degraded) {
        setAssistantNotice(copy.noticeDegraded);
      }
      setQuery("");
      setSelectedRefs([]);
      setMentionState(null);
      setReferenceOptions([]);
    } catch (err) {
      if (!sawStreamEvent) {
        setMessages(previousMessages);
      }
      setError((err as Error).message);
    } finally {
      setStreamingMessageId(null);
      setPending(false);
    }
  };

  const clearSelection = () => {
    setAssistantNotice("");
    setSelectedThreadId(null);
    setMessages([]);
    setSelectedRefs([]);
    setMentionState(null);
    setReferenceOptions([]);
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

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!mentionState || !mentionState.query.trim()) {
        setReferenceOptions([]);
        setReferenceLoading(false);
        setReferenceError("");
        return;
      }
      setReferenceLoading(true);
      setReferenceError("");
      try {
        const refs = await apiRequest<AssistantCitation[]>(`/assistant/references?q=${encodeURIComponent(mentionState.query.trim())}`);
        if (active) {
          const selectedKeys = new Set(selectedRefs.map((item) => `${item.targetType}:${item.targetId}`));
          setReferenceOptions(refs.filter((item) => !selectedKeys.has(`${item.targetType}:${item.targetId}`)));
        }
      } catch {
        try {
          const legacy = await apiRequest<LegacySearchResponse>(
            `/search?q=${encodeURIComponent(mentionState.query.trim())}&types=questions,articles`,
          );
          if (active) {
            const selectedKeys = new Set(selectedRefs.map((item) => `${item.targetType}:${item.targetId}`));
            setReferenceOptions(
              mapLegacySearchToReferences(legacy).filter((item) => !selectedKeys.has(`${item.targetType}:${item.targetId}`)),
            );
          }
        } catch {
          if (active) {
            setReferenceOptions([]);
            setReferenceError(copy.referencesUnavailable);
          }
        }
      } finally {
        if (active) setReferenceLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [mentionState?.query, selectedRefs]);

  const lastUserPrompt = [...messages].reverse().find((item) => item.role === "user")?.content || "";

  const applyMentionState = (value: string, caret: number) => {
    const nextMention = extractMentionState(value, caret);
    setMentionState(nextMention && nextMention.query.trim() ? nextMention : null);
  };

  const removeSelectedRef = (targetType: AssistantCitation["targetType"], targetId: number) => {
    setSelectedRefs((current) => current.filter((item) => !(item.targetType === targetType && item.targetId === targetId)));
  };

  const addSelectedRef = (item: AssistantCitation) => {
    setSelectedRefs((current) => {
      if (current.some((existing) => existing.targetType === item.targetType && existing.targetId === item.targetId)) {
        return current;
      }
      return [...current, item];
    });

    if (!mentionState) return;
    const nextValue = `${query.slice(0, mentionState.start)}${query.slice(mentionState.end)}`.replace(/\s{2,}/g, " ");
    setQuery(nextValue);
    setMentionState(null);
    setReferenceOptions([]);
    setReferenceError("");

    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(mentionState.start, mentionState.start);
    });
  };

  return (
    <section className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="app-panel-dark rounded-[2rem] p-4">
        <div className="mb-4">
          <p className="app-kicker !text-[#d8c6a3]">{copy.sidebarKicker}</p>
          <h1 className="app-display mt-2 text-3xl font-semibold text-[#f8f1e3]">{copy.title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">{copy.subtitle}</p>
        </div>
        <button type="button" className="mb-4 w-full rounded-[1rem] border border-white/12 bg-white/10 px-3 py-2.5 text-sm text-white hover:bg-white/14" onClick={clearSelection}>
          {copy.newThread}
        </button>
        <div className="space-y-2">
          {threads.map((thread) => (
            <div key={thread.id} className={`rounded-[1.2rem] border px-3 py-3 ${selectedThreadId === thread.id ? "border-[#e1c18c] bg-white/12" : "border-white/10 bg-black/10"}`}>
              <div className="flex items-start gap-2">
                <button type="button" onClick={() => loadThread(thread.id)} className="min-w-0 flex-1 text-left">
                  <p className="line-clamp-1 text-sm font-medium text-[#f8f1e3]">{thread.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-300">{thread.lastMessage || copy.emptyThreadSummary}</p>
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/12 bg-white/10 p-2 text-slate-200 hover:text-[#f0c06f]"
                  aria-label={copy.deleteThreadAria(thread.title)}
                  onClick={() => deleteThread(thread.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {!threads.length && <p className="rounded-[1.2rem] border border-dashed border-white/16 p-4 text-sm text-slate-300">{copy.emptyThreads}</p>}
        </div>
      </aside>

      <div className="space-y-4">
        <header className="app-panel app-mesh rounded-[2rem] px-6 py-6">
          <p className="app-kicker">{copy.heroKicker}</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="app-display text-3xl font-semibold text-slate-900">{selectedThread?.title || copy.threadTitleFallback}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">{copy.threadSubtitle}</p>
            </div>
            {lastUserPrompt ? (
              <button type="button" className="app-button-ghost inline-flex items-center rounded-[1rem] px-3 py-2 text-xs font-semibold" onClick={() => askAssistant(lastUserPrompt)}>
                <RefreshCcw className="mr-1 h-3.5 w-3.5" />
                {copy.regenerate}
              </button>
            ) : null}
          </div>
        </header>

        {assistantNotice ? <div className="rounded-[1.3rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{assistantNotice}</div> : null}

        <div className="app-panel rounded-[2rem] p-4 sm:p-5">
          <div className="mb-4 space-y-3">
            {messages.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white/60 p-10 text-center text-sm text-slate-500">
                {copy.emptyState}
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`rounded-[1.5rem] p-4 ${message.role === "assistant" ? "border border-slate-200 bg-white/80" : "border border-emerald-100 bg-emerald-50/70"}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-900">
                        {message.role === "assistant" ? <Sparkles className="h-4 w-4 text-[var(--accent)]" /> : null}
                        {message.role === "assistant" ? copy.assistantName : copy.you}
                      </span>
                      {message.role === "assistant" && streamingMessageId === message.id ? (
                        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">
                          {copy.assistantGenerating}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {message.role === "assistant" && message.meta ? (
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${message.meta.degraded ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                          {message.meta.degraded ? copy.assistantSourceLocal : copy.assistantSourceRemote}
                        </span>
                      ) : null}
                      {message.role === "assistant" ? (
                        <button
                          type="button"
                          className="app-button-ghost inline-flex items-center rounded-full px-3 py-1.5 text-xs"
                          onClick={() => navigator.clipboard.writeText(message.content).catch(() => undefined)}
                        >
                          <Copy className="mr-1 h-3 w-3" />
                          {copy.copy}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="relative">
                    <MarkdownRenderer content={message.content} />
                    {message.role === "assistant" && streamingMessageId === message.id ? <span aria-hidden="true" className="assistant-caret ml-1 inline-block align-middle" /> : null}
                  </div>
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
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{copy.referencesHint}</p>
              {selectedRefs.length ? (
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-500">{copy.referencesSelected}</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedRefs.map((item) => (
                      <span key={`${item.targetType}:${item.targetId}`} className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
                        <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-slate-500">{referenceTypeLabels[item.targetType]}</span>
                        <span className="max-w-[18rem] truncate">{item.title}</span>
                        <button
                          type="button"
                          aria-label={`${copy.referencesRemove} ${item.title}`}
                          className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                          onClick={() => removeSelectedRef(item.targetType, item.targetId)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <textarea
              ref={textareaRef}
              value={query}
              onChange={(event) => {
                const nextValue = event.target.value;
                setQuery(nextValue);
                applyMentionState(nextValue, event.target.selectionStart ?? nextValue.length);
              }}
              onClick={(event) => applyMentionState(query, (event.target as HTMLTextAreaElement).selectionStart ?? query.length)}
              onKeyUp={(event) => applyMentionState((event.target as HTMLTextAreaElement).value, (event.target as HTMLTextAreaElement).selectionStart ?? query.length)}
              placeholder={copy.textareaPlaceholder}
              className="app-input min-h-32 rounded-[1.5rem] p-4 text-sm leading-7"
            />
            {mentionState ? (
              <div className="rounded-[1.3rem] border border-slate-200 bg-white/90 p-3 shadow-sm">
                {referenceLoading ? (
                  <p className="text-sm text-slate-500">{copy.referencesSearching}</p>
                ) : referenceError ? (
                  <p className="text-sm text-amber-700">{referenceError}</p>
                ) : referenceOptions.length ? (
                  <div className="space-y-2">
                    {referenceOptions.map((item) => (
                      <button
                        key={`${item.targetType}:${item.targetId}`}
                        type="button"
                        className="flex w-full items-start gap-3 rounded-[1rem] border border-transparent px-3 py-2 text-left hover:border-slate-200 hover:bg-slate-50"
                        onClick={() => addSelectedRef(item)}
                      >
                        <span className="mt-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          {referenceTypeLabels[item.targetType]}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-900">{item.title}</span>
                          <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500">{item.excerpt}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">{copy.referencesEmpty}</p>
                )}
              </div>
            ) : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex justify-end">
              <button type="submit" disabled={!query.trim() || pending} className="app-button-primary rounded-[1rem] px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">
                {pending ? copy.submitPending : copy.submitIdle}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
