import { Code2, KeyRound, Link as LinkIcon } from "lucide-react";
import { Link } from "react-router";
import { useI18n } from "../i18n";
import { getP3Copy } from "../utils/p3-copy";

export function DevelopersPage() {
  const { locale } = useI18n();
  const copy = getP3Copy(locale).developers;
  return (
    <section className="space-y-6">
      <header className="app-panel app-mesh rounded-[2rem] px-6 py-6">
        <p className="app-kicker">{copy.heroKicker}</p>
        <h1 className="app-display mt-3 text-4xl font-semibold text-slate-900 sm:text-[3.1rem]">{copy.title}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
          {copy.heroBody}
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/developers/docs" className="app-panel rounded-[1.8rem] p-5 transition hover:-translate-y-0.5">
          <Code2 className="mb-4 h-8 w-8 text-[var(--primary)]" />
          <p className="app-kicker">{copy.docsKicker}</p>
          <h2 className="app-display mt-2 text-2xl font-semibold text-slate-900">{copy.docsTitle}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">{copy.docsBody}</p>
        </Link>
        <Link to="/developers/keys" className="app-panel rounded-[1.8rem] p-5 transition hover:-translate-y-0.5">
          <KeyRound className="mb-4 h-8 w-8 text-[var(--accent)]" />
          <p className="app-kicker">{copy.keysKicker}</p>
          <h2 className="app-display mt-2 text-2xl font-semibold text-slate-900">{copy.keysTitle}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">{copy.keysBody}</p>
        </Link>
        <div className="app-panel-dark rounded-[1.8rem] p-5">
          <LinkIcon className="mb-4 h-8 w-8 text-[#f0c06f]" />
          <p className="app-kicker !text-[#d8c6a3]">{copy.scopeKicker}</p>
          <h2 className="app-display mt-2 text-2xl font-semibold text-[#f8f1e3]">{copy.scopeTitle}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">{copy.scopeBody}</p>
        </div>
      </div>
    </section>
  );
}
