import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { apiRequest } from "../api/client";

type QuestionSearchItem = { id: number; title: string };
type ArticleSearchItem = { id: number; title: string };
type UserSearchItem = { id: number; name: string };

type SearchResult = {
  questions: QuestionSearchItem[];
  articles: ArticleSearchItem[];
  users: UserSearchItem[];
};

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  const [data, setData] = useState<SearchResult>({
    questions: [],
    articles: [],
    users: [],
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!q.trim()) return;
    apiRequest<SearchResult>(`/search?q=${encodeURIComponent(q)}&types=questions,articles,users`)
      .then(setData)
      .catch((error: unknown) => setError(error instanceof Error ? error.message : "Search failed"));
  }, [q]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">统一搜索：{q || "(空)"}</h1>
        {q ? (
          <Link to={`/assistant?q=${encodeURIComponent(q)}`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            交给 AI 助手分析
          </Link>
        ) : null}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-semibold">问题</h2>
          {data.questions.map((item) => <Link key={item.id} to={`/question/${item.id}`} className="mb-2 block text-sm hover:text-blue-600">{item.title}</Link>)}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-semibold">文章</h2>
          {data.articles.map((item) => <Link key={item.id} to={`/articles/${item.id}`} className="mb-2 block text-sm hover:text-blue-600">{item.title}</Link>)}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-semibold">用户</h2>
          {data.users.map((item) => <Link key={item.id} to={`/profile/${item.id}`} className="mb-2 block text-sm hover:text-blue-600">{item.name}</Link>)}
        </div>
      </div>
    </section>
  );
}
