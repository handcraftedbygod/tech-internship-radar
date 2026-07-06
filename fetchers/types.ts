import type { RawJob } from "../types/job.ts";

export interface FetchResult {
  source: string;
  jobs: RawJob[];
  error?: string;
}

// A fetcher must never throw — it catches its own errors and reports them
// via FetchResult.error so one dead source can't break the whole run.
export type Fetcher = () => Promise<FetchResult>;
