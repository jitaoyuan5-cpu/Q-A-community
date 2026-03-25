import { BookOpen, Gauge, PlayCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { apiRequest } from "../api/client";
import { FavoriteButton } from "../components/content/favorite-button";
import { useI18n } from "../i18n";
import { useQA } from "../store/qa-context";
import { getP3Copy } from "../utils/p3-copy";
import type { Tutorial } from "../types";

type TagItem = { id: number; name: string };

export function TutorialsPage() {
  const { locale } = useI18n();
  const copy = getP3Copy(locale).tutorials;
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
  const difficultyLabel = (value: string) =>
    value === "advanced" ? copy.difficultyAdvanced : value === "intermediate" ? copy.difficultyIntermediate : copy.difficultyBeginner;

  return (
    <section className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <header className="app-panel app-mesh rounded-[2rem] px-6 py-6 lg:px-8">
          <p className="app-kicker">{copy.heroKicker}</p>
          <h1 className="app-display mt-3 text-4xl font-semibold leading-tight text-slate-900 sm:text-[3.2rem]">
            {copy.heroTitle}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
            {copy.heroBody}
          </p>
        </header>

        <aside className="app-panel rounded-[2rem] p-5">
          <p className="app-kicker">{copy.filterKicker}</p>
          <h2 className="app-display mt-2 text-2xl font-semibold text-slate-900">{copy.filterTitle}</h2>
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              {copy.difficultyLabel}
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
                <option value="">{copy.difficultyAll}</option>
                <option value="beginner">{copy.difficultyBeginner}</option>
                <option value="intermediate">{copy.difficultyIntermediate}</option>
                <option value="advanced">{copy.difficultyAdvanced}</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              {copy.tagLabel}
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
                <option value="">{copy.tagAll}</option>
                {tags.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="app-divider my-4" />
          <p className="text-sm leading-7 text-slate-600">{copy.count(items.length)}</p>
        </aside>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {items.map((tutorial) => (
          <article key={tutorial.id} className="app-panel overflow-hidden rounded-[2rem] transition hover:-translate-y-0.5 hover:shadow-[0_24px_48px_rgba(24,33,51,0.12)]">
            <div className="relative">
              <img src={tutorial.cover} alt={tutorial.title} className="h-56 w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#102034] via-[#102034]/65 to-transparent px-5 py-6">
                <span className="app-badge border-white/0 bg-white/10 text-[#f5d8ad]">{difficultyLabel(tutorial.difficulty)}</span>
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
                <span className="inline-flex items-center gap-1"><BookOpen className="h-4 w-4" />{copy.lessons(tutorial.lessonCount || 0)}</span>
                <span className="inline-flex items-center gap-1"><Gauge className="h-4 w-4" />{difficultyLabel(tutorial.difficulty)}</span>
                <span className="inline-flex items-center gap-1"><PlayCircle className="h-4 w-4" />{copy.progress(tutorial.progressPercent || 0)}</span>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link to={`/tutorials/${tutorial.id}`} className="app-button-primary inline-flex rounded-[1rem] px-4 py-2.5 text-sm font-medium text-white">
                  {copy.viewCourse}
                </Link>
                <FavoriteButton targetType="tutorial" targetId={String(tutorial.id)} active={activeFavorites.has(String(tutorial.id)) || Boolean(tutorial.isFavorited)} />
              </div>
            </div>
          </article>
        ))}
      </div>

      {!items.length && <div className="app-panel rounded-[1.8rem] px-6 py-12 text-center text-slate-500">{copy.empty}</div>}
    </section>
  );
}
