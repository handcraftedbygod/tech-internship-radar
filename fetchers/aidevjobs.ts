import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";

const SOURCE = "aidevjobs";
const SEARCH_URL = "https://aidevboard.com/api/v1/jobs";
const PAGE_SIZE = 50;
// AI Dev Jobs has no "intern" value in its level enum (junior/mid/senior/lead/
// principal), so keyword search on "q" is the only server-side internship filter.
const SEARCH_TERMS = ["internship", "graduate"];

interface AiDevJob {
  id: string;
  title: string;
  company_name: string;
  location?: string;
  apply_url: string;
  created_at?: string;
  description?: string;
}

interface AiDevJobsResponse {
  jobs: AiDevJob[];
  has_next: boolean;
}

const aidevjobs: Fetcher = async () => {
  const jobs: RawJob[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];

  for (const q of SEARCH_TERMS) {
    try {
      let page = 1;
      for (;;) {
        const url = new URL(SEARCH_URL);
        url.searchParams.set("q", q);
        url.searchParams.set("limit", String(PAGE_SIZE));
        url.searchParams.set("page", String(page));

        const res = await fetch(url);
        if (!res.ok) {
          errors.push(`${q}: HTTP ${res.status}`);
          break;
        }
        const data = (await res.json()) as AiDevJobsResponse;
        const results = data.jobs ?? [];
        for (const job of results) {
          if (seen.has(job.id)) continue;
          seen.add(job.id);
          jobs.push({
            externalId: job.id,
            title: job.title,
            company: job.company_name,
            location: job.location ?? "",
            country: null,
            url: job.apply_url,
            source: SOURCE,
            postedDate: job.created_at ?? null,
            descriptionText: job.description,
          });
        }
        if (!data.has_next) break;
        page += 1;
      }
    } catch (err) {
      errors.push(`${q}: ${(err as Error).message}`);
    }
  }

  const result: FetchResult = { source: SOURCE, jobs };
  if (errors.length) result.error = errors.join("; ");
  return result;
};

export default aidevjobs;
