import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";
import { loadCompanies } from "../config/load.ts";

const SOURCE = "glovo";

export interface GlovoJob {
  id: string;
  title: string;
  location: string;
  url: string;
}

// Glovo's WordPress theme renders each job card server-side and returns them
// as an HTML fragment (not JSON) from wp-admin/admin-ajax.php, 12 per page.
// No public HTML parser is installed in this repo, so this is a small
// targeted regex over the known card markup rather than a full DOM parse.
const CARD_RE =
  /data-job-card="(\d+)"[\s\S]*?class="job-title">([^<]*)<\/h4>[\s\S]*?class="job-address">[\s\S]*?<span>([^<]*)<\/span>[\s\S]*?href="([^"]*)">Apply<\/a>/g;

export function extractJobs(html: string): GlovoJob[] {
  return [...html.matchAll(CARD_RE)].map(([, id, title, location, url]) => ({
    id,
    title: title.trim(),
    location,
    url,
  }));
}

const glovo: Fetcher = async () => {
  const companies = loadCompanies(SOURCE);
  const jobs: RawJob[] = [];
  const errors: string[] = [];

  for (const company of companies) {
    const ajaxUrl = company.ajaxUrl as string | undefined;
    if (!ajaxUrl) continue;
    try {
      const seen = new Set<string>();
      let page = 1;
      for (;;) {
        const res = await fetch(ajaxUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `action=glovo_filter_jobs&page=${page}`,
        });
        if (!res.ok) {
          errors.push(`${company.name}: HTTP ${res.status}`);
          break;
        }
        const data = (await res.json()) as { success: boolean; data?: { html: string; total: number } };
        const pageJobs = data.data?.html ? extractJobs(data.data.html) : [];
        if (pageJobs.length === 0) break;

        for (const job of pageJobs) {
          if (seen.has(job.id)) continue;
          seen.add(job.id);
          jobs.push({
            externalId: job.id,
            title: job.title,
            company: company.name as string,
            location: job.location,
            country: null,
            url: job.url,
            source: SOURCE,
            postedDate: null,
          });
        }
        if (seen.size >= (data.data?.total ?? 0)) break;
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

export default glovo;
