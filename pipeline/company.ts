import { tierForCompany, type CompanyTier } from "../config/load.ts";

// City-specific tokens, mirroring web/app.js's HUBS -- deliberately NOT the
// same as config/locations.json's `aliases`, which include broad country-wide
// terms (e.g. Berlin's "Germany") for filter.ts's looser location-gating
// purpose. Reusing those here would mis-bucket e.g. Madrid postings into
// Barcelona via its "Spain" alias. Browser JS can't import this module, so
// this list stays hand-kept in sync with app.js -- same tradeoff as
// tierForCompany() between config/load.ts and app.js.
const HUB_TOKENS = [
  { name: "Tallinn", match: ["tallinn"] },
  { name: "Berlin", match: ["berlin"] },
  { name: "Munich", match: ["munich", "münchen", "munchen"] },
  { name: "Amsterdam", match: ["amsterdam"] },
  { name: "Dublin", match: ["dublin"] },
  { name: "London", match: ["london"] },
  { name: "Paris", match: ["paris"] },
  { name: "Stockholm", match: ["stockholm"] },
  { name: "Helsinki", match: ["helsinki"] },
  { name: "Warsaw", match: ["warsaw", "warszawa"] },
  { name: "Barcelona", match: ["barcelona"] },
  { name: "Lisbon", match: ["lisbon", "lisboa"] },
  { name: "Zurich", match: ["zurich", "zürich"] },
  { name: "Madrid", match: ["madrid"] },
  { name: "Stuttgart", match: ["stuttgart"] },
  { name: "Frankfurt", match: ["frankfurt"] },
  { name: "Hannover", match: ["hannover", "hanover"] },
  { name: "Karlsruhe", match: ["karlsruhe"] },
  { name: "Bremen", match: ["bremen"] },
  { name: "Düsseldorf", match: ["düsseldorf", "dusseldorf"] },
  { name: "Reutlingen", match: ["reutlingen"] },
  { name: "Krakow", match: ["krakow", "kraków"] },
  { name: "Katowice", match: ["katowice"] },
  { name: "Lodz", match: ["lodz", "łódź"] },
  { name: "New York", match: ["new york", "nyc"] },
  { name: "San Francisco", match: ["san francisco", "bay area", "san jose", "silicon valley", "san mateo", "palo alto"] },
  { name: "Seattle", match: ["seattle"] },
  { name: "Austin", match: ["austin"] },
  { name: "Boston", match: ["boston"] },
  { name: "Los Angeles", match: ["los angeles"] },
  { name: "Chicago", match: ["chicago"] },
  { name: "Toronto", match: ["toronto"] },
  { name: "Vancouver", match: ["vancouver"] },
  { name: "Montreal", match: ["montreal", "montréal"] },
];
const OTHER_HUB = "Other";

export function hubFor(location: string): string {
  const text = location.toLowerCase();
  const hit = HUB_TOKENS.find((hub) => hub.match.some((token) => text.includes(token)));
  return hit ? hit.name : OTHER_HUB;
}

// Keyword classification, mirroring web/app.js's CATEGORY_PRESETS. Order
// matters: more specific buckets (quant, hw) are checked before the broad
// software/data catch-alls.
const DISCIPLINE_PRESETS = [
  { id: "quant", label: "Quant", keywords: ["quant", "quantitative"] },
  { id: "hw", label: "Hardware", keywords: ["hardware", "embedded", "firmware", "electrical engineer", "mechanical engineer"] },
  { id: "ai", label: "Data / AI", keywords: ["data science", "data scientist", "machine learning", "ml engineer", "ai ", "artificial intelligence", "nlp", "computer vision", "data engineer", "data analytics", "analytics"] },
  { id: "product", label: "Product", keywords: ["product manager", "product management", "product engineer", "apm"] },
  { id: "design", label: "Design", keywords: ["design", "ux", "ui "] },
  { id: "biz", label: "Business", keywords: ["marketing", "sales", "business", "growth", "operations", "finance", "hr ", "recruit", "legal", "audit", "tax"] },
  { id: "swe", label: "Software", keywords: ["software", "engineer", "developer", "backend", "frontend", "full stack", "devops", "sre", "platform", "infrastructure"] },
];

export function disciplineFor(title: string): { id: string; label: string } {
  const text = title.toLowerCase();
  for (const preset of DISCIPLINE_PRESETS) {
    if (preset.keywords.some((kw) => text.includes(kw))) return { id: preset.id, label: preset.label };
  }
  return { id: "swe", label: "Software" };
}

// Legal-form suffixes stripped from free-text company strings (aggregator
// sources report these inconsistently, e.g. "Acme GmbH" vs "Acme"). Not
// exhaustive -- extend as real noise is observed.
const LEGAL_SUFFIXES = [
  "incorporated", "corporation", "limited", "group", "gmbh", "gmbh & co kg",
  "inc", "llc", "ltd", "corp", "plc", "co", "ag", "se", "nv", "bv", "ab", "oy", "spa", "srl",
];
const SUFFIX_PATTERN = new RegExp(`\\s+(${LEGAL_SUFFIXES.join("|")})$`, "i");

// Deterministic id for grouping postings by company across slightly different
// raw name strings. Not stored on the job row -- recomputed at export time so
// an alias-table edit takes effect for all historical rows immediately.
export function companySlug(rawName: string, aliases: Record<string, string> = {}): string {
  const cleaned = rawName.trim().toLowerCase().replace(/[.,]/g, "");
  let stripped = cleaned;
  while (SUFFIX_PATTERN.test(stripped)) {
    stripped = stripped.replace(SUFFIX_PATTERN, "").trim();
  }
  const canonical = (aliases[stripped] ?? stripped).toLowerCase();
  return canonical.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export interface CompanyJobRow {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  first_seen_at: string;
  closed_at: string | null;
}

export interface CompanySummary {
  slug: string;
  name: string;
  tier: string | null;
  currentOpenings: number;
  firstTrackedAt: string;
  totalPostings: number;
  avgPostingDurationDays: number | null;
  topLocations: { hub: string; count: number }[];
  topDisciplines: { id: string; label: string; count: number }[];
  hiringMonths: number[];
  recentPostings: { id: string; title: string; url: string; location: string; firstSeenAt: string }[];
}

// Groups the full job history by companySlug() and computes per-company stats
// in plain JS over one already-fetched row set -- matches how export.ts
// already does everything downstream of a single SELECT *, no SQL aggregation
// needed at this dataset size.
export function buildCompanySummaries(
  rows: CompanyJobRow[],
  tiers: CompanyTier[],
  aliases: Record<string, string>,
): CompanySummary[] {
  const groups = new Map<string, CompanyJobRow[]>();
  for (const row of rows) {
    const slug = companySlug(row.company, aliases);
    const group = groups.get(slug);
    if (group) group.push(row);
    else groups.set(slug, [row]);
  }

  const summaries: CompanySummary[] = [];
  for (const [slug, group] of groups) {
    // Most frequent raw company string wins as the display name; ties break
    // alphabetically so the choice is deterministic.
    const nameCounts = new Map<string, number>();
    for (const row of group) nameCounts.set(row.company, (nameCounts.get(row.company) ?? 0) + 1);
    const name = [...nameCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];

    const tier = tierForCompany(name, tiers);
    const currentOpenings = group.filter((r) => r.closed_at === null).length;
    const firstTrackedAt = group.reduce(
      (min, r) => (r.first_seen_at < min ? r.first_seen_at : min),
      group[0].first_seen_at,
    );

    const closedDurationsDays = group
      .filter((r): r is CompanyJobRow & { closed_at: string } => r.closed_at !== null)
      .map((r) => (new Date(r.closed_at).getTime() - new Date(r.first_seen_at).getTime()) / 86_400_000);
    const avgPostingDurationDays = closedDurationsDays.length
      ? Math.round((closedDurationsDays.reduce((a, b) => a + b, 0) / closedDurationsDays.length) * 10) / 10
      : null;

    const locationCounts = new Map<string, number>();
    for (const row of group) {
      const hub = hubFor(row.location);
      locationCounts.set(hub, (locationCounts.get(hub) ?? 0) + 1);
    }
    const topLocations = [...locationCounts.entries()]
      .map(([hub, count]) => ({ hub, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const disciplineCounts = new Map<string, { label: string; count: number }>();
    for (const row of group) {
      const d = disciplineFor(row.title);
      const existing = disciplineCounts.get(d.id);
      disciplineCounts.set(d.id, { label: d.label, count: (existing?.count ?? 0) + 1 });
    }
    const topDisciplines = [...disciplineCounts.entries()]
      .map(([id, v]) => ({ id, label: v.label, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const hiringMonths = new Array(12).fill(0);
    for (const row of group) {
      hiringMonths[new Date(row.first_seen_at).getUTCMonth()]++;
    }

    const recentPostings = group
      .slice()
      .sort((a, b) => (a.first_seen_at < b.first_seen_at ? 1 : -1))
      .slice(0, 10)
      .map((r) => ({ id: r.id, title: r.title, url: r.url, location: r.location, firstSeenAt: r.first_seen_at }));

    summaries.push({
      slug,
      name,
      tier: tier ? tier.id : null,
      currentOpenings,
      firstTrackedAt,
      totalPostings: group.length,
      avgPostingDurationDays,
      topLocations,
      topDisciplines,
      hiringMonths,
      recentPostings,
    });
  }

  return summaries;
}
