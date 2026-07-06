import type { Job } from "../types/job.ts";

export function dedupe(jobs: Job[]): Job[] {
  const seen = new Map<string, Job>();
  for (const job of jobs) {
    if (!seen.has(job.id)) seen.set(job.id, job);
  }
  return [...seen.values()];
}
