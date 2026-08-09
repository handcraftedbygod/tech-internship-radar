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

function pickRegion(data: RawYcCompany[], region: string): YcCompany[] {
  return data
    .filter((c) => c.status === "Active" && c.regions?.includes(region))
    .sort((a, b) => b.launched_at - a.launched_at)
    .slice(0, LIMIT)
    .map((c) => ({
      name: c.name,
      oneLiner: c.one_liner,
      batch: c.batch,
      location: c.all_locations,
      url: c.url,
    }));
}

// yc-oss/api mirrors YC's own Algolia search index (unofficial, no per-role
// job data -- just a company-level "isHiring" flag), refreshed daily via its
// own GitHub Action. Not a Fetcher/RawJob: there's no individual posting to
// dedupe or store, so this bypasses filter/dedupe/store.ts entirely and is
// written straight to its own web/data/yc.json.
export async function fetchYcHiring(): Promise<{
  europe: YcCompany[];
  northAmerica: YcCompany[];
  error?: string;
}> {
  try {
    const res = await fetch(HIRING_URL);
    if (!res.ok) return { europe: [], northAmerica: [], error: `HTTP ${res.status}` };
    const data = (await res.json()) as RawYcCompany[];
    return {
      europe: pickRegion(data, "Europe"),
      // The API's own region taxonomy uses "America / Canada", not "North
      // America" (verified live against yc-oss/api's region value set).
      northAmerica: pickRegion(data, "America / Canada"),
    };
  } catch (err) {
    return { europe: [], northAmerica: [], error: (err as Error).message };
  }
}
