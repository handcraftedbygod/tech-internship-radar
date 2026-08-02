import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";

const SOURCE = "eures";
const SEARCH_URL = "https://europa.eu/eures/api/jv-searchengine/public/jv-search/search";
const PAGE_SIZE = 50;

// EURES has no documented public API -- this is the endpoint the EU's own
// eures.europa.eu portal calls client-side (reverse-engineered, unauthenticated,
// no rate-limit guarantee). Content is EU/ELA-owned and openly reusable with
// attribution, so the legal footing is fine; the endpoint itself could change
// without notice, same risk class as scraping any site's own XHR calls.

// The raw title-only search is AND-per-entry but each entry is a plain
// substring match, not word-boundary -- "junior" alone over the EU in the
// last week is ~15,000 records, most senior/non-tech. Crossing a small tech
// axis with a role-tier axis (verified live) narrows that to ~1,700 records
// across ~40 requests/run, small enough for our own word-boundary filter in
// pipeline/filter.ts to do the real precision work, same division of labor
// as adzuna/arbeitnow/remotive already use.
const TECH_TERMS = ["software", "developer", "data", "cloud", "devops", "cybersecurity"];
const ROLE_TERMS = ["junior", "intern", "trainee", "graduate", "werkstudent", "praktikum", "stagiaire"];

// EURES only gives country + NUTS region codes per job, not a city name --
// mapped to English names so hubFor()/matchesLocation() in the web app and
// pipeline/filter.ts (which match on alias text like "germany") still bucket
// these correctly. Only the countries our own hub list tracks are worth
// naming: anything else fails to match a hub anyway and gets filtered out
// downstream, same outcome either way.
const COUNTRY_NAMES: Record<string, string> = {
  DE: "Germany",
  NL: "Netherlands",
  IE: "Ireland",
  FR: "France",
  SE: "Sweden",
  FI: "Finland",
  PL: "Poland",
  ES: "Spain",
  PT: "Portugal",
  CH: "Switzerland",
  EE: "Estonia",
};

interface EuresJob {
  id: string;
  title: string;
  creationDate: number;
  locationMap: Record<string, (string | null)[]>;
  employer?: { name?: string };
}

interface EuresSearchResponse {
  numberRecords: number;
  jvs: EuresJob[];
}

function searchBody(tech: string, role: string, page: number) {
  return {
    resultsPerPage: PAGE_SIZE,
    page,
    sortSearch: "MOST_RECENT",
    keywords: [
      { keyword: tech, specificSearchCode: "TITLE" },
      { keyword: role, specificSearchCode: "TITLE" },
    ],
    publicationPeriod: "LAST_WEEK",
    occupationUris: [],
    skillUris: [],
    requiredExperienceCodes: [],
    positionScheduleCodes: [],
    sectorCodes: [],
    educationAndQualificationLevelCodes: [],
    positionOfferingCodes: [],
    locationCodes: [],
    euresFlagCodes: [],
    otherBenefitsCodes: [],
    requiredLanguages: [],
    minNumberPost: null,
    sessionId: "tech-internship-radar",
    userPreferredLanguage: null,
    requestLanguage: "en",
  };
}

const eures: Fetcher = async () => {
  const jobs: RawJob[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];

  for (const tech of TECH_TERMS) {
    for (const role of ROLE_TERMS) {
      try {
        let page = 1;
        for (;;) {
          const res = await fetch(SEARCH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(searchBody(tech, role, page)),
          });
          if (!res.ok) {
            errors.push(`${tech}+${role}: HTTP ${res.status}`);
            break;
          }
          const data = (await res.json()) as EuresSearchResponse;
          const results = data.jvs ?? [];
          for (const job of results) {
            if (seen.has(job.id)) continue;
            seen.add(job.id);
            // A large share of EURES listings come through with no employer
            // name at all (staffing-agency bulk postings, verified live --
            // one Dutch industrial-automation agency alone accounted for ~50
            // near-duplicate "Junior Software Engineer" titles). Unnamed
            // postings aren't useful in a company-centric UI, so they're
            // dropped here rather than shown as "Unknown".
            const company = job.employer?.name?.trim();
            if (!company) continue;
            // Some employers post with the company name baked into the title
            // itself (e.g. "Acme GmbH: Junior Consultant..."), redundant with
            // the adjacent company column in the UI -- strip it when present.
            const title = job.title.startsWith(`${company}:`)
              ? job.title.slice(company.length + 1).trim()
              : job.title;
            const countryCode = Object.keys(job.locationMap ?? {})[0];
            jobs.push({
              externalId: job.id,
              title,
              company,
              location: countryCode ? (COUNTRY_NAMES[countryCode] ?? countryCode) : "",
              country: countryCode ?? null,
              url: `https://europa.eu/eures/portal/jv-se/jv-details/${job.id}?lang=en`,
              source: SOURCE,
              postedDate: job.creationDate ? new Date(job.creationDate).toISOString() : null,
            });
          }
          if (results.length < PAGE_SIZE || page * PAGE_SIZE >= data.numberRecords) break;
          page += 1;
        }
      } catch (err) {
        errors.push(`${tech}+${role}: ${(err as Error).message}`);
      }
    }
  }

  const result: FetchResult = { source: SOURCE, jobs };
  if (errors.length) result.error = errors.join("; ");
  return result;
};

export default eures;
