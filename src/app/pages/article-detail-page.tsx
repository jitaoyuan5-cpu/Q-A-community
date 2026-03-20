import { Clock, Eye, MessageSquare, Share2, ThumbsUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Link, useParams } from "react-router";
import { useQA } from "../store/qa-context";
import { findUser } from "../store/selectors";
import { MarkdownRenderer } from "../components/content/markdown-renderer";
import { FavoriteButton } from "../components/content/favorite-button";
import { ReportButton } from "../components/content/report-button";

export function ArticleDetailPage() {
  const { id } = useParams();
  const { state } = useQA();

  const article = state.articles.find((item) => item.id === id);

  if (!article) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <h1 className="mb-3 text-2xl font-semibold">文章不存在</h1>
        <Link to="/articles" className="text-blue-600 hover:underline">返回专栏</Link>
      </div>
    );
  }

  const author = findUser(state, article.authorId);
  const canonicalUrl = `${window.location.origin}/articles/${article.id}`;

  return (
    <article className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <img src={article.cover} alt={article.title} className="h-64 w-full object-cover md:h-80" />
      <div className="p-6 md:p-8">
        <Link to="/articles" className="text-sm text-slate-600 hover:text-slate-900">返回专栏</Link>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">{article.title}</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">{article.excerpt}</p>

        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <span>{author?.name ?? "匿名作者"}</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />{formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true, locale: zhCN })}</span>
          <span className="inline-flex items-center gap-1"><Eye className="h-4 w-4" />{article.views}</span>
          <span className="inline-flex items-center gap-1"><ThumbsUp className="h-4 w-4" />{article.likes}</span>
          <span className="inline-flex items-center gap-1"><MessageSquare className="h-4 w-4" />{article.comments}</span>
          <FavoriteButton targetType="article" targetId={article.id} active={Boolean(article.isFavorited)} />
          <button
            type="button"
            onClick={async () => {
              if (navigator.share) {
                await navigator.share({ title: article.title, url: canonicalUrl }).catch(() => undefined);
                return;
              }
              await navigator.clipboard.writeText(canonicalUrl);
            }}
            className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600"
          >
            <Share2 className="mr-1 h-3.5 w-3.5" />
            分享
          </button>
          <ReportButton targetType="article" targetId={article.id} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <Link key={tag} to={`/articles?tag=${encodeURIComponent(tag)}`} className="rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-700">
              {tag}
            </Link>
          ))}
        </div>

        <div className="mt-8 text-[15px] leading-8 text-slate-700">
          <MarkdownRenderer content={article.content || article.excerpt} />
        </div>
      </div>
    </article>
  );
}
