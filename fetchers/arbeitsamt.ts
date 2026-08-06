import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";

const SOURCE = "arbeitsamt";
const SEARCH_URL = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs";
const PAGE_SIZE = 100;

// Publicly documented static key for the Bundesagentur für Arbeit's own
// jobsuche.arbeitsagentur.de search page -- not a per-user secret, so no
// signup/env var needed, same footing as eures.ts's unauthenticated endpoint.
const API_KEY = "jobboerse-jobsuche";

// angebotsart=34 scopes server-side to Praktikum/Trainee postings (bundles
// both -- a Trainee-only title still gets sorted by the category keyword
// match in pipeline/filter.ts same as any other source).
const ANGEBOTSART_PRAKTIKUM_TRAINEE = "34";
const TECH_TERMS = ["software", "developer", "data", "informatik", "cloud", "devops"];

interface ArbeitsamtJob {
  referenznummer: string;
  stellenangebotsTitel: string;
  firma?: string;
  externeURL?: string;
  datumErsteVeroeffentlichung?: string;
  stellenlokationen?: { adresse?: { ort?: string } }[];
}

interface ArbeitsamtResponse {
  maxErgebnisse: number;
  ergebnisliste: ArbeitsamtJob[];
}

const arbeitsamt: Fetcher = async () => {
  const jobs: RawJob[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];

  for (const was of TECH_TERMS) {
    try {
      let page = 1;
      for (;;) {
        const url = new URL(SEARCH_URL);
        url.searchParams.set("was", was);
        url.searchParams.set("angebotsart", ANGEBOTSART_PRAKTIKUM_TRAINEE);
        url.searchParams.set("page", String(page));
        url.searchParams.set("size", String(PAGE_SIZE));

        const res = await fetch(url, { headers: { "X-API-Key": API_KEY } });
        if (!res.ok) {
          errors.push(`${was}: HTTP ${res.status}`);
          break;
        }
        const data = (await res.json()) as ArbeitsamtResponse;
        const results = data.ergebnisliste ?? [];
        for (const job of results) {
          if (seen.has(job.referenznummer)) continue;
          seen.add(job.referenznummer);
          const city = job.stellenlokationen?.[0]?.adresse?.ort;
          jobs.push({
            externalId: job.referenznummer,
            title: job.stellenangebotsTitel,
            company: job.firma ?? "Unknown",
            location: city ?? "Germany",
            country: "DE",
            url: job.externeURL ?? `https://www.arbeitsagentur.de/jobsuche/jobdetail/${job.referenznummer}`,
            source: SOURCE,
            postedDate: job.datumErsteVeroeffentlichung ?? null,
          });
        }
        if (results.length < PAGE_SIZE || page * PAGE_SIZE >= data.maxErgebnisse) break;
        page += 1;
      }
    } catch (err) {
      errors.push(`${was}: ${(err as Error).message}`);
    }
  }

  const result: FetchResult = { source: SOURCE, jobs };
  if (errors.length) result.error = errors.join("; ");
  return result;
};

export default arbeitsamt;
