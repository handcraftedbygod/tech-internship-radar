import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";

const SOURCE = "freehire";
const SEARCH_URL = "https://freehire.me/api/v1/jobs/search";
const PAGE_SIZE = 100;
// offset+limit caps at 10,000 per freehire's own docs.
const MAX_PAGES = 10;

const REGIONS = ["eu", "uk"];
const SENIORITY_LEVELS = ["intern", "junior"];

interface FreehireJob {
  public_slug?: string;
  external_id?: string;
  url: string;
  title: string;
  company?: string;
  company_slug: string;
  location?: string;
  countries?: string[];
  posted_at?: string;
  description?: string;
}

interface FreehireResponse {
  data: FreehireJob[];
  meta: { total: number };
}

const freehire: Fetcher = async () => {
  const jobs: RawJob[] = [];
  const errors: string[] = [];

  for (const region of REGIONS) {
    for (const seniority of SENIORITY_LEVELS) {
      try {
        for (let pageNum = 0; pageNum < MAX_PAGES; pageNum++) {
          const offset = pageNum * PAGE_SIZE;
          const url = new URL(SEARCH_URL);
          url.searchParams.set("regions", region);
          url.searchParams.set("seniority", seniority);
          url.searchParams.set("limit", String(PAGE_SIZE));
          url.searchParams.set("offset", String(offset));

          const res = await fetch(url);
          if (!res.ok) {
            errors.push(`${region}/${seniority}: HTTP ${res.status}`);
            break;
          }
          const data = (await res.json()) as FreehireResponse;
          const results = data.data ?? [];
          for (const job of results) {
            jobs.push({
              externalId: job.public_slug ?? job.external_id ?? job.url,
              title: job.title,
              company: job.company ?? job.company_slug,
              location: job.location ?? "",
              country: job.countries?.[0]?.toUpperCase() ?? null,
              url: job.url,
              source: SOURCE,
              postedDate: job.posted_at ?? null,
              descriptionText: job.description,
            });
          }
          if (results.length < PAGE_SIZE || offset + PAGE_SIZE >= data.meta.total) break;
        }
      } catch (err) {
        errors.push(`${region}/${seniority}: ${(err as Error).message}`);
      }
    }
  }

  const result: FetchResult = { source: SOURCE, jobs };
  if (errors.length) result.error = errors.join("; ");
  return result;
};

export default freehire;
