import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";
import { loadCompanies } from "../config/load.ts";

const SOURCE = "icims";
const PAGE_SIZE = 10;

interface IcimsJob {
  data: {
    req_id: string;
    title: string;
    full_location?: string;
    short_location?: string;
    country_code?: string;
    apply_url: string;
    posted_date?: string;
    create_date?: string;
  };
}

const icims: Fetcher = async () => {
  const companies = loadCompanies("icims");
  const jobs: RawJob[] = [];
  const errors: string[] = [];

  for (const company of companies) {
    const apiUrl = company.apiUrl as string | undefined;
    if (!apiUrl) continue;
    try {
      let page = 1;
      for (;;) {
        const url = new URL(apiUrl);
        url.searchParams.set("page", String(page));
        url.searchParams.set("sortBy", "relevance");
        url.searchParams.set("descending", "false");
        url.searchParams.set("internal", "false");

        const res = await fetch(url);
        if (!res.ok) {
          errors.push(`${company.name}: HTTP ${res.status}`);
          break;
        }
        const data = (await res.json()) as { jobs: IcimsJob[]; totalCount: number };
        const postings = data.jobs ?? [];
        if (postings.length === 0) break;

        for (const job of postings) {
          const d = job.data;
          jobs.push({
            externalId: d.req_id,
            title: d.title,
            company: company.name as string,
            location: d.full_location ?? d.short_location ?? "",
            country: d.country_code ? d.country_code.toUpperCase() : null,
            url: d.apply_url,
            source: SOURCE,
            postedDate: d.posted_date ?? d.create_date ?? null,
          });
        }
        if (page * PAGE_SIZE >= data.totalCount) break;
        page += 1;
      }
    } catch (err) {
      errors.push(`${company.name}: ${(err as Error).message}`);
    }
  }

  const result: FetchResult = { source: SOURCE, jobs };
  if (errors.length) result.error = errors.join("; ");
  return result;
};

export default icims;
