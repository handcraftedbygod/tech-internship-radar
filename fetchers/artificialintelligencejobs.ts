import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";

const SOURCE = "aijobs";
const SEARCH_URL = "https://artificialintelligencejobs.co/api/jobs";
const PAGE_SIZE = 200;
// Region is continent-level, not per-country -- "Europe" plus "UK" as its own
// separate value is what the API exposes, so both are queried.
const REGIONS = ["Europe", "UK"];

interface AiJobsJob {
  title: string;
  company: string;
  location?: string;
  url?: string;
  apply_url?: string;
  posted?: string;
}

interface AiJobsResponse {
  matched: number;
  jobs: AiJobsJob[];
}

const aijobs: Fetcher = async () => {
  const jobs: RawJob[] = [];
  const errors: string[] = [];

  for (const region of REGIONS) {
    try {
      let offset = 0;
      for (;;) {
        const url = new URL(SEARCH_URL);
        url.searchParams.set("region", region);
        url.searchParams.set("level", "Intern");
        url.searchParams.set("limit", String(PAGE_SIZE));
        url.searchParams.set("offset", String(offset));

        const res = await fetch(url);
        if (!res.ok) {
          errors.push(`${region}: HTTP ${res.status}`);
          break;
        }
        const data = (await res.json()) as AiJobsResponse;
        const results = data.jobs ?? [];
        for (const job of results) {
          // No id field in this API -- the url is the only unique per-job value.
          const jobUrl = job.url ?? job.apply_url;
          if (!jobUrl) continue;
          jobs.push({
            externalId: jobUrl,
            title: job.title,
            company: job.company,
            location: job.location ?? "",
            country: null,
            url: jobUrl,
            source: SOURCE,
            postedDate: job.posted ?? null,
          });
        }
        offset += PAGE_SIZE;
        if (results.length < PAGE_SIZE || offset >= data.matched) break;
      }
    } catch (err) {
      errors.push(`${region}: ${(err as Error).message}`);
    }
  }

  const result: FetchResult = { source: SOURCE, jobs };
  if (errors.length) result.error = errors.join("; ");
  return result;
};

export default aijobs;
