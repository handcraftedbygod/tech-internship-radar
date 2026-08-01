const HIRING_URL = "https://yc-oss.github.io/api/companies/hiring.json";

// Cap keeps the box short (mirrors CLOSED_LIMIT in export.ts) -- newest-launched
// first, since those are the startups still actively growing their first teams.
const LIMIT = 30;

export interface YcCompany {
  name: string;
  oneLiner: string;
  batch: string;
  location: string;
  url: string;
}

interface RawYcCompany {
  name: string;
  one_liner: string;
  batch: string;
  all_locations: string;
  url: string;
  launched_at: number;
  status: string;
  regions: string[];
}

// yc-oss/api mirrors YC's own Algolia search index (unofficial, no per-role
// job data -- just a company-level "isHiring" flag), refreshed daily via its
// own GitHub Action. Not a Fetcher/RawJob: there's no individual posting to
// dedupe or store, so this bypasses filter/dedupe/store.ts entirely and is
// written straight to its own web/data/yc.json.
export async function fetchYcHiring(): Promise<{ companies: YcCompany[]; error?: string }> {
  try {
    const res = await fetch(HIRING_URL);
    if (!res.ok) return { companies: [], error: `HTTP ${res.status}` };
    const data = (await res.json()) as RawYcCompany[];
    const companies = data
      .filter((c) => c.status === "Active" && c.regions?.includes("Europe"))
      .sort((a, b) => b.launched_at - a.launched_at)
      .slice(0, LIMIT)
      .map((c) => ({
        name: c.name,
        oneLiner: c.one_liner,
        batch: c.batch,
        location: c.all_locations,
        url: c.url,
      }));
    return { companies };
  } catch (err) {
    return { companies: [], error: (err as Error).message };
  }
}
