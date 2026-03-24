import { Link } from "react-router";
import { useQA } from "../store/qa-context";

export function FavoritesPage() {
  const { state } = useQA();

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">我的收藏</h1>
        <p className="text-sm text-slate-600">集中查看你收藏的问题和文章。</p>
      </header>
      {state.favorites.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">暂无收藏内容。</div>
      ) : (
        state.favorites.map((favorite) => (
          <Link
            key={favorite.id}
            to={favorite.targetType === "question" ? `/question/${favorite.targetId}` : favorite.targetType === "article" ? `/articles/${favorite.targetId}` : `/tutorials/${favorite.targetId}`}
            className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">{favorite.targetType === "question" ? "问题" : favorite.targetType === "article" ? "文章" : "教程"}</p>
            <h2 className="font-semibold text-slate-900">{favorite.title}</h2>
            <p className="mt-2 text-xs text-slate-500">收藏于 {new Date(favorite.createdAt).toLocaleString()}</p>
          </Link>
        ))
      )}
    </section>
  );
}
