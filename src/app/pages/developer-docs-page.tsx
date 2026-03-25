import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import { useI18n } from "../i18n";
import { getP3Copy } from "../utils/p3-copy";

type OpenApiSchema = {
  type?: string;
  properties?: Record<string, OpenApiSchema>;
  items?: OpenApiSchema;
  required?: string[];
  enum?: string[];
  format?: string;
  nullable?: boolean;
  example?: unknown;
  allOf?: OpenApiSchema[];
  $ref?: string;
};

type OpenApiParameter = {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: OpenApiSchema;
  $ref?: string;
};

type OpenApiResponse = {
  description: string;
  content?: Record<string, { schema?: OpenApiSchema; example?: unknown }>;
  $ref?: string;
};

type OpenApiOperation = {
  summary: string;
  description?: string;
  parameters?: OpenApiParameter[];
  responses?: Record<string, OpenApiResponse>;
  security?: Array<Record<string, string[]>>;
};

type OpenApiDoc = {
  info: { title: string; version: string; description?: string };
  paths: Record<string, Record<string, OpenApiOperation>>;
  components?: {
    parameters?: Record<string, OpenApiParameter>;
    responses?: Record<string, OpenApiResponse>;
  };
};

const resolveRef = <T extends { $ref?: string }>(doc: OpenApiDoc, item: T | undefined, bucket: "parameters" | "responses"): T | undefined => {
  if (!item?.$ref) return item;
  const name = item.$ref.split("/").pop() || "";
  return doc.components?.[bucket]?.[name] as T | undefined;
};

const renderExample = (value: unknown) => JSON.stringify(value, null, 2);

export function DeveloperDocsPage() {
  const { locale } = useI18n();
  const copy = getP3Copy(locale).developerDocs;
  const [doc, setDoc] = useState<OpenApiDoc | null>(null);

  useEffect(() => {
    apiRequest<OpenApiDoc>("/public/v1/openapi.json").then(setDoc).catch(() => setDoc(null));
  }, []);

  const sections = useMemo(() => {
    if (!doc) return [];
    return Object.entries(doc.paths).flatMap(([path, methods]) =>
      Object.entries(methods).map(([method, operation]) => ({
        key: `${method}-${path}`,
        path,
        method,
        operation,
        parameters: (operation.parameters || [])
          .map((item) => resolveRef(doc, item, "parameters"))
          .filter(Boolean) as OpenApiParameter[],
        responses: Object.entries(operation.responses || {}).map(([status, response]) => ({
          status,
          response: resolveRef(doc, response, "responses") || response,
        })),
      })),
    );
  }, [doc]);

  return (
    <section className="space-y-5">
      <header className="app-panel app-mesh rounded-[2rem] px-6 py-6">
        <p className="app-kicker">{copy.heroKicker}</p>
        <h1 className="app-display mt-3 text-4xl font-semibold text-slate-900">{copy.title}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">{copy.heroBody}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="app-panel rounded-[1.8rem] p-5">
          <p className="app-kicker">{copy.authKicker}</p>
          <h2 className="app-display mt-2 text-2xl font-semibold text-slate-900">{copy.authTitle}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">{copy.authBody}</p>
        </article>
        <article className="app-panel rounded-[1.8rem] p-5">
          <p className="app-kicker">{copy.limitsKicker}</p>
          <h2 className="app-display mt-2 text-2xl font-semibold text-slate-900">{copy.rateLimitTitle}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">{copy.rateLimitBody(120)}</p>
        </article>
        <article className="app-panel rounded-[1.8rem] p-5">
          <p className="app-kicker">{copy.versionKicker}</p>
          <h2 className="app-display mt-2 text-2xl font-semibold text-slate-900">{doc?.info.version || "v1"}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">{doc?.info.description || doc?.info.title}</p>
        </article>
      </div>

      <div className="app-panel-dark rounded-[1.8rem] p-5 font-mono text-xs text-slate-100">
        <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#d8c6a3]">{copy.curlTitle}</p>
        <p>curl -H "x-api-key: &lt;YOUR_KEY&gt;" {window.location.origin.replace(":5173", ":4000")}/api/public/v1/questions</p>
      </div>

      <div className="space-y-3">
        {doc
          ? sections.map(({ key, path, method, operation, parameters, responses }) => {
              const successResponses = responses.filter((item) => item.status.startsWith("2"));
              const errorResponses = responses.filter((item) => !item.status.startsWith("2"));
              const example = successResponses.find((item) => item.response.content?.["application/json"]?.example)?.response.content?.["application/json"]?.example;
              return (
                <article key={key} className="app-panel rounded-[1.8rem] p-5">
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <span className="app-badge uppercase">{method}</span>
                    <code className="text-sm text-slate-700">{path}</code>
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">{operation.summary}</h2>
                  {operation.description ? <p className="mt-2 text-sm leading-7 text-slate-600">{operation.description}</p> : null}

                  <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <div className="space-y-4">
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.parameters}</p>
                        {parameters.length ? (
                          <div className="space-y-2">
                            {parameters.map((item) => (
                              <div key={`${path}-${item.name}`} className="rounded-[1rem] border border-slate-200 bg-white/70 px-3 py-3 text-sm">
                                <div className="flex flex-wrap items-center gap-2">
                                  <code className="font-semibold text-slate-900">{item.name}</code>
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{item.in}</span>
                                  {item.required ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700">{copy.requiredBadge}</span> : null}
                                </div>
                                {item.description ? <p className="mt-2 text-xs leading-6 text-slate-500">{item.description}</p> : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">{copy.emptyParameters}</p>
                        )}
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.responses}</p>
                        <div className="space-y-2" aria-label={`${operation.summary} ${copy.responses}`}>
                          {successResponses.map(({ status, response }) => (
                            <div key={`${path}-success-${status}`} className="rounded-[1rem] border border-slate-200 bg-white/70 px-3 py-3 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="app-badge">{status}</span>
                                <span className="text-slate-700">{response.description}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {errorResponses.length ? (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.errorResponses}</p>
                          <div className="space-y-2" aria-label={`${operation.summary} ${copy.errorResponses}`}>
                            {errorResponses.map(({ status, response }) => (
                              <div key={`${path}-error-${status}`} className="rounded-[1rem] border border-slate-200 bg-white/70 px-3 py-3 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="app-badge">{status}</span>
                                  <span className="text-slate-700">{response.description}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.responseExample}</p>
                      {example ? (
                        <pre className="overflow-x-auto rounded-[1.2rem] border border-slate-200 bg-[rgba(245,240,232,0.86)] p-4 text-xs leading-6 text-slate-700">{renderExample(example)}</pre>
                      ) : (
                        <div className="rounded-[1.2rem] border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">{copy.noExample}</div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          : <div className="app-panel rounded-[1.8rem] px-6 py-12 text-center text-slate-500">{copy.loadFailed}</div>}
      </div>
    </section>
  );
}
