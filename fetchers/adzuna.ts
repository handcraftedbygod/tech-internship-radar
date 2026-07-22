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
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string;
}

// Adzuna is the only source with structured salary data -- ATS APIs
// (Greenhouse/Lever/Ashby/Workday) don't expose it in list responses, so
// `salary` is left undefined there rather than scraped from free text.
function formatSalary(job: AdzunaJob): string | undefined {
  const { salary_min: min, salary_max: max } = job;
  if (!min && !max) return undefined;
  const round = (n: number) => Math.round(n / 1000);
  const range = min && max && min !== max ? `${round(min)}k-${round(max)}k` : `${round(min || max!)}k`;
  return job.salary_is_predicted === "1" ? `~${range}` : range;
}

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
    try {
      const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`);
      url.searchParams.set("app_id", appId);
      url.searchParams.set("app_key", appKey);
      url.searchParams.set("what", "internship");
      url.searchParams.set("results_per_page", "50");

      const res = await fetch(url);
      if (!res.ok) {
        errors.push(`${country}: HTTP ${res.status}`);
        continue;
      }
      const data = (await res.json()) as { results: AdzunaJob[] };
      for (const job of data.results ?? []) {
        jobs.push({
          externalId: job.id,
          title: job.title,
          company: job.company?.display_name ?? "Unknown",
          location: job.location?.display_name ?? "",
          country: country.toUpperCase(),
          url: job.redirect_url,
          source: SOURCE,
          postedDate: job.created ?? null,
          salary: formatSalary(job),
          descriptionText: job.description,
        });
      }
    } catch (err) {
      errors.push(`${country}: ${(err as Error).message}`);
    }
  }

  const result: FetchResult = { source: SOURCE, jobs };
  if (errors.length) result.error = errors.join("; ");
  return result;
};

export default adzuna;
