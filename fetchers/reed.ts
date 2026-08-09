import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";

const SOURCE = "reed";
const SEARCH_URL = "https://www.reed.co.uk/api/1.0/search";
const RESULTS_PER_PAGE = 100;
const SEARCH_TERMS = ["internship", "graduate"];

interface ReedJob {
  jobId: number;
  employerName: string;
  jobTitle: string;
  description?: string;
  locationName: string;
  date?: string;
  jobUrl: string;
}

interface ReedResponse {
  totalResults: number;
  results: ReedJob[];
}

const reed: Fetcher = async () => {
  const apiKey = process.env.REED_API_KEY;
  if (!apiKey) {
    return { source: SOURCE, jobs: [], error: "REED_API_KEY not set, skipping" };
  }
  // Reed's API auth is HTTP Basic with the key as username and no password.
  const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;

  const jobs: RawJob[] = [];
  const errors: string[] = [];

  for (const keywords of SEARCH_TERMS) {
    try {
      let skip = 0;
      for (;;) {
        const url = new URL(SEARCH_URL);
        url.searchParams.set("keywords", keywords);
        url.searchParams.set("resultsToTake", String(RESULTS_PER_PAGE));
        url.searchParams.set("resultsToSkip", String(skip));

        const res = await fetch(url, { headers: { Authorization: authHeader } });
        if (!res.ok) {
          errors.push(`${keywords}: HTTP ${res.status}`);
          break;
        }
        const data = (await res.json()) as ReedResponse;
        const results = data.results ?? [];
        for (const job of results) {
          jobs.push({
            externalId: String(job.jobId),
            title: job.jobTitle,
            company: job.employerName,
            location: job.locationName,
            // Reed is a UK-only board -- no per-job country field in the response.
            country: "GB",
            url: job.jobUrl,
            source: SOURCE,
            postedDate: job.date ?? null,
            descriptionText: job.description,
          });
        }
        skip += RESULTS_PER_PAGE;
        if (results.length < RESULTS_PER_PAGE || skip >= data.totalResults) break;
      }
    } catch (err) {
      errors.push(`${keywords}: ${(err as Error).message}`);
    }
  }

  const result: FetchResult = { source: SOURCE, jobs };
  if (errors.length) result.error = errors.join("; ");
  return result;
};

export default reed;
