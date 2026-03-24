import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";

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

function FieldHeader({ title, required, hint, htmlFor }: { title: string; required?: boolean; hint: string; htmlFor?: string }) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-2">
        <label htmlFor={htmlFor} className="block text-sm font-medium">{title}</label>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${required ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{required ? "必填" : "选填"}</span>
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

const toFriendlyTutorialError = (error: unknown) => {
  const message = (error as Error)?.message || "教程保存失败";
  if (message === "Failed to fetch") return "提交失败，请确认后端服务已启动并可访问";
  return message;
};

const buildTutorialPayload = (draft: TutorialDraft): TutorialPayload => {
  const title = draft.title.trim();
  const summary = draft.summary.trim();
  const description = draft.description.trim();
  const cover = draft.cover.trim();
  const tags = draft.tagsText.split(",").map((item) => item.trim()).filter(Boolean);

  if (title.length < 2) throw new Error("请填写教程标题，至少 2 个字");
  if (summary.length < 10) throw new Error("请填写教程摘要，至少 10 个字");
  if (description.length < 10) throw new Error("请填写课程介绍，至少 10 个字");
  if (cover && !isValidUrl(cover)) throw new Error("封面地址必须是合法 URL，或留空");
  if (tags.length > 6) throw new Error("课程标签最多填写 6 个");
  if (!draft.lessons.length) throw new Error("至少添加 1 个课时");

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

      if (lessonTitle.length < 2) throw new Error(`请填写第 ${index + 1} 个课时的标题，至少 2 个字`);
      if (lessonDescription.length < 2) throw new Error(`请填写第 ${index + 1} 个课时的说明，至少 2 个字`);
      if (!isValidUrl(lessonVideoUrl)) throw new Error(`第 ${index + 1} 个课时的视频地址必须是合法 URL`);
      if (!Number.isFinite(durationSeconds) || durationSeconds < 0) throw new Error(`第 ${index + 1} 个课时的时长不能小于 0`);

      let starterFiles: Record<string, string> | null = null;
      if (lesson.starterFilesText.trim()) {
        try {
          const parsed = JSON.parse(lesson.starterFilesText) as Record<string, string>;
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("not-object");
          }
          starterFiles = parsed;
        } catch {
          throw new Error(`第 ${index + 1} 个课时的 Starter files 必须是合法 JSON 对象`);
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

const emptyLesson = (): LessonDraft => ({
  title: "新课时",
  description: "补充本节课的学习重点。",
  sortOrder: 0,
  videoUrl: "https://www.youtube.com/watch?v=O6P86uwfdR0",
  durationSeconds: 600,
  starterTemplate: "",
  starterFilesText: "",
});

const emptyDraft = (): TutorialDraft => ({
  title: "",
  summary: "",
  description: "",
  cover: "",
  difficulty: "beginner",
  isPublished: true,
  tagsText: "",
  lessons: [emptyLesson()],
});

export function AdminTutorialsPage() {
  const [items, setItems] = useState<AdminTutorialSummary[]>([]);
  const [draft, setDraft] = useState<TutorialDraft>(emptyDraft());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refresh = async () => {
    const rows = await apiRequest<AdminTutorialSummary[]>("/admin/tutorials");
    setItems(rows);
  };

  useEffect(() => {
    refresh().catch((err) => setError((err as Error).message));
  }, []);

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
            <h1 className="text-xl font-semibold">教程管理</h1>
            <p className="text-sm text-slate-500">课程 CRUD 与章节配置</p>
          </div>
          <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs" onClick={() => setDraft(emptyDraft())}>
            新建
          </button>
        </div>
        <div className="space-y-2">
          {items.map((item) => (
            <button key={item.id} type="button" className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left" onClick={() => loadTutorial(item.id).catch((err) => setError((err as Error).message))}>
              <p className="font-medium text-slate-900">{item.title}</p>
              <p className="mt-1 text-xs text-slate-500">{item.lessonCount} 节 · {item.difficulty}</p>
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
            const body = buildTutorialPayload(draft);
            if (draft.id) {
              await apiRequest(`/admin/tutorials/${draft.id}`, { method: "PUT", body: JSON.stringify(body) });
            } else {
              await apiRequest("/admin/tutorials", { method: "POST", body: JSON.stringify(body) });
            }
            setSuccess("教程已保存");
            await refresh();
          } catch (err) {
            setError(toFriendlyTutorialError(err));
          }
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <FieldHeader title="标题" required hint="课程在前台列表和详情页显示的主标题。" htmlFor="tutorial-title" />
            <input id="tutorial-title" value={draft.title} onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 px-3" />
          </div>
          <div>
            <FieldHeader title="封面" hint="课程封面图片 URL。可以留空，留空时前台使用默认占位样式。" htmlFor="tutorial-cover" />
            <input id="tutorial-cover" value={draft.cover} onChange={(event) => setDraft((prev) => ({ ...prev, cover: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 px-3" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <FieldHeader title="难度" required hint="用于告诉用户课程适合的学习阶段。" htmlFor="tutorial-difficulty" />
            <select id="tutorial-difficulty" value={draft.difficulty} onChange={(event) => setDraft((prev) => ({ ...prev, difficulty: event.target.value as TutorialDraft["difficulty"] }))} className="h-10 w-full rounded-lg border border-slate-200 px-3">
              <option value="beginner">beginner</option>
              <option value="intermediate">intermediate</option>
              <option value="advanced">advanced</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <FieldHeader title="标签（逗号分隔）" hint="帮助用户筛选课程。多个标签请用英文逗号分隔，最多 6 个。" htmlFor="tutorial-tags" />
            <input id="tutorial-tags" value={draft.tagsText} onChange={(event) => setDraft((prev) => ({ ...prev, tagsText: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 px-3" />
          </div>
        </div>
        <div>
          <FieldHeader title="摘要" required hint="课程卡片上的简短介绍，建议写清学习收益和适合对象。" htmlFor="tutorial-summary" />
          <textarea id="tutorial-summary" value={draft.summary} onChange={(event) => setDraft((prev) => ({ ...prev, summary: event.target.value }))} className="min-h-24 w-full rounded-lg border border-slate-200 p-3" />
        </div>
        <div>
          <FieldHeader title="课程介绍（Markdown）" required hint="课程详情页的长说明，可以写课程目标、适用人群和章节安排。" htmlFor="tutorial-description" />
          <textarea id="tutorial-description" value={draft.description} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} className="min-h-32 w-full rounded-lg border border-slate-200 p-3" />
        </div>
        <div>
          <FieldHeader title="发布状态" hint="勾选后前台用户可看到这门课程；取消勾选时只在后台保留。" />
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={draft.isPublished} onChange={(event) => setDraft((prev) => ({ ...prev, isPublished: event.target.checked }))} />
            发布课程
          </label>
        </div>
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">课时</h2>
              <p className="text-xs text-slate-500">每个课时至少要有标题、说明、视频地址。Starter 模板和 Starter files 仅在需要带入 Playground 时填写。</p>
            </div>
            <button type="button" className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs" onClick={() => setDraft((prev) => ({ ...prev, lessons: [...prev.lessons, { ...emptyLesson(), sortOrder: prev.lessons.length + 1 }] }))}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              新增课时
            </button>
          </div>
          {draft.lessons.map((lesson, index) => (
            <div key={`${lesson.title}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium text-slate-900">课时 {index + 1}</h3>
                <button type="button" className="inline-flex items-center rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600" onClick={() => setDraft((prev) => ({ ...prev, lessons: prev.lessons.filter((_, lessonIndex) => lessonIndex !== index) }))}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  删除
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <FieldHeader title="课时标题" required hint="用户在章节列表里看到的标题。" />
                  <input value={lesson.title} onChange={(event) => setDraft((prev) => ({ ...prev, lessons: prev.lessons.map((item, lessonIndex) => lessonIndex === index ? { ...item, title: event.target.value } : item) }))} className="h-10 w-full rounded-lg border border-slate-200 px-3" placeholder="课时标题" />
                </div>
                <div>
                  <FieldHeader title="视频地址" required hint="只支持 YouTube、Bilibili、Vimeo 的合法链接。" />
                  <input value={lesson.videoUrl} onChange={(event) => setDraft((prev) => ({ ...prev, lessons: prev.lessons.map((item, lessonIndex) => lessonIndex === index ? { ...item, videoUrl: event.target.value } : item) }))} className="h-10 w-full rounded-lg border border-slate-200 px-3" placeholder="视频地址" />
                </div>
              </div>
              <div className="mt-3">
                <FieldHeader title="课时说明" required hint="描述这一课会讲什么、适合解决什么问题。" />
                <textarea value={lesson.description} onChange={(event) => setDraft((prev) => ({ ...prev, lessons: prev.lessons.map((item, lessonIndex) => lessonIndex === index ? { ...item, description: event.target.value } : item) }))} className="min-h-20 w-full rounded-lg border border-slate-200 p-3" placeholder="课时说明" />
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div>
                  <FieldHeader title="排序" hint="数字越小越靠前；留空时默认按当前顺序保存。" />
                  <input type="number" value={lesson.sortOrder} onChange={(event) => setDraft((prev) => ({ ...prev, lessons: prev.lessons.map((item, lessonIndex) => lessonIndex === index ? { ...item, sortOrder: Number(event.target.value) } : item) }))} className="h-10 w-full rounded-lg border border-slate-200 px-3" placeholder="排序" />
                </div>
                <div>
                  <FieldHeader title="时长（秒）" hint="用于展示课程时长和进度。" />
                  <input type="number" value={lesson.durationSeconds} onChange={(event) => setDraft((prev) => ({ ...prev, lessons: prev.lessons.map((item, lessonIndex) => lessonIndex === index ? { ...item, durationSeconds: Number(event.target.value) } : item) }))} className="h-10 w-full rounded-lg border border-slate-200 px-3" placeholder="时长(秒)" />
                </div>
                <div>
                  <FieldHeader title="Starter 模板" hint="如果这节课要一键带到 Playground，选择对应模板；否则留空。" />
                  <select value={lesson.starterTemplate} onChange={(event) => setDraft((prev) => ({ ...prev, lessons: prev.lessons.map((item, lessonIndex) => lessonIndex === index ? { ...item, starterTemplate: event.target.value as LessonDraft["starterTemplate"] } : item) }))} className="h-10 w-full rounded-lg border border-slate-200 px-3">
                    <option value="">无 starter</option>
                    <option value="html">html</option>
                    <option value="typescript">typescript</option>
                    <option value="react">react</option>
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <FieldHeader title="Starter files JSON" hint='可选。填写后会作为 Playground 初始文件，例如 {"App.tsx":"..."}。必须是 JSON 对象。' />
                <textarea value={lesson.starterFilesText} onChange={(event) => setDraft((prev) => ({ ...prev, lessons: prev.lessons.map((item, lessonIndex) => lessonIndex === index ? { ...item, starterFilesText: event.target.value } : item) }))} className="min-h-28 w-full rounded-lg border border-slate-200 p-3 font-mono text-xs" placeholder='Starter files JSON，例如 {"App.tsx":"..."}' />
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
                  setDraft(emptyDraft());
                  await refresh();
                } catch (err) {
                  setError(toFriendlyTutorialError(err));
                }
              }}
            >
              删除教程
            </button>
          ) : null}
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">保存教程</button>
        </div>
      </form>
    </section>
  );
}
