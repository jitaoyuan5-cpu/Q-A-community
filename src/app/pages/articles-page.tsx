import { useMemo } from "react";
import { Clock, Eye, FileText, MessageSquare, ThumbsUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Link, useSearchParams } from "react-router";
import { useQA } from "../store/qa-context";
import { findUser } from "../store/selectors";
import { FavoriteButton } from "../components/content/favorite-button";

export function ArticlesPage() {
  const { state } = useQA();
  const [params, setParams] = useSearchParams();
  const tag = params.get("tag") || "全部";

  const tags = useMemo(() => ["全部", ...Array.from(new Set(state.articles.flatMap((item) => item.tags)))], [state.articles]);

  const articles = useMemo(
    () =>
      state.articles
        .filter((article) => tag === "全部" || article.tags.includes(tag))
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
    [state.articles, tag],
  );

  return (
    <section>
      <header className="mb-5 flex items-center gap-3">
        <FileText className="h-7 w-7 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-semibold">专栏文章</h1>
          <p className="text-sm text-slate-600">按标签筛选技术深度内容</p>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {tags.map((item) => (
          <button
            key={item}
            onClick={() => {
              const next = new URLSearchParams(params);
              if (item === "全部") next.delete("tag");
              else next.set("tag", item);
              setParams(next, { replace: true });
            }}
            className={`rounded-full border px-3 py-1 text-sm ${item === tag ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700"}`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {articles.map((article) => {
          const author = findUser(state, article.authorId);
          return (
            <article key={article.id} className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid-cols-[220px_minmax(0,1fr)]">
              <Link to={`/articles/${article.id}`} className="block">
                <img src={article.cover} alt={article.title} className="h-44 w-full object-cover md:h-full" />
              </Link>
              <div className="p-5">
                <Link to={`/articles/${article.id}`} className="mb-2 block text-lg font-semibold text-slate-900 hover:text-indigo-600">
                  {article.title}
                </Link>
                <p className="mb-3 text-sm text-slate-600">{article.excerpt}</p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {article.tags.map((item) => (
                    <Link key={item} to={`/articles?tag=${encodeURIComponent(item)}`} className="rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-700">
                      {item}
                    </Link>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true, locale: zhCN })}</span>
                  <span>{author?.name ?? "匿名"}</span>
                  <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{article.views}</span>
                  <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{article.likes}</span>
                  <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{article.comments}</span>
                  <FavoriteButton targetType="article" targetId={article.id} active={Boolean(article.isFavorited)} />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
