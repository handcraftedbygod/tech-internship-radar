import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";
import { loadCompanies } from "../config/load.ts";

const SOURCE = "deel";

export interface DeelPosting {
  jobId: string;
  title: string;
  location: string;
  createdAt: string | null;
}

// Deel's job-board pages (jobs.deel.com/<slug>) have no public JSON API --
// the job list is server-rendered into a Next.js RSC flight payload inlined
// in the HTML (self.__next_f.push(...)), double-escaped (each `"` appears as
// `\"`). Ceiling: breaks if Deel reorders/renames these fields; upgrade path
// is a real API if Deel ever publishes one.
const POSTING_RE =
  /\\"jobId\\":\\"([0-9a-f-]{36})\\",\\"title\\":\\"((?:[^"\\]|\\.)*?)\\".{0,900}?\\"jobLocations\\":\[\{[^}]*\\"location\\":\{[^}]*\\"name\\":\\"((?:[^"\\]|\\.)*?)\\"/gs;
const CREATED_AT_RE = /\\"createdAt\\":\\"([^"\\]+)\\"/;

export function extractPostings(html: string): DeelPosting[] {
  const seen = new Set<string>();
  const postings: DeelPosting[] = [];
  for (const match of html.matchAll(POSTING_RE)) {
    const [whole, jobId, title, location] = match;
    if (seen.has(jobId)) continue;
    seen.add(jobId);
    postings.push({
      jobId,
      title: title.replace(/\\"/g, '"'),
      location: location.replace(/\\"/g, '"'),
      createdAt: CREATED_AT_RE.exec(whole)?.[1] ?? null,
    });
  }
  return postings;
}

const deel: Fetcher = async () => {
  const companies = loadCompanies(SOURCE);
  const jobs: RawJob[] = [];
  const errors: string[] = [];

  for (const company of companies) {
    const slug = company.slug as string | undefined;
    if (!slug) continue;
    try {
      const res = await fetch(`https://jobs.deel.com/${slug}`);
      if (!res.ok) {
        errors.push(`${company.name}: HTTP ${res.status}`);
        continue;
      }
      const html = await res.text();
      for (const posting of extractPostings(html)) {
        jobs.push({
          externalId: posting.jobId,
          title: posting.title,
          company: company.name as string,
          location: posting.location,
          country: null,
          url: `https://jobs.deel.com/${slug}/job-details/${posting.jobId}/overview`,
          source: SOURCE,
          postedDate: posting.createdAt,
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

export default deel;
