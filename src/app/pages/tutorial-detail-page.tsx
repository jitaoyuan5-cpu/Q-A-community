import { BookOpen, PlayCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { apiRequest } from "../api/client";
import { FavoriteButton } from "../components/content/favorite-button";
import { MarkdownRenderer } from "../components/content/markdown-renderer";
import { useAuth } from "../auth-context";
import { useQA } from "../store/qa-context";
import type { Tutorial } from "../types";

export function TutorialDetailPage() {
  const { id } = useParams();
  const tutorialId = Number(id);
  const { user } = useAuth();
  const { state } = useQA();
  const [tutorial, setTutorial] = useState<Tutorial | null>(null);
  const [currentLessonId, setCurrentLessonId] = useState<number | null>(null);

  const refresh = async () => {
    if (!tutorialId) return;
    const detail = await apiRequest<Tutorial>(`/tutorials/${tutorialId}`);
    setTutorial(detail);
    setCurrentLessonId(detail.lastLessonId || detail.lessons?.[0]?.id || null);
  };

  useEffect(() => {
    refresh().catch(() => setTutorial(null));
  }, [tutorialId]);

  const activeFavorite = useMemo(
    () =>
      Boolean(
        tutorial &&
          (tutorial.isFavorited ||
            state.favorites.some((item) => item.targetType === "tutorial" && String(item.targetId) === String(tutorial.id))),
      ),
    [state.favorites, tutorial],
  );
  const currentLesson = tutorial?.lessons?.find((lesson) => lesson.id === currentLessonId) || tutorial?.lessons?.[0] || null;

  const markProgress = async (lessonId: number, progressPercent: number) => {
    if (!tutorialId || !user) return;
    await apiRequest(`/tutorials/${tutorialId}/progress`, {
      method: "PUT",
      body: JSON.stringify({ lessonId, progressPercent }),
    }).catch(() => undefined);
  };

  if (!tutorial) {
    return (
      <div className="app-panel rounded-[1.8rem] px-6 py-12 text-center">
        <h1 className="app-display mb-3 text-3xl font-semibold text-slate-900">教程不存在</h1>
        <Link to="/tutorials" className="font-medium text-[var(--primary)] hover:underline">返回教程列表</Link>
      </div>
    );
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <article className="app-panel overflow-hidden rounded-[2rem]">
          <div className="relative">
            <img src={tutorial.cover} alt={tutorial.title} className="h-72 w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#102034] via-[#102034]/60 to-transparent px-6 py-7">
              <Link to="/tutorials" className="text-sm text-slate-200 hover:text-white">返回教程列表</Link>
              <h1 className="app-display mt-3 text-[2.6rem] font-semibold leading-tight text-white">{tutorial.title}</h1>
              <p className="mt-2 text-sm text-slate-200">{tutorial.author.name} · {tutorial.difficulty}</p>
            </div>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-3xl">
                <p className="text-base leading-8 text-slate-600">{tutorial.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {tutorial.tags.map((tag) => (
                    <span key={tag} className="app-badge">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <FavoriteButton targetType="tutorial" targetId={String(tutorial.id)} active={activeFavorite} />
            </div>
            <div className="mt-6 rounded-[1.5rem] border border-white/70 bg-white/70 p-5">
              <MarkdownRenderer content={tutorial.description} />
            </div>
          </div>
        </article>

        {currentLesson ? (
          <article className="app-panel rounded-[2rem] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="app-kicker">Current lesson</p>
                <h2 className="app-display mt-2 text-3xl font-semibold text-slate-900">{currentLesson.title}</h2>
              </div>
              <button
                type="button"
                className="app-button-ghost rounded-[1rem] px-3 py-2 text-sm"
                onClick={() => {
                  if (!currentLesson?.starterFiles) return;
                  window.location.href = `/playground?template=${currentLesson.starterTemplate || "react"}&title=${encodeURIComponent(`${tutorial.title} - ${currentLesson.title}`)}&files=${encodeURIComponent(JSON.stringify(currentLesson.starterFiles))}`;
                }}
              >
                在 Playground 打开
              </button>
            </div>
            <p className="mb-4 text-sm leading-7 text-slate-600">{currentLesson.description}</p>
            <div className="overflow-hidden rounded-[1.5rem] border border-slate-200">
              <iframe title={currentLesson.title} src={currentLesson.embedUrl} className="h-[420px] w-full bg-slate-100" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" />
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="app-button-primary rounded-[1rem] px-4 py-2.5 text-sm font-medium text-white"
                onClick={async () => {
                  const lessons = tutorial.lessons || [];
                  const index = lessons.findIndex((lesson) => lesson.id === currentLesson.id);
                  const progress = Math.max(1, Math.round(((index + 1) / lessons.length) * 100));
                  await markProgress(currentLesson.id, progress);
                  await refresh();
                }}
              >
                记录进度
              </button>
            </div>
          </article>
        ) : null}
      </div>

      <aside className="space-y-4">
        <div className="app-panel-dark sticky top-28 rounded-[2rem] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="app-kicker !text-[#d8c6a3]">Lesson rail</p>
              <h3 className="app-display mt-2 text-2xl font-semibold text-[#f8f1e3]">课程章节</h3>
            </div>
            <span className="text-xs text-slate-300">进度 {tutorial.progressPercent || 0}%</span>
          </div>
          <div className="space-y-2">
            {(tutorial.lessons || []).map((lesson) => (
              <button
                key={lesson.id}
                type="button"
                className={`block w-full rounded-[1.2rem] border px-3 py-3 text-left ${
                  currentLesson?.id === lesson.id ? "border-[#e1c18c] bg-white/12" : "border-white/10 bg-black/10"
                }`}
                onClick={async () => {
                  setCurrentLessonId(lesson.id);
                  const lessons = tutorial.lessons || [];
                  const index = lessons.findIndex((item) => item.id === lesson.id);
                  const progress = Math.max(1, Math.round(((index + 1) / lessons.length) * 100));
                  await markProgress(lesson.id, progress);
                }}
              >
                <p className="font-medium text-[#f8f1e3]">{lesson.title}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1"><PlayCircle className="h-3.5 w-3.5" />{lesson.videoProvider}</span>
                  <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{Math.ceil(lesson.durationSeconds / 60)} min</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
}
