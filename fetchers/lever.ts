import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";
import { loadCompanies } from "../config/load.ts";

const SOURCE = "lever";

interface LeverJob {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt: number;
  categories?: { location?: string };
  descriptionPlain?: string;
}

const lever: Fetcher = async () => {
  const companies = loadCompanies(SOURCE);
  const jobs: RawJob[] = [];
  const errors: string[] = [];

  for (const company of companies) {
    const slug = company.company as string | undefined;
    if (!slug) continue;
    try {
      const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`);
      if (!res.ok) {
        errors.push(`${company.name}: HTTP ${res.status}`);
        continue;
      }
      const data = (await res.json()) as LeverJob[];
      for (const job of data) {
        jobs.push({
          externalId: job.id,
          title: job.text,
          company: company.name as string,
          location: job.categories?.location ?? "",
          country: null,
          url: job.hostedUrl,
          source: SOURCE,
          postedDate: job.createdAt ? new Date(job.createdAt).toISOString() : null,
          descriptionText: job.descriptionPlain,
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

export default lever;
