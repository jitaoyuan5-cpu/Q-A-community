import { useMemo } from "react";
import { Flame, MessageSquare, TrendingUp } from "lucide-react";
import { useQA } from "../store/qa-context";
import { Link, useSearchParams } from "react-router";

export function HotTopicsPage() {
  const { state } = useQA();
  const [params, setParams] = useSearchParams();
  const category = params.get("category") || "全部";

  const categories = useMemo(() => ["全部", ...Array.from(new Set(state.topics.map((topic) => topic.category)))], [state.topics]);
  const topics = useMemo(
    () =>
      state.topics
        .filter((topic) => category === "全部" || topic.category === category)
        .sort((a, b) => b.trend - a.trend),
    [category, state.topics],
  );

  return (
    <section>
      <header className="mb-5 flex items-center gap-3">
        <Flame className="h-7 w-7 text-orange-500" />
        <div>
          <h1 className="text-2xl font-semibold">热门话题</h1>
          <p className="text-sm text-slate-600">按分类浏览社区讨论与热度趋势</p>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((item) => (
          <button
            key={item}
            onClick={() => {
              const next = new URLSearchParams(params);
              if (item === "全部") next.delete("category");
              else next.set("category", item);
              setParams(next, { replace: true });
            }}
            className={`rounded-full border px-3 py-1 text-sm ${category === item ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700"}`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {topics.map((topic) => (
          <article key={topic.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <Link to={`/questions?q=${encodeURIComponent(topic.title)}`} className="font-semibold hover:text-blue-600">{topic.title}</Link>
              <span className="inline-flex items-center rounded-full bg-orange-500 px-2 py-1 text-xs text-white">
                <TrendingUp className="mr-1 h-3 w-3" />+{topic.trend}%
              </span>
            </div>
            <p className="mb-3 text-sm text-slate-600">{topic.description}</p>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <Link to={`/hot?category=${encodeURIComponent(topic.category)}`} className="hover:text-blue-600">{topic.category}</Link>
              <span className="inline-flex items-center gap-1"><MessageSquare className="h-4 w-4" />{topic.posts}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
