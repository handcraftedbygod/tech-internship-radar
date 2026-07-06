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

const remotive: Fetcher = async () => {
  const jobs: RawJob[] = [];
  let error: string | undefined;

  try {
    const res = await fetch("https://remotive.com/api/remote-jobs?search=intern");
    if (!res.ok) {
      error = `HTTP ${res.status}`;
    } else {
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
    }
  } catch (err) {
    error = (err as Error).message;
  }

  const result: FetchResult = { source: SOURCE, jobs };
  if (error) result.error = error;
  return result;
};

export default remotive;
