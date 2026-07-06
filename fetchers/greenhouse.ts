import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";
import { loadCompanies } from "../config/load.ts";

const SOURCE = "greenhouse";

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  updated_at: string;
  location: { name: string };
  content?: string;
}

const greenhouse: Fetcher = async () => {
  const companies = loadCompanies(SOURCE);
  const jobs: RawJob[] = [];
  const errors: string[] = [];

  for (const company of companies) {
    const boardToken = company.boardToken as string | undefined;
    if (!boardToken) continue;
    try {
      const res = await fetch(
        `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`,
      );
      if (!res.ok) {
        errors.push(`${company.name}: HTTP ${res.status}`);
        continue;
      }
      const data = (await res.json()) as { jobs: GreenhouseJob[] };
      for (const job of data.jobs) {
        jobs.push({
          externalId: String(job.id),
          title: job.title,
          company: company.name as string,
          location: job.location?.name ?? "",
          country: null,
          url: job.absolute_url,
          source: SOURCE,
          postedDate: job.updated_at ?? null,
          descriptionText: job.content,
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

export default greenhouse;
