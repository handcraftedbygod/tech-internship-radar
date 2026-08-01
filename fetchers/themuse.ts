import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";

const SOURCE = "themuse";

interface MuseJob {
  id: number;
  name: string;
  company?: { name: string };
  locations?: { name: string }[];
  publication_date?: string;
  refs: { landing_page: string };
}

const themuse: Fetcher = async () => {
  const jobs: RawJob[] = [];
  let error: string | undefined;

  try {
    let page = 0;
    for (;;) {
      const url = new URL("https://www.themuse.com/api/public/jobs");
      url.searchParams.set("page", String(page));
      url.searchParams.set("level", "Internship");
      // Unfiltered "level=Internship" alone spans ~7700 all-industry results
      // across ~390 pages (verified live); scoping to this category keeps it
      // to ~35 while still catching the tech-relevant slice.
      url.searchParams.set("category", "Software Engineering");
      const res = await fetch(url);
      if (!res.ok) {
        error = `HTTP ${res.status}`;
        break;
      }
      const data = (await res.json()) as { page_count: number; results: MuseJob[] };
      for (const job of data.results ?? []) {
        jobs.push({
          externalId: String(job.id),
          title: job.name,
          company: job.company?.name ?? "Unknown",
          location: (job.locations ?? []).map((l) => l.name).join(", "),
          country: null,
          url: job.refs.landing_page,
          source: SOURCE,
          postedDate: job.publication_date ?? null,
        });
      }
      page += 1;
      if (page >= data.page_count) break;
    }
  } catch (err) {
    error = (err as Error).message;
  }

  const result: FetchResult = { source: SOURCE, jobs };
  if (error) result.error = error;
  return result;
};

export default themuse;
