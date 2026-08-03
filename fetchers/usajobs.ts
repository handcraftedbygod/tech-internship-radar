import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";

const SOURCE = "usajobs";
const SEARCH_URL = "https://data.usajobs.gov/api/search";
const RESULTS_PER_PAGE = 250;
// Hard cap, not a measured limit -- unlike eures.ts this hasn't been run
// against a real key yet (data.usajobs.gov/api/search 401s without one), so
// this guards against an infinite loop if the real pagination field turns
// out to be named differently than assumed. Revisit once this has run live.
const MAX_PAGES = 5;

// GRADUATES/STUDENT verified live against the public, keyless
// data.usajobs.gov/api/codelist/hiringpaths endpoint -- these map onto our
// new-grad/internship categories respectively (Pathways Recent Graduates
// Program / Pathways Internship Program).
const TECH_TERMS = ["software", "developer", "data scientist", "cybersecurity", "IT specialist"];
const HIRING_PATHS = ["GRADUATES", "STUDENT"];

interface UsaJobsItem {
  MatchedObjectId: string;
  MatchedObjectDescriptor: {
    PositionTitle: string;
    OrganizationName?: string;
    PositionURI: string;
    PositionLocationDisplay?: string;
    PublicationStartDate?: string;
  };
}

interface UsaJobsResponse {
  SearchResult: {
    SearchResultItems: UsaJobsItem[];
    SearchResultCountAll: number;
  };
}

const usajobs: Fetcher = async () => {
  const apiKey = process.env.USAJOBS_API_KEY;
  const userAgent = process.env.USAJOBS_USER_AGENT;
  if (!apiKey || !userAgent) {
    return { source: SOURCE, jobs: [], error: "USAJOBS_API_KEY/USAJOBS_USER_AGENT not set, skipping" };
  }

  const jobs: RawJob[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];

  for (const tech of TECH_TERMS) {
    for (const path of HIRING_PATHS) {
      try {
        for (let page = 1; page <= MAX_PAGES; page++) {
          const url = new URL(SEARCH_URL);
          url.searchParams.set("Keyword", tech);
          url.searchParams.set("HiringPath", path);
          url.searchParams.set("ResultsPerPage", String(RESULTS_PER_PAGE));
          url.searchParams.set("Page", String(page));

          // Host header is per USAJOBS' own docs, not something ordinarily
          // needed with fetch() -- confirmed live that Node doesn't strip or
          // reject it (still gets a normal 401 without a key), but the full
          // authenticated shape is unverified until this runs with a real key.
          const res = await fetch(url, {
            headers: {
              "Authorization-Key": apiKey,
              "User-Agent": userAgent,
              Host: "data.usajobs.gov",
            },
          });
          if (!res.ok) {
            errors.push(`${tech}/${path}: HTTP ${res.status}`);
            break;
          }
          const data = (await res.json()) as UsaJobsResponse;
          const items = data.SearchResult?.SearchResultItems ?? [];
          for (const item of items) {
            if (seen.has(item.MatchedObjectId)) continue;
            seen.add(item.MatchedObjectId);
            const d = item.MatchedObjectDescriptor;
            jobs.push({
              externalId: item.MatchedObjectId,
              title: d.PositionTitle,
              company: d.OrganizationName ?? "U.S. Federal Government",
              location: d.PositionLocationDisplay ?? "",
              country: null,
              url: d.PositionURI,
              source: SOURCE,
              postedDate: d.PublicationStartDate ?? null,
            });
          }
          if (items.length < RESULTS_PER_PAGE) break;
        }
      } catch (err) {
        errors.push(`${tech}/${path}: ${(err as Error).message}`);
      }
    }
  }

  const result: FetchResult = { source: SOURCE, jobs };
  if (errors.length) result.error = errors.join("; ");
  return result;
};

export default usajobs;
