import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";

const SOURCE = "vanshb03";
// ponytail: repo name has a grad-year baked in and gets renamed yearly
// (Summer2027-Internships -> Summer2028-Internships once the cycle turns
// over) -- bump this URL when it 404s.
const LISTINGS_URL =
  "https://raw.githubusercontent.com/vanshb03/Summer2027-Internships/dev/.github/scripts/listings.json";

interface ListingEntry {
  id: string;
  title: string;
  company_name: string;
  locations: string[];
  url: string;
  date_posted: number;
  active: boolean;
  is_visible: boolean;
}

const vanshb03: Fetcher = async () => {
  const jobs: RawJob[] = [];
  let error: string | undefined;

  try {
    const res = await fetch(LISTINGS_URL);
    if (!res.ok) {
      error = `HTTP ${res.status}`;
    } else {
      const data = (await res.json()) as ListingEntry[];
      for (const job of data) {
        if (!job.active || !job.is_visible) continue;
        jobs.push({
          externalId: job.id,
          title: job.title,
          company: job.company_name,
          location: (job.locations ?? []).join(", "),
          country: null,
          url: job.url,
          source: SOURCE,
          postedDate: job.date_posted ? new Date(job.date_posted * 1000).toISOString() : null,
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

export default vanshb03;
