import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";
import { loadCompanies } from "../config/load.ts";

const SOURCE = "recruitee";

interface RecruiteeOffer {
  id: number;
  title: string;
  location: string;
  country_code?: string;
  careers_url: string;
  published_at?: string;
  created_at?: string;
}

// The public offers endpoint returns every open posting in one response --
// verified live (12 and 19 offers respectively for two real boards), no
// pagination params exist or are needed.
const recruitee: Fetcher = async () => {
  const companies = loadCompanies(SOURCE);
  const jobs: RawJob[] = [];
  const errors: string[] = [];

  for (const company of companies) {
    const subdomain = company.subdomain as string | undefined;
    if (!subdomain) continue;
    try {
      const res = await fetch(`https://${subdomain}.recruitee.com/api/offers/`);
      if (!res.ok) {
        errors.push(`${company.name}: HTTP ${res.status}`);
        continue;
      }
      const data = (await res.json()) as { offers: RecruiteeOffer[] };
      for (const job of data.offers ?? []) {
        jobs.push({
          externalId: String(job.id),
          title: job.title,
          company: company.name as string,
          location: job.location ?? "",
          country: job.country_code ? job.country_code.toUpperCase() : null,
          url: job.careers_url,
          source: SOURCE,
          postedDate: job.published_at ?? job.created_at ?? null,
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

export default recruitee;
