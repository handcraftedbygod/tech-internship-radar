import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";

const SOURCE = "arbeitnow";

interface ArbeitnowJob {
  slug: string;
  title: string;
  company_name: string;
  location: string;
  url: string;
  created_at: number;
  description?: string;
}

const arbeitnow: Fetcher = async () => {
  const jobs: RawJob[] = [];
  let error: string | undefined;

  try {
    let url: string | null = "https://www.arbeitnow.com/api/job-board-api";
    while (url) {
      const res = await fetch(url);
      if (!res.ok) {
        error = `HTTP ${res.status}`;
        break;
      }
      const data = (await res.json()) as { data: ArbeitnowJob[]; links?: { next?: string | null } };
      for (const job of data.data ?? []) {
        jobs.push({
          externalId: job.slug,
          title: job.title,
          company: job.company_name,
          location: job.location,
          country: null,
          url: job.url,
          source: SOURCE,
          postedDate: job.created_at ? new Date(job.created_at * 1000).toISOString() : null,
          descriptionText: job.description,
        });
      }
      url = data.links?.next ?? null;
    }
  } catch (err) {
    error = (err as Error).message;
  }

  const result: FetchResult = { source: SOURCE, jobs };
  if (error) result.error = error;
  return result;
};

export default arbeitnow;
