import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";
import { loadCompanies } from "../config/load.ts";

const SOURCE = "smartrecruiters";
const PAGE_SIZE = 100;

interface SmartRecruitersPosting {
  id: string;
  name: string;
  company: { identifier: string };
  releasedDate?: string;
  location?: { fullLocation?: string; country?: string };
}

const smartrecruiters: Fetcher = async () => {
  const companies = loadCompanies(SOURCE);
  const jobs: RawJob[] = [];
  const errors: string[] = [];

  for (const company of companies) {
    const companyIdentifier = company.companyIdentifier as string | undefined;
    if (!companyIdentifier) continue;
    try {
      let offset = 0;
      for (;;) {
        const url = new URL(`https://api.smartrecruiters.com/v1/companies/${companyIdentifier}/postings`);
        url.searchParams.set("limit", String(PAGE_SIZE));
        url.searchParams.set("offset", String(offset));
        const res = await fetch(url);
        if (!res.ok) {
          errors.push(`${company.name}: HTTP ${res.status}`);
          break;
        }
        const data = (await res.json()) as { totalFound: number; content: SmartRecruitersPosting[] };
        const postings = data.content ?? [];
        for (const job of postings) {
          jobs.push({
            externalId: job.id,
            title: job.name,
            company: company.name as string,
            location: job.location?.fullLocation ?? "",
            country: job.location?.country ? job.location.country.toUpperCase() : null,
            // The list endpoint has no posting URL; the detail endpoint does
            // but costs one extra request per job. This unslugged form 200s
            // directly (verified live), so it's built instead of fetched.
            url: `https://jobs.smartrecruiters.com/${job.company.identifier}/${job.id}`,
            source: SOURCE,
            postedDate: job.releasedDate ?? null,
          });
        }
        offset += PAGE_SIZE;
        if (postings.length === 0 || offset >= data.totalFound) break;
      }
    } catch (err) {
      errors.push(`${company.name}: ${(err as Error).message}`);
    }
  }

  const result: FetchResult = { source: SOURCE, jobs };
  if (errors.length) result.error = errors.join("; ");
  return result;
};

export default smartrecruiters;
