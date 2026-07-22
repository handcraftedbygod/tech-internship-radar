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

// Workday's public job URL needs the career-site name between the domain and
// "/job/..." (e.g. "/External_Career_Site/job/..."), not just origin +
// externalPath -- that 404s. The site name is the endpoint's second-to-last
// path segment: .../wday/cxs/{tenant}/{siteName}/jobs.
export function siteUrl(endpointUrl: string, externalPath: string): string {
  const url = new URL(endpointUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  const siteName = segments.at(-2);
  return `${url.origin}/${siteName}${externalPath}`;
}

// postedOn is human text ("Posted Today", "Posted 6 Days Ago", "Posted 30+
// Days Ago"), not a date -- passing it straight through as postedDate made
// `new Date(...)` downstream produce NaN ("NaNd ago" in the UI).
export function parsePostedOn(postedOn: string | undefined): string | null {
  if (!postedOn) return null;
  const text = postedOn.toLowerCase();
  if (text.includes("today")) return new Date().toISOString();
  if (text.includes("yesterday")) return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const match = text.match(/(\d+)\+?\s*days?\s*ago/);
  if (!match) return null;
  return new Date(Date.now() - Number(match[1]) * 24 * 60 * 60 * 1000).toISOString();
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

        for (const job of postings) {
          jobs.push({
            externalId: job.externalPath,
            title: job.title,
            company: company.name as string,
            location: job.locationsText ?? "",
            country: null,
            url: siteUrl(endpointUrl, job.externalPath),
            source: SOURCE,
            postedDate: parsePostedOn(job.postedOn),
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
