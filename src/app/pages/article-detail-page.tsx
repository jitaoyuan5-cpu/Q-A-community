import { Clock, Eye, MessageSquare, Share2, Sparkles, ThumbsUp, PlayCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Link, useParams } from "react-router";
import { useQA } from "../store/qa-context";
import { findUser } from "../store/selectors";
import { MarkdownRenderer } from "../components/content/markdown-renderer";
import { FavoriteButton } from "../components/content/favorite-button";
import { ReportButton } from "../components/content/report-button";
import { extractFirstCodeBlock, guessPlaygroundTemplate } from "../utils/content";

export function ArticleDetailPage() {
  const { id } = useParams();
  const { state } = useQA();

  const article = state.articles.find((item) => item.id === id);

  if (!article) {
    return (
      <div className="app-panel rounded-[1.8rem] px-6 py-12 text-center">
        <h1 className="app-display mb-3 text-3xl font-semibold text-slate-900">文章不存在</h1>
        <Link to="/articles" className="font-medium text-[var(--primary)] hover:underline">返回专栏</Link>
      </div>
    );
  }

  const author = findUser(state, article.authorId);
  const canonicalUrl = `${window.location.origin}/articles/${article.id}`;
  const articleCodeSnippet = extractFirstCodeBlock(article.content || article.excerpt);

  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <article className="app-panel overflow-hidden rounded-[2rem]">
        <div className="relative">
          <img src={article.cover} alt={article.title} className="h-72 w-full object-cover md:h-96" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#102034] via-[#102034]/62 to-transparent px-6 py-7 md:px-8 md:py-8">
            <Link to="/articles" className="text-sm text-slate-200 hover:text-white">返回专栏</Link>
            <p className="app-kicker !mt-4 !text-[#d8c6a3]">Feature article</p>
            <h1 className="app-display mt-3 max-w-4xl text-[2.7rem] font-semibold leading-tight text-white md:text-[3.3rem]">{article.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">{article.excerpt}</p>
          </div>
        </div>
      </article>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <section className="app-panel app-mesh rounded-[2rem] px-6 py-6">
            <p className="app-kicker">Article summary</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-[1.2rem] border border-white/70 bg-white/72 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">作者</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{author?.name ?? "匿名作者"}</p>
              </div>
              <div className="rounded-[1.2rem] border border-white/70 bg-white/72 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">浏览</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{article.views}</p>
              </div>
              <div className="rounded-[1.2rem] border border-white/70 bg-white/72 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">点赞</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{article.likes}</p>
              </div>
              <div className="rounded-[1.2rem] border border-white/70 bg-white/72 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">评论</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{article.comments}</p>
              </div>
            </div>
          </section>

          <section className="app-panel rounded-[2rem] px-6 py-6">
            <div className="markdown-body text-[15px] leading-8 text-slate-700">
              <MarkdownRenderer content={article.content || article.excerpt} />
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="app-panel-dark sticky top-28 rounded-[2rem] p-5">
            <div>
              <p className="app-kicker !text-[#d8c6a3]">Meta rail</p>
              <h2 className="app-display mt-2 text-2xl font-semibold text-[#f8f1e3]">文章信息</h2>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-[#f0c06f]" />{formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true, locale: zhCN })}</div>
              <div className="flex items-center gap-2"><Eye className="h-4 w-4 text-[#f0c06f]" />{article.views} 浏览</div>
              <div className="flex items-center gap-2"><ThumbsUp className="h-4 w-4 text-[#f0c06f]" />{article.likes} 点赞</div>
              <div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-[#f0c06f]" />{article.comments} 评论</div>
            </div>
            <div className="app-divider my-4" />
            <div className="flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <Link key={tag} to={`/articles?tag=${encodeURIComponent(tag)}`} className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-xs text-slate-100 hover:bg-white/14">
                  {tag}
                </Link>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <FavoriteButton targetType="article" targetId={article.id} active={Boolean(article.isFavorited)} />
              <Link to={`/assistant?q=${encodeURIComponent(`${article.title}\n${article.excerpt}`)}`} className="inline-flex items-center rounded-full border border-white/12 bg-white/10 px-3 py-2 text-xs text-slate-100 hover:bg-white/14">
                <Sparkles className="mr-1 h-3.5 w-3.5 text-[#f0c06f]" />AI 助手
              </Link>
              {articleCodeSnippet ? (
                <Link
                  to={`/playground?template=${guessPlaygroundTemplate(articleCodeSnippet)}&title=${encodeURIComponent(article.title)}&code=${encodeURIComponent(articleCodeSnippet)}`}
                  className="inline-flex items-center rounded-full border border-white/12 bg-white/10 px-3 py-2 text-xs text-slate-100 hover:bg-white/14"
                >
                  <PlayCircle className="mr-1 h-3.5 w-3.5" />Playground
                </Link>
              ) : null}
              <button
                type="button"
                onClick={async () => {
                  if (navigator.share) {
                    await navigator.share({ title: article.title, url: canonicalUrl }).catch(() => undefined);
                    return;
                  }
                  await navigator.clipboard.writeText(canonicalUrl);
                }}
                className="inline-flex items-center rounded-full border border-white/12 bg-white/10 px-3 py-2 text-xs text-slate-100 hover:bg-white/14"
              >
                <Share2 className="mr-1 h-3.5 w-3.5" />分享
              </button>
              <ReportButton targetType="article" targetId={article.id} />
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
