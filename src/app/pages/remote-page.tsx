import { useMemo } from "react";
import { DollarSign, Globe, MapPin } from "lucide-react";
import { useQA } from "../store/qa-context";
import { useSearchParams } from "react-router";
import { filterRemoteJobs, salaryBands } from "../utils/remote-filter";

export function RemotePage() {
  const { state } = useQA();
  const [params, setParams] = useSearchParams();

  const region = params.get("region") || "全部";
  const salary = params.get("salary") || "全部";
  const skill = params.get("skill") || "全部";

  const regions = useMemo(() => ["全部", ...Array.from(new Set(state.remoteJobs.map((job) => job.region)))], [state.remoteJobs]);
  const skills = useMemo(() => ["全部", ...Array.from(new Set(state.remoteJobs.flatMap((job) => job.skills)))], [state.remoteJobs]);

  const jobs = useMemo(() => {
    return filterRemoteJobs(state.remoteJobs, region, salary, skill);
  }, [region, salary, skill, state.remoteJobs]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value === "全部") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <section>
      <header className="mb-5 flex items-center gap-3">
        <Globe className="h-7 w-7 text-green-600" />
        <div>
          <h1 className="text-2xl font-semibold">远程广场</h1>
          <p className="text-sm text-slate-600">支持地区/薪资/技能组合筛选</p>
        </div>
      </header>

      <div className="mb-4 grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <select value={region} onChange={(event) => setFilter("region", event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          {regions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={salary} onChange={(event) => setFilter("salary", event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          {salaryBands.map((item) => <option key={item.label} value={item.label}>{item.label}</option>)}
        </select>
        <select value={skill} onChange={(event) => setFilter("skill", event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          {skills.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <div className="space-y-4">
        {jobs.map((job) => (
          <article key={job.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{job.title}</h2>
                <p className="text-sm text-slate-600">{job.company}</p>
              </div>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">{job.type}</span>
            </div>
            <div className="mb-3 flex flex-wrap gap-4 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{job.location}</span>
              <span className="inline-flex items-center gap-1"><DollarSign className="h-4 w-4" />{job.salaryMin}K-{job.salaryMax}K</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {job.skills.map((item) => (
                <button key={item} type="button" onClick={() => setFilter("skill", item)} className="rounded-full bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100">
                  {item}
                </button>
              ))}
            </div>
          </article>
        ))}
        {jobs.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">无匹配职位，请调整筛选条件。</p>}
      </div>
    </section>
  );
}
