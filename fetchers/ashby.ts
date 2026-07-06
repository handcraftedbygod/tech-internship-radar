import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";
import { loadCompanies } from "../config/load.ts";

const SOURCE = "ashby";

interface AshbyJob {
  id: string;
  title: string;
  jobUrl: string;
  publishedAt?: string;
  location?: string;
  descriptionPlain?: string;
}

const ashby: Fetcher = async () => {
  const companies = loadCompanies(SOURCE);
  const jobs: RawJob[] = [];
  const errors: string[] = [];

  for (const company of companies) {
    const companyName = company.companyName as string | undefined;
    if (!companyName) continue;
    try {
      const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${companyName}`);
      if (!res.ok) {
        errors.push(`${company.name}: HTTP ${res.status}`);
        continue;
      }
      const data = (await res.json()) as { jobs: AshbyJob[] };
      for (const job of data.jobs) {
        jobs.push({
          externalId: job.id,
          title: job.title,
          company: company.name as string,
          location: job.location ?? "",
          country: null,
          url: job.jobUrl,
          source: SOURCE,
          postedDate: job.publishedAt ?? null,
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

export default ashby;
