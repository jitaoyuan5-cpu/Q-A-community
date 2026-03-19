import type { RemoteJob } from "../types";

export type SalaryBand = { label: string; min: number; max: number };

export const salaryBands: SalaryBand[] = [
  { label: "全部", min: 0, max: Number.POSITIVE_INFINITY },
  { label: "20K-30K", min: 20, max: 30 },
  { label: "30K-40K", min: 30, max: 40 },
  { label: "40K+", min: 40, max: Number.POSITIVE_INFINITY },
];

export const filterRemoteJobs = (
  jobs: RemoteJob[],
  region: string,
  salaryLabel: string,
  skill: string,
) => {
  const band = salaryBands.find((item) => item.label === salaryLabel) ?? salaryBands[0];
  return jobs.filter((job) => {
    const matchRegion = region === "全部" || job.region === region;
    const matchSkill = skill === "全部" || job.skills.includes(skill);
    const matchSalary = job.salaryMax >= band.min && job.salaryMin <= band.max;
    return matchRegion && matchSkill && matchSalary;
  });
};