import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";

const SOURCE = "findwork";
// No internship-specific server filter exists (verified live: employment_type
// only accepts "full time"/"contract") -- pull the whole board unfiltered and
// let pipeline/filter.ts's title-based category match do the real filtering,
// same as arbeitnow/adzuna.
const SEARCH_URL = "https://findwork.dev/api/jobs/";
const MAX_RETRIES = 3;

interface FindworkJob {
  id: number;
  role: string;
  company_name: string;
  location?: string | null;
  url: string;
  date_posted?: string;
  text?: string;
}

interface FindworkResponse {
  results: FindworkJob[];
  next: string | null;
}

const findwork: Fetcher = async () => {
  const apiKey = process.env.FINDWORK_API_KEY;
  if (!apiKey) {
    return { source: SOURCE, jobs: [], error: "FINDWORK_API_KEY not set, skipping" };
  }

  const jobs: RawJob[] = [];
  let error: string | undefined;

  try {
    let url: string | null = SEARCH_URL;
    while (url) {
      let res = await fetch(url, { headers: { Authorization: `Token ${apiKey}` } });
      // Free tier throttles to ~10 req/min; the full catalog is 30+ pages, so
      // honor Retry-After instead of giving up on the first 429.
      for (let retry = 0; res.status === 429 && retry < MAX_RETRIES; retry++) {
        const retryAfter = Number(res.headers.get("retry-after")) || 10;
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        res = await fetch(url, { headers: { Authorization: `Token ${apiKey}` } });
      }
      if (!res.ok) {
        error = `HTTP ${res.status}`;
        break;
      }
      const data = (await res.json()) as FindworkResponse;
      for (const job of data.results ?? []) {
        jobs.push({
          externalId: String(job.id),
          title: job.role,
          company: job.company_name,
          location: job.location ?? "",
          country: null,
          url: job.url,
          source: SOURCE,
          postedDate: job.date_posted ?? null,
          descriptionText: job.text,
        });
      }
      url = data.next;
    }
  } catch (err) {
    error = (err as Error).message;
  }

  const result: FetchResult = { source: SOURCE, jobs };
  if (error) result.error = error;
  return result;
};

export default findwork;
