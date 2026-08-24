import type { RawJob } from "../types/job.ts";
import type { FetchResult, Fetcher } from "./types.ts";
import { loadCompanies } from "../config/load.ts";

const SOURCE = "rippling";

interface AlgoliaHit {
  jobId: string;
  name: string;
  url: string;
  locationNames?: string[];
  locations?: Array<{ countryCode?: string }>;
}

interface AlgoliaResponse {
  results: Array<{ hits: AlgoliaHit[] }>;
}

// rippling.com/careers/open-roles queries Algolia directly from the browser
// with a public search-only API key (safe to reuse -- same key their own
// frontend ships). One job is indexed once per office location, so hits are
// grouped by jobId below. Field names (name/locationNames/...) are specific
// to Rippling's index schema -- ponytail: hardcoded for one company for now,
// a second Algolia-backed company would need its own field mapping.
const rippling: Fetcher = async () => {
  const companies = loadCompanies(SOURCE);
  const jobs: RawJob[] = [];
  const errors: string[] = [];

  for (const company of companies) {
    const appId = company.algoliaAppId as string | undefined;
    const apiKey = company.algoliaApiKey as string | undefined;
    const indexName = company.algoliaIndex as string | undefined;
    if (!appId || !apiKey || !indexName) continue;
    try {
      const res = await fetch(
        `https://${appId.toLowerCase()}-dsn.algolia.net/1/indexes/*/queries?x-algolia-agent=Algolia&x-algolia-api-key=${apiKey}&x-algolia-application-id=${appId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requests: [{ indexName, query: "", hitsPerPage: 1000 }] }),
        },
      );
      if (!res.ok) {
        errors.push(`${company.name}: HTTP ${res.status}`);
        continue;
      }
      const data = (await res.json()) as AlgoliaResponse;
      const hits = data.results[0]?.hits ?? [];

      const byJobId = new Map<string, { hit: AlgoliaHit; locations: Set<string> }>();
      for (const hit of hits) {
        const entry = byJobId.get(hit.jobId) ?? { hit, locations: new Set<string>() };
        for (const name of hit.locationNames ?? []) entry.locations.add(name);
        byJobId.set(hit.jobId, entry);
      }

      for (const [jobId, { hit, locations }] of byJobId) {
        jobs.push({
          externalId: jobId,
          title: hit.name.trim(),
          company: company.name as string,
          location: [...locations].join(", "),
          country: hit.locations?.[0]?.countryCode ?? null,
          url: hit.url,
          source: SOURCE,
          postedDate: null,
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

export default rippling;
