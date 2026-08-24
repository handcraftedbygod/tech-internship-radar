import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";
import { loadCompanies } from "../config/load.ts";

const SOURCE = "workable";

interface WorkableJob {
  shortcode: string;
  title: string;
  city?: string;
  country?: string;
  url: string;
  published_on?: string;
  created_at?: string;
}

const workable: Fetcher = async () => {
  const companies = loadCompanies(SOURCE);
  const jobs: RawJob[] = [];
  const errors: string[] = [];

  for (const company of companies) {
    const apiUrl = company.apiUrl as string | undefined;
    if (!apiUrl) continue;
    try {
      const res = await fetch(apiUrl);
      if (!res.ok) {
        errors.push(`${company.name}: HTTP ${res.status}`);
        continue;
      }
      const data = (await res.json()) as { jobs: WorkableJob[] };
      for (const job of data.jobs ?? []) {
        jobs.push({
          externalId: job.shortcode,
          title: job.title,
          company: company.name as string,
          location: [job.city, job.country].filter(Boolean).join(", "),
          country: null,
          url: job.url,
          source: SOURCE,
          postedDate: job.published_on ?? job.created_at ?? null,
        });
      }
    } catch (err) {
      errors.push(`${company.name}: ${(err as Error).message}`);
    }
  }

  const result: FetchResult = { source: SOURCE, jobs };
  if (errors.length) result.error = errors.join("; ");
  return result;
};

export default workable;
