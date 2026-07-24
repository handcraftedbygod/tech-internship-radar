import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";

const SOURCE = "remotive";

interface RemotiveJob {
  id: number;
  title: string;
  company_name: string;
  candidate_required_location: string;
  url: string;
  publication_date: string;
  description?: string;
}

// Two separate queries, like adzuna.ts -- Remotive's search is a single term,
// and "intern" alone won't surface new-grad titles. Dedupe happens downstream
// in the pipeline, so overlap between the two result sets is harmless.
const SEARCH_TERMS = ["intern", "graduate"];

const remotive: Fetcher = async () => {
  const jobs: RawJob[] = [];
  const errors: string[] = [];

  for (const search of SEARCH_TERMS) {
    try {
      const res = await fetch(`https://remotive.com/api/remote-jobs?search=${search}`);
      if (!res.ok) {
        errors.push(`${search}: HTTP ${res.status}`);
        continue;
      }
      const data = (await res.json()) as { jobs: RemotiveJob[] };
      for (const job of data.jobs ?? []) {
        jobs.push({
          externalId: String(job.id),
          title: job.title,
          company: job.company_name,
          location: job.candidate_required_location,
          country: null,
          url: job.url,
          source: SOURCE,
          postedDate: job.publication_date ?? null,
          descriptionText: job.description,
        });
      }
    } catch (err) {
      errors.push(`${search}: ${(err as Error).message}`);
    }
  }

  const result: FetchResult = { source: SOURCE, jobs };
  if (errors.length) result.error = errors.join("; ");
  return result;
};

export default remotive;
