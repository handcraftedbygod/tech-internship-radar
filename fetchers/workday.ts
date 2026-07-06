import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";
import { loadCompanies } from "../config/load.ts";

const SOURCE = "workday";
const PAGE_SIZE = 20;

interface WorkdayPosting {
  title: string;
  externalPath: string;
  postedOn?: string;
  locationsText?: string;
  bulletFields?: string[];
}

const workday: Fetcher = async () => {
  const companies = loadCompanies(SOURCE);
  const jobs: RawJob[] = [];
  const errors: string[] = [];

  for (const company of companies) {
    const endpointUrl = company.endpointUrl as string | undefined;
    if (!endpointUrl) continue;
    try {
      let offset = 0;
      for (;;) {
        const res = await fetch(endpointUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appliedFacets: {}, limit: PAGE_SIZE, offset, searchText: "" }),
        });
        if (!res.ok) {
          errors.push(`${company.name}: HTTP ${res.status}`);
          break;
        }
        const data = (await res.json()) as { jobPostings: WorkdayPosting[] };
        const postings = data.jobPostings ?? [];
        if (postings.length === 0) break;

        const origin = new URL(endpointUrl).origin;
        for (const job of postings) {
          jobs.push({
            externalId: job.externalPath,
            title: job.title,
            company: company.name as string,
            location: job.locationsText ?? "",
            country: null,
            url: origin + job.externalPath,
            source: SOURCE,
            postedDate: job.postedOn ?? null,
          });
        }
        if (postings.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
    } catch (err) {
      errors.push(`${company.name}: ${(err as Error).message}`);
    }
  }

  const result: FetchResult = { source: SOURCE, jobs };
  if (errors.length) result.error = errors.join("; ");
  return result;
};

export default workday;
