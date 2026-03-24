import { BookOpen, Gauge, PlayCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { apiRequest } from "../api/client";
import { FavoriteButton } from "../components/content/favorite-button";
import { useQA } from "../store/qa-context";
import type { Tutorial } from "../types";

type TagItem = { id: number; name: string };

export function TutorialsPage() {
  const [params, setParams] = useSearchParams();
  const { state } = useQA();
  const [items, setItems] = useState<Tutorial[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const tag = params.get("tag") || "";
  const difficulty = params.get("difficulty") || "";

  useEffect(() => {
    const query = new URLSearchParams();
    if (tag) query.set("tag", tag);
    if (difficulty) query.set("difficulty", difficulty);
    apiRequest<Tutorial[]>(`/tutorials${query.toString() ? `?${query.toString()}` : ""}`).then(setItems).catch(() => setItems([]));
  }, [tag, difficulty]);

  useEffect(() => {
    apiRequest<TagItem[]>("/meta/tags").then(setTags).catch(() => setTags([]));
  }, []);

  const activeFavorites = useMemo(
    () => new Set(state.favorites.filter((item) => item.targetType === "tutorial").map((item) => String(item.targetId))),
    [state.favorites],
  );

  return (
    <section className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <header className="app-panel app-mesh rounded-[2rem] px-6 py-6 lg:px-8">
          <p className="app-kicker">Tutorial library</p>
          <h1 className="app-display mt-3 text-4xl font-semibold leading-tight text-slate-900 sm:text-[3.2rem]">
            用课程页、章节线索和可嵌入视频，把技术内容排成一张更完整的学习地图。
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
            课程不只是视频入口，还保留结构、标签、难度、进度和直接进入 Playground 的练习通道。
          </p>
        </header>

        <aside className="app-panel rounded-[2rem] p-5">
          <p className="app-kicker">Refine</p>
          <h2 className="app-display mt-2 text-2xl font-semibold text-slate-900">筛选视角</h2>
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              难度等级
              <select
                className="app-input mt-2 h-11 rounded-[1rem] px-3 text-sm"
                value={difficulty}
                onChange={(event) => {
                  const next = new URLSearchParams(params);
                  if (event.target.value) next.set("difficulty", event.target.value);
                  else next.delete("difficulty");
                  setParams(next, { replace: true });
                }}
              >
                <option value="">全部难度</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              主题标签
              <select
                className="app-input mt-2 h-11 rounded-[1rem] px-3 text-sm"
                value={tag}
                onChange={(event) => {
                  const next = new URLSearchParams(params);
                  if (event.target.value) next.set("tag", event.target.value);
                  else next.delete("tag");
                  setParams(next, { replace: true });
                }}
              >
                <option value="">全部标签</option>
                {tags.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="app-divider my-4" />
          <p className="text-sm leading-7 text-slate-600">当前共展示 {items.length} 门课程。筛选会同步到 URL，方便直接分享某个学习视图。</p>
        </aside>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {items.map((tutorial) => (
          <article key={tutorial.id} className="app-panel overflow-hidden rounded-[2rem] transition hover:-translate-y-0.5 hover:shadow-[0_24px_48px_rgba(24,33,51,0.12)]">
            <div className="relative">
              <img src={tutorial.cover} alt={tutorial.title} className="h-56 w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#102034] via-[#102034]/65 to-transparent px-5 py-6">
                <span className="app-badge border-white/0 bg-white/10 text-[#f5d8ad]">{tutorial.difficulty}</span>
                <h2 className="app-display mt-3 text-[2rem] font-semibold text-white">{tutorial.title}</h2>
                <p className="mt-1 text-sm text-slate-200">{tutorial.author.name}</p>
              </div>
            </div>
            <div className="p-5">
              <p className="line-clamp-3 text-sm leading-7 text-slate-600">{tutorial.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {tutorial.tags.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      const next = new URLSearchParams(params);
                      next.set("tag", item);
                      setParams(next, { replace: true });
                    }}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1"><BookOpen className="h-4 w-4" />{tutorial.lessonCount || 0} 节</span>
                <span className="inline-flex items-center gap-1"><Gauge className="h-4 w-4" />{tutorial.difficulty}</span>
                <span className="inline-flex items-center gap-1"><PlayCircle className="h-4 w-4" />进度 {tutorial.progressPercent || 0}%</span>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link to={`/tutorials/${tutorial.id}`} className="app-button-primary inline-flex rounded-[1rem] px-4 py-2.5 text-sm font-medium text-white">
                  查看课程
                </Link>
                <FavoriteButton targetType="tutorial" targetId={String(tutorial.id)} active={activeFavorites.has(String(tutorial.id)) || Boolean(tutorial.isFavorited)} />
              </div>
            </div>
          </article>
        ))}
      </div>

      {!items.length && <div className="app-panel rounded-[1.8rem] px-6 py-12 text-center text-slate-500">当前筛选下没有教程。</div>}
    </section>
  );
}
