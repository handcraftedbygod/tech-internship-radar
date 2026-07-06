import type { RawJob } from "../types/job.ts";
import type { FetchResult } from "../fetchers/types.ts";
import { fetchers } from "../fetchers/index.ts";

export interface FetchAllResult {
  results: FetchResult[];
  jobs: RawJob[];
}

export async function fetchAll(): Promise<FetchAllResult> {
  const settled = await Promise.allSettled(fetchers.map((f) => f()));
  const results: FetchResult[] = settled.map((outcome, i) =>
    outcome.status === "fulfilled"
      ? outcome.value
      : { source: fetchers[i].name || `fetcher-${i}`, jobs: [], error: String(outcome.reason) },
  );
  const jobs = results.flatMap((r) => r.jobs);
  return { results, jobs };
}
