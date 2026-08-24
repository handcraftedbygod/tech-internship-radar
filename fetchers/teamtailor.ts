import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";
import { loadCompanies } from "../config/load.ts";

const SOURCE = "teamtailor";

interface TeamtailorItem {
  id: string;
  title: string;
  url: string;
  date_published?: string;
  _jobposting?: {
    jobLocation?: Array<{
      address?: { addressLocality?: string; addressCountry?: string };
    }>;
  };
}

// Every Teamtailor career site auto-publishes a standard JSON Feed
// (jsonfeed.org) at /jobs.json, no auth required.
const teamtailor: Fetcher = async () => {
  const companies = loadCompanies(SOURCE);
  const jobs: RawJob[] = [];
  const errors: string[] = [];

  for (const company of companies) {
    const careerSiteUrl = company.careerSiteUrl as string | undefined;
    if (!careerSiteUrl) continue;
    try {
      const res = await fetch(`${careerSiteUrl}/jobs.json`);
      if (!res.ok) {
        errors.push(`${company.name}: HTTP ${res.status}`);
        continue;
      }
      const data = (await res.json()) as { items: TeamtailorItem[] };
      for (const item of data.items ?? []) {
        const address = item._jobposting?.jobLocation?.[0]?.address;
        jobs.push({
          externalId: item.id,
          title: item.title,
          company: company.name as string,
          location: address?.addressLocality ?? "",
          country: address?.addressCountry ?? null,
          url: item.url,
          source: SOURCE,
          postedDate: item.date_published ?? null,
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

export default teamtailor;
