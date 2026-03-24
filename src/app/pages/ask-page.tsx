import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, X } from "lucide-react";
import { useQA } from "../store/qa-context";
import { validateQuestionDraft } from "../store/qa-reducer";
import { MarkdownEditor } from "../components/content/markdown-editor";

const suggestedTags = ["React", "JavaScript", "TypeScript", "Node.js", "CSS", "Next.js", "Tailwind CSS", "数据库"];

export function AskPage() {
  const { actions } = useQA();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const valid = useMemo(() => validateQuestionDraft(title, content, tags), [title, content, tags]);

  const addTag = (raw: string) => {
    const next = raw.trim();
    if (!next || tags.includes(next) || tags.length >= 5) return;
    setTags((prev) => [...prev, next]);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/" className="mb-4 inline-flex items-center text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="mr-1 h-4 w-4" />返回首页
      </Link>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="mb-4 text-2xl font-semibold">提出问题</h1>

        <form
          className="space-y-5"
          onSubmit={async (event) => {
            event.preventDefault();
            const id = await actions.addQuestion(title, content, tags);
            if (id) {
              navigate(`/question/${id}`);
            }
          }}
        >
          <div>
            <label htmlFor="title" className="mb-2 block text-sm font-medium">问题标题（1-200字）</label>
            <input id="title" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3 outline-none ring-blue-500 focus:ring-2" placeholder="例如：React 中 useState 和 useReducer 的区别是什么？" />
          </div>

          <div>
            <label htmlFor="content" className="mb-2 block text-sm font-medium">问题详情</label>
            <MarkdownEditor textareaId="content" value={content} onChange={setContent} placeholder="请描述问题背景、报错信息和你尝试过的方法" />
          </div>

          <div>
            <label htmlFor="tag" className="mb-2 block text-sm font-medium">标签（1-5个）</label>
            <div className="mb-2 flex gap-2">
              <input
                id="tag"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTag(tagInput);
                    setTagInput("");
                  }
                }}
                className="h-10 flex-1 rounded-lg border border-slate-200 px-3 outline-none ring-blue-500 focus:ring-2"
                placeholder="输入标签并回车"
                disabled={tags.length >= 5}
              />
              <button
                type="button"
                onClick={() => {
                  addTag(tagInput);
                  setTagInput("");
                }}
                className="rounded-lg border border-slate-200 px-3 text-sm"
              >
                添加
              </button>
            </div>
            <div className="mb-2 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
                  {tag}
                  <button type="button" onClick={() => setTags((prev) => prev.filter((item) => item !== tag))} className="ml-1 rounded-full p-0.5 hover:bg-blue-100">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestedTags.filter((tag) => !tags.includes(tag)).map((tag) => (
                <button key={tag} type="button" onClick={() => addTag(tag)} className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">+ {tag}</button>
              ))}
            </div>
          </div>

          <aside className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-700">
            <p className="mb-1 font-medium">提问建议</p>
            <ul className="list-inside list-disc space-y-1">
              <li>描述你已尝试的方法与结果</li>
              <li>包含关键错误信息或代码片段</li>
              <li>标签尽量贴近技术主题</li>
            </ul>
            <Link
              to={`/assistant?q=${encodeURIComponent([title, content].filter(Boolean).join("\n").trim() || "帮我整理一个适合提问的问题描述")}`}
              className="mt-3 inline-flex rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-blue-700"
            >
              先让 AI 助手帮我梳理问题
            </Link>
          </aside>

          <div className="flex gap-3">
            <button disabled={!valid} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400" type="submit">发布问题</button>
            <button type="button" onClick={() => navigate(-1)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">取消</button>
          </div>
        </form>
      </section>
    </div>
  );
}
