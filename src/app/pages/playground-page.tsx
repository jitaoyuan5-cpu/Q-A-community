import { Play, RefreshCcw, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { apiRequest } from "../api/client";
import { useAuth } from "../auth-context";
import { useI18n } from "../i18n";
import { getP3Copy } from "../utils/p3-copy";
import type { PlaygroundShare, PlaygroundTemplate } from "../types";

const reactPrelude = `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <style>body{margin:0;padding:24px;font-family:sans-serif;background:#f8fafc;}button{font:inherit;}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>
`;

const reactSuffix = `
    </script>
  </body>
</html>`;

const htmlPreview = (files: Record<string, string>) => `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>${files["styles.css"] || ""}</style>
  </head>
  <body>
    ${files["index.html"] || ""}
    <script type="module">${files["script.js"] || ""}</script>
  </body>
</html>`;

export function PlaygroundPage() {
  const { locale } = useI18n();
  const copy = getP3Copy(locale).playground;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [templates, setTemplates] = useState<PlaygroundTemplate[]>([]);
  const [templateKey, setTemplateKey] = useState<PlaygroundTemplate["key"]>("html");
  const [files, setFiles] = useState<Record<string, string>>({});
  const [title, setTitle] = useState<string>(copy.defaultTitle);
  const [activeFile, setActiveFile] = useState("");
  const [srcDoc, setSrcDoc] = useState("");
  const [error, setError] = useState("");

  const currentTemplate = useMemo(() => templates.find((item) => item.key === templateKey) || null, [templateKey, templates]);

  const loadTemplate = (template: PlaygroundTemplate, nextFiles?: Record<string, string>) => {
    const initialFiles = nextFiles || template.files;
    setTemplateKey(template.key);
    setFiles(initialFiles);
    setActiveFile(Object.keys(initialFiles)[0] || "");
  };

  const buildPreview = async (nextTemplateKey = templateKey, nextFiles = files) => {
    if (nextTemplateKey === "html") {
      setSrcDoc(htmlPreview(nextFiles));
      return;
    }

    const ts = await import("typescript");
    if (nextTemplateKey === "typescript") {
      const js = ts.transpileModule(nextFiles["index.ts"] || "", {
        compilerOptions: {
          target: ts.ScriptTarget.ES2018,
          module: ts.ModuleKind.None,
        },
      }).outputText;
      setSrcDoc(htmlPreview({ "index.html": "<pre id=\"output\"></pre>", "script.js": `${js}\ndocument.getElementById(\"output\").textContent = 'TypeScript compiled successfully. Open devtools to inspect console output.';`, "styles.css": "body{font-family:monospace;padding:24px;background:#0f172a;color:#e2e8f0;}" }));
      return;
    }

    const js = ts.transpileModule(nextFiles["App.tsx"] || "", {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2018,
        module: ts.ModuleKind.None,
      },
    }).outputText;
    setSrcDoc(`${reactPrelude}${js}${reactSuffix}`);
  };

  useEffect(() => {
    apiRequest<PlaygroundTemplate[]>("/playground/templates")
      .then(async (items) => {
        setTemplates(items);
        const shareId = Number(params.get("share"));
        const templateParam = (params.get("template") as PlaygroundTemplate["key"] | null) || null;
        const filesParam = params.get("files");
        if (shareId) {
          const share = await apiRequest<PlaygroundShare>(`/playground/shares/${shareId}`);
          setTitle(share.title);
          const template = items.find((item) => item.key === share.templateKey) || items[0];
          loadTemplate(template, share.files);
          return;
        }
        if (filesParam) {
          const parsedFiles = JSON.parse(filesParam) as Record<string, string>;
          const requestedTemplate = items.find((item) => item.key === templateParam) || items[0];
          loadTemplate(requestedTemplate, parsedFiles);
          setTitle(params.get("title") || copy.importedTitle);
          return;
        }
        const requestedTemplate = items.find((item) => item.key === templateParam) || items[0];
        const queryCode = params.get("code");
        if (queryCode) {
          const fileName = requestedTemplate.key === "react" ? "App.tsx" : requestedTemplate.key === "typescript" ? "index.ts" : "script.js";
          loadTemplate(requestedTemplate, { ...requestedTemplate.files, [fileName]: queryCode });
          setTitle(params.get("title") || copy.importedTitle);
          return;
        }
        loadTemplate(requestedTemplate);
      })
      .catch(() => setTemplates([]));
  }, []);

  useEffect(() => {
    if (!Object.keys(files).length) return;
    buildPreview().catch((err) => setError((err as Error).message));
  }, [templateKey, JSON.stringify(files)]);

  const saveShare = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    const response = await apiRequest<{ id: number }>("/playground/shares", {
      method: "POST",
      body: JSON.stringify({ title, templateKey, files }),
    });
    const url = `${window.location.origin}/playground?share=${response.id}`;
    await navigator.clipboard.writeText(url).catch(() => undefined);
  };

  return (
    <section className="space-y-5">
      <header className="app-panel app-mesh rounded-[2rem] px-6 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <p className="app-kicker">{copy.heroKicker}</p>
            <h1 className="app-display mt-3 text-4xl font-semibold leading-tight text-slate-900 sm:text-[3.1rem]">{copy.heroTitle}</h1>
            <p className="mt-4 text-sm leading-7 text-slate-600">{copy.heroBody}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="app-input h-11 rounded-[1rem] px-3 text-sm"
              value={templateKey}
              onChange={(event) => {
                const next = templates.find((item) => item.key === event.target.value);
                if (next) loadTemplate(next);
              }}
            >
              {templates.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
            <button type="button" className="app-button-ghost inline-flex items-center rounded-[1rem] px-3 py-2 text-sm" onClick={() => currentTemplate && loadTemplate(currentTemplate)}>
              <RefreshCcw className="mr-1 h-4 w-4" />
              {copy.reset}
            </button>
            <button type="button" className="app-button-ghost inline-flex items-center rounded-[1rem] px-3 py-2 text-sm" onClick={() => buildPreview().catch((err) => setError((err as Error).message))}>
              <Play className="mr-1 h-4 w-4" />
              {copy.run}
            </button>
            <button type="button" className="app-button-primary inline-flex items-center rounded-[1rem] px-3 py-2 text-sm text-white" onClick={() => saveShare().catch((err) => setError((err as Error).message))}>
              <Share2 className="mr-1 h-4 w-4" />
              {copy.share}
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <div className="app-panel rounded-[2rem] p-4">
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="app-input mb-3 h-11 rounded-[1rem] px-3" placeholder={copy.titlePlaceholder} />
          <div className="mb-3 flex flex-wrap gap-2">
            {Object.keys(files).map((fileName) => (
              <button
                key={fileName}
                type="button"
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${activeFile === fileName ? "app-button-primary text-white" : "app-button-ghost text-slate-700"}`}
                onClick={() => setActiveFile(fileName)}
              >
                {fileName}
              </button>
            ))}
          </div>
          <textarea
            value={files[activeFile] || ""}
            onChange={(event) => setFiles((prev) => ({ ...prev, [activeFile]: event.target.value }))}
            className="app-input min-h-[460px] rounded-[1.6rem] p-4 font-mono text-sm"
          />
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="app-panel-dark rounded-[2rem] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="app-kicker !text-[#d8c6a3]">{copy.previewKicker}</p>
              <h2 className="app-display mt-2 text-2xl font-semibold text-[#f8f1e3]">{copy.preview}</h2>
            </div>
            <span className="text-xs text-slate-300">{copy.sandboxLabel}</span>
          </div>
          <iframe title="playground-preview" srcDoc={srcDoc} className="h-[560px] w-full rounded-[1.5rem] border border-white/10 bg-white" sandbox="allow-scripts" />
        </div>
      </div>
    </section>
  );
}
