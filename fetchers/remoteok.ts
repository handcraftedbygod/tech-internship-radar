import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";

const SOURCE = "remoteok";
const API_URL = "https://remoteok.com/api";

interface RemoteOkJob {
  id: string;
  position: string;
  company: string;
  location?: string;
  url: string;
  date?: string;
  description?: string;
}

const remoteok: Fetcher = async () => {
  const jobs: RawJob[] = [];
  let error: string | undefined;

  try {
    const res = await fetch(API_URL);
    if (!res.ok) {
      error = `HTTP ${res.status}`;
    } else {
      // First element is a legal/attribution notice, not a job -- it has no
      // `id`/`position`, so checking for those doubles as skipping it.
      const data = (await res.json()) as Partial<RemoteOkJob>[];
      for (const job of data) {
        if (!job.id || !job.position) continue;
        jobs.push({
          externalId: job.id,
          title: job.position,
          company: job.company ?? "Unknown",
          location: job.location ?? "",
          country: null,
          url: job.url ?? `https://remoteok.com/remote-jobs/${job.id}`,
          source: SOURCE,
          postedDate: job.date ?? null,
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

export default remoteok;
