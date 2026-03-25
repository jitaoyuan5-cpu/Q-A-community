import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useI18n } from "../i18n";
import { getP3Copy } from "../utils/p3-copy";

type AdminTutorialSummary = {
  id: number;
  title: string;
  summary: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  isPublished: boolean;
  lessonCount: number;
  updatedAt: string;
};

type LessonDraft = {
  title: string;
  description: string;
  sortOrder: number;
  videoUrl: string;
  durationSeconds: number;
  starterTemplate: "html" | "typescript" | "react" | "";
  starterFilesText: string;
};

type TutorialDraft = {
  id?: number;
  title: string;
  summary: string;
  description: string;
  cover: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  isPublished: boolean;
  tagsText: string;
  lessons: LessonDraft[];
};

type TutorialPayload = {
  title: string;
  summary: string;
  description: string;
  cover: string;
  difficulty: TutorialDraft["difficulty"];
  isPublished: boolean;
  tags: string[];
  lessons: Array<{
    title: string;
    description: string;
    sortOrder: number;
    videoUrl: string;
    durationSeconds: number;
    starterTemplate: "html" | "typescript" | "react" | null;
    starterFiles: Record<string, string> | null;
  }>;
};

function FieldHeader({
  title,
  required,
  hint,
  htmlFor,
  requiredLabel,
  optionalLabel,
}: {
  title: string;
  required?: boolean;
  hint: string;
  htmlFor?: string;
  requiredLabel: string;
  optionalLabel: string;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-2">
        <label htmlFor={htmlFor} className="block text-sm font-medium">{title}</label>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${required ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{required ? requiredLabel : optionalLabel}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

const isValidUrl = (value: string) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const toFriendlyTutorialError = (error: unknown, copy: ReturnType<typeof getP3Copy>["adminTutorials"]) => {
  const message = (error as Error)?.message || copy.saveFailed;
  if (message === "Failed to fetch") return copy.submitFailed;
  return message;
};

const buildTutorialPayload = (draft: TutorialDraft, copy: ReturnType<typeof getP3Copy>["adminTutorials"]): TutorialPayload => {
  const title = draft.title.trim();
  const summary = draft.summary.trim();
  const description = draft.description.trim();
  const cover = draft.cover.trim();
  const tags = draft.tagsText.split(",").map((item) => item.trim()).filter(Boolean);

  if (title.length < 2) throw new Error(copy.titleMin);
  if (summary.length < 10) throw new Error(copy.summaryMin);
  if (description.length < 10) throw new Error(copy.descriptionMin);
  if (cover && !isValidUrl(cover)) throw new Error(copy.coverUrlInvalid);
  if (tags.length > 6) throw new Error(copy.tagsMax);
  if (!draft.lessons.length) throw new Error(copy.lessonsMin);

  return {
    title,
    summary,
    description,
    cover,
    difficulty: draft.difficulty,
    isPublished: draft.isPublished,
    tags,
    lessons: draft.lessons.map((lesson, index) => {
      const lessonTitle = lesson.title.trim();
      const lessonDescription = lesson.description.trim();
      const lessonVideoUrl = lesson.videoUrl.trim();
      const durationSeconds = Number(lesson.durationSeconds);

      if (lessonTitle.length < 2) throw new Error(copy.lessonTitleMin(index + 1));
      if (lessonDescription.length < 2) throw new Error(copy.lessonDescriptionMin(index + 1));
      if (!isValidUrl(lessonVideoUrl)) throw new Error(copy.lessonVideoUrlInvalid(index + 1));
      if (!Number.isFinite(durationSeconds) || durationSeconds < 0) throw new Error(copy.lessonDurationInvalid(index + 1));

      let starterFiles: Record<string, string> | null = null;
      if (lesson.starterFilesText.trim()) {
        try {
          const parsed = JSON.parse(lesson.starterFilesText) as Record<string, string>;
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("not-object");
          }
          starterFiles = parsed;
        } catch {
          throw new Error(copy.starterFilesInvalid(index + 1));
        }
      }

      return {
        title: lessonTitle,
        description: lessonDescription,
        sortOrder: lesson.sortOrder || index + 1,
        videoUrl: lessonVideoUrl,
        durationSeconds,
        starterTemplate: lesson.starterTemplate || null,
        starterFiles,
      };
    }),
  };
};

const emptyLesson = (copy: ReturnType<typeof getP3Copy>["adminTutorials"]): LessonDraft => ({
  title: copy.newLessonTitle,
  description: copy.newLessonDescription,
  sortOrder: 0,
  videoUrl: "https://www.youtube.com/watch?v=O6P86uwfdR0",
  durationSeconds: 600,
  starterTemplate: "",
  starterFilesText: "",
});

const emptyDraft = (copy: ReturnType<typeof getP3Copy>["adminTutorials"]): TutorialDraft => ({
  title: "",
  summary: "",
  description: "",
  cover: "",
  difficulty: "beginner",
  isPublished: true,
  tagsText: "",
  lessons: [emptyLesson(copy)],
});

export function AdminTutorialsPage() {
  const { locale } = useI18n();
  const copy = getP3Copy(locale).adminTutorials;
  const [items, setItems] = useState<AdminTutorialSummary[]>([]);
  const [draft, setDraft] = useState<TutorialDraft>(emptyDraft(copy));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const difficultyLabel = (value: TutorialDraft["difficulty"]) =>
    value === "advanced" ? copy.difficultyAdvanced : value === "intermediate" ? copy.difficultyIntermediate : copy.difficultyBeginner;

  const refresh = async () => {
    const rows = await apiRequest<AdminTutorialSummary[]>("/admin/tutorials");
    setItems(rows);
  };

  useEffect(() => {
    refresh().catch((err) => setError((err as Error).message));
  }, []);

  useEffect(() => {
    setDraft((prev) => {
      if (prev.id || prev.title || prev.summary || prev.description || prev.cover || prev.tagsText) return prev;
      return emptyDraft(copy);
    });
  }, [copy]);

  const loadTutorial = async (id: number) => {
    const detail = await apiRequest<any>(`/admin/tutorials/${id}`);
    setDraft({
      id: detail.id,
      title: detail.title,
      summary: detail.summary,
      description: detail.description,
      cover: detail.cover,
      difficulty: detail.difficulty,
      isPublished: detail.isPublished,
      tagsText: (detail.tags || []).join(", "),
      lessons: (detail.lessons || []).map((lesson: any) => ({
        title: lesson.title,
        description: lesson.description,
        sortOrder: lesson.sortOrder,
        videoUrl: lesson.videoUrl,
        durationSeconds: lesson.durationSeconds,
        starterTemplate: lesson.starterTemplate || "",
        starterFilesText: lesson.starterFiles ? JSON.stringify(lesson.starterFiles, null, 2) : "",
      })),
    });
  };

  return (
    <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{copy.pageTitle}</h1>
            <p className="text-sm text-slate-500">{copy.pageSubtitle}</p>
          </div>
          <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs" onClick={() => setDraft(emptyDraft(copy))}>
            {copy.new}
          </button>
        </div>
        <div className="space-y-2">
          {items.map((item) => (
            <button key={item.id} type="button" className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left" onClick={() => loadTutorial(item.id).catch((err) => setError((err as Error).message))}>
              <p className="font-medium text-slate-900">{item.title}</p>
              <p className="mt-1 text-xs text-slate-500">{copy.lessonsSummary(item.lessonCount, difficultyLabel(item.difficulty))}</p>
            </button>
          ))}
        </div>
      </aside>

      <form
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setSuccess("");
          try {
            const body = buildTutorialPayload(draft, copy);
            if (draft.id) {
              await apiRequest(`/admin/tutorials/${draft.id}`, { method: "PUT", body: JSON.stringify(body) });
            } else {
              await apiRequest("/admin/tutorials", { method: "POST", body: JSON.stringify(body) });
            }
            setSuccess(copy.saved);
            await refresh();
          } catch (err) {
            setError(toFriendlyTutorialError(err, copy));
          }
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <FieldHeader title={copy.fieldTitle} required hint={copy.fieldTitleHint} htmlFor="tutorial-title" requiredLabel={copy.required} optionalLabel={copy.optional} />
            <input id="tutorial-title" value={draft.title} onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 px-3" />
          </div>
          <div>
            <FieldHeader title={copy.fieldCover} hint={copy.fieldCoverHint} htmlFor="tutorial-cover" requiredLabel={copy.required} optionalLabel={copy.optional} />
            <input id="tutorial-cover" value={draft.cover} onChange={(event) => setDraft((prev) => ({ ...prev, cover: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 px-3" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <FieldHeader title={copy.fieldDifficulty} required hint={copy.fieldDifficultyHint} htmlFor="tutorial-difficulty" requiredLabel={copy.required} optionalLabel={copy.optional} />
            <select id="tutorial-difficulty" value={draft.difficulty} onChange={(event) => setDraft((prev) => ({ ...prev, difficulty: event.target.value as TutorialDraft["difficulty"] }))} className="h-10 w-full rounded-lg border border-slate-200 px-3">
              <option value="beginner">{copy.difficultyBeginner}</option>
              <option value="intermediate">{copy.difficultyIntermediate}</option>
              <option value="advanced">{copy.difficultyAdvanced}</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <FieldHeader title={copy.fieldTags} hint={copy.fieldTagsHint} htmlFor="tutorial-tags" requiredLabel={copy.required} optionalLabel={copy.optional} />
            <input id="tutorial-tags" value={draft.tagsText} onChange={(event) => setDraft((prev) => ({ ...prev, tagsText: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 px-3" />
          </div>
        </div>
        <div>
          <FieldHeader title={copy.fieldSummary} required hint={copy.fieldSummaryHint} htmlFor="tutorial-summary" requiredLabel={copy.required} optionalLabel={copy.optional} />
          <textarea id="tutorial-summary" value={draft.summary} onChange={(event) => setDraft((prev) => ({ ...prev, summary: event.target.value }))} className="min-h-24 w-full rounded-lg border border-slate-200 p-3" />
        </div>
        <div>
          <FieldHeader title={copy.fieldDescription} required hint={copy.fieldDescriptionHint} htmlFor="tutorial-description" requiredLabel={copy.required} optionalLabel={copy.optional} />
          <textarea id="tutorial-description" value={draft.description} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} className="min-h-32 w-full rounded-lg border border-slate-200 p-3" />
        </div>
        <div>
          <FieldHeader title={copy.fieldPublished} hint={copy.fieldPublishedHint} requiredLabel={copy.required} optionalLabel={copy.optional} />
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={draft.isPublished} onChange={(event) => setDraft((prev) => ({ ...prev, isPublished: event.target.checked }))} />
            {copy.publishCourse}
          </label>
        </div>
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{copy.lessonsTitle}</h2>
              <p className="text-xs text-slate-500">{copy.lessonsHint}</p>
            </div>
            <button type="button" className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs" onClick={() => setDraft((prev) => ({ ...prev, lessons: [...prev.lessons, { ...emptyLesson(copy), sortOrder: prev.lessons.length + 1 }] }))}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              {copy.addLesson}
            </button>
          </div>
          {draft.lessons.map((lesson, index) => (
            <div key={`${lesson.title}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium text-slate-900">{copy.lessonCardTitle(index + 1)}</h3>
                <button type="button" className="inline-flex items-center rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600" onClick={() => setDraft((prev) => ({ ...prev, lessons: prev.lessons.filter((_, lessonIndex) => lessonIndex !== index) }))}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  {copy.deleteLesson}
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <FieldHeader title={copy.lessonTitle} required hint={copy.lessonTitleHint} requiredLabel={copy.required} optionalLabel={copy.optional} />
                  <input value={lesson.title} onChange={(event) => setDraft((prev) => ({ ...prev, lessons: prev.lessons.map((item, lessonIndex) => lessonIndex === index ? { ...item, title: event.target.value } : item) }))} className="h-10 w-full rounded-lg border border-slate-200 px-3" placeholder={copy.lessonTitlePlaceholder} />
                </div>
                <div>
                  <FieldHeader title={copy.lessonVideo} required hint={copy.lessonVideoHint} requiredLabel={copy.required} optionalLabel={copy.optional} />
                  <input value={lesson.videoUrl} onChange={(event) => setDraft((prev) => ({ ...prev, lessons: prev.lessons.map((item, lessonIndex) => lessonIndex === index ? { ...item, videoUrl: event.target.value } : item) }))} className="h-10 w-full rounded-lg border border-slate-200 px-3" placeholder={copy.lessonVideoPlaceholder} />
                </div>
              </div>
              <div className="mt-3">
                <FieldHeader title={copy.lessonDescription} required hint={copy.lessonDescriptionHint} requiredLabel={copy.required} optionalLabel={copy.optional} />
                <textarea value={lesson.description} onChange={(event) => setDraft((prev) => ({ ...prev, lessons: prev.lessons.map((item, lessonIndex) => lessonIndex === index ? { ...item, description: event.target.value } : item) }))} className="min-h-20 w-full rounded-lg border border-slate-200 p-3" placeholder={copy.lessonDescriptionPlaceholder} />
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div>
                  <FieldHeader title={copy.lessonSort} hint={copy.lessonSortHint} requiredLabel={copy.required} optionalLabel={copy.optional} />
                  <input type="number" value={lesson.sortOrder} onChange={(event) => setDraft((prev) => ({ ...prev, lessons: prev.lessons.map((item, lessonIndex) => lessonIndex === index ? { ...item, sortOrder: Number(event.target.value) } : item) }))} className="h-10 w-full rounded-lg border border-slate-200 px-3" placeholder={copy.lessonSortPlaceholder} />
                </div>
                <div>
                  <FieldHeader title={copy.lessonDuration} hint={copy.lessonDurationHint} requiredLabel={copy.required} optionalLabel={copy.optional} />
                  <input type="number" value={lesson.durationSeconds} onChange={(event) => setDraft((prev) => ({ ...prev, lessons: prev.lessons.map((item, lessonIndex) => lessonIndex === index ? { ...item, durationSeconds: Number(event.target.value) } : item) }))} className="h-10 w-full rounded-lg border border-slate-200 px-3" placeholder={copy.lessonDurationPlaceholder} />
                </div>
                <div>
                  <FieldHeader title={copy.starterTemplate} hint={copy.starterTemplateHint} requiredLabel={copy.required} optionalLabel={copy.optional} />
                  <select value={lesson.starterTemplate} onChange={(event) => setDraft((prev) => ({ ...prev, lessons: prev.lessons.map((item, lessonIndex) => lessonIndex === index ? { ...item, starterTemplate: event.target.value as LessonDraft["starterTemplate"] } : item) }))} className="h-10 w-full rounded-lg border border-slate-200 px-3">
                    <option value="">{copy.starterTemplateNone}</option>
                    <option value="html">{copy.starterTemplateHtml}</option>
                    <option value="typescript">{copy.starterTemplateTypescript}</option>
                    <option value="react">{copy.starterTemplateReact}</option>
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <FieldHeader title={copy.starterFiles} hint={copy.starterFilesHint} requiredLabel={copy.required} optionalLabel={copy.optional} />
                <textarea value={lesson.starterFilesText} onChange={(event) => setDraft((prev) => ({ ...prev, lessons: prev.lessons.map((item, lessonIndex) => lessonIndex === index ? { ...item, starterFilesText: event.target.value } : item) }))} className="min-h-28 w-full rounded-lg border border-slate-200 p-3 font-mono text-xs" placeholder={copy.starterFilesPlaceholder} />
              </div>
            </div>
          ))}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {success ? <p className="text-sm text-green-600">{success}</p> : null}
        <div className="flex justify-end gap-2">
          {draft.id ? (
            <button
              type="button"
              className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600"
              onClick={async () => {
                if (!draft.id) return;
                try {
                  await apiRequest(`/admin/tutorials/${draft.id}`, { method: "DELETE" });
                  setDraft(emptyDraft(copy));
                  await refresh();
                } catch (err) {
                  setError(toFriendlyTutorialError(err, copy));
                }
              }}
            >
              {copy.deleteTutorial}
            </button>
          ) : null}
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">{copy.saveTutorial}</button>
        </div>
      </form>
    </section>
  );
}
