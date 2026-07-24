import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";
import { loadLocations } from "../config/load.ts";

const SOURCE = "adzuna";

interface AdzunaJob {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  redirect_url: string;
  created: string;
  description?: string;
}

// One query per search term per country -- Adzuna's "what" param is a single
// term, not a keyword list, so internship and new-grad postings need separate
// queries. Overlap between the two (a title matching both) is harmless: the
// pipeline's dedupe step collapses by job id downstream.
const SEARCH_TERMS = ["internship", "graduate"];

const adzuna: Fetcher = async () => {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    return { source: SOURCE, jobs: [], error: "ADZUNA_APP_ID/ADZUNA_APP_KEY not set, skipping" };
  }

  const { hubs } = loadLocations();
  const countries = [...new Set(hubs.map((h) => h.adzunaCountry).filter((c): c is string => !!c))];
  const jobs: RawJob[] = [];
  const errors: string[] = [];

  for (const country of countries) {
    for (const what of SEARCH_TERMS) {
      try {
        const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`);
        url.searchParams.set("app_id", appId);
        url.searchParams.set("app_key", appKey);
        url.searchParams.set("what", what);
        url.searchParams.set("results_per_page", "50");

        const res = await fetch(url);
        if (!res.ok) {
          errors.push(`${country}/${what}: HTTP ${res.status}`);
          continue;
        }
        const data = (await res.json()) as { results: AdzunaJob[] };
        for (const job of data.results ?? []) {
          jobs.push({
            externalId: job.id,
            title: job.title,
            company: job.company?.display_name ?? "Unknown",
            location: job.location?.display_name ?? "",
            // Not the job's real country -- just the query param we searched
            // under. Adzuna's response has no per-job country field, and
            // faking one here let matchesLocation's country fallback wave
            // through every US result regardless of city (e.g. rural
            // Louisiana postings alongside NYC/SF). Leave it null like
            // arbeitnow/remotive do, so location filtering relies on the
            // real city text in `location` instead.
            country: null,
            url: job.redirect_url,
            source: SOURCE,
            postedDate: job.created ?? null,
            descriptionText: job.description,
          });
        }
      } catch (err) {
        errors.push(`${country}/${what}: ${(err as Error).message}`);
      }
    }
  }

  const result: FetchResult = { source: SOURCE, jobs };
  if (errors.length) result.error = errors.join("; ");
  return result;
};

export default adzuna;
