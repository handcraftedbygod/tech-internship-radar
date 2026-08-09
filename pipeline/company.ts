import { tierForCompany, type CompanyTier } from "../config/load.ts";

// City-specific tokens, mirroring web/app.js's HUBS -- deliberately NOT the
// same as config/locations.json's `aliases`, which include broad country-wide
// terms (e.g. Berlin's "Germany") for filter.ts's looser location-gating
// purpose. Reusing those here would mis-bucket e.g. Madrid postings into
// Barcelona via its "Spain" alias. Browser JS can't import this module, so
// this list stays hand-kept in sync with app.js -- same tradeoff as
// tierForCompany() between config/load.ts and app.js.
const HUB_TOKENS: { name: string; region: "eu" | "na"; match: string[] }[] = [
  { name: "Tallinn", region: "eu", match: ["tallinn"] },
  { name: "Berlin", region: "eu", match: ["berlin"] },
  { name: "Munich", region: "eu", match: ["munich", "münchen", "munchen"] },
  { name: "Amsterdam", region: "eu", match: ["amsterdam"] },
  { name: "Dublin", region: "eu", match: ["dublin"] },
  { name: "London", region: "eu", match: ["london"] },
  { name: "Paris", region: "eu", match: ["paris"] },
  { name: "Stockholm", region: "eu", match: ["stockholm"] },
  { name: "Helsinki", region: "eu", match: ["helsinki"] },
  { name: "Warsaw", region: "eu", match: ["warsaw", "warszawa"] },
  { name: "Barcelona", region: "eu", match: ["barcelona"] },
  { name: "Lisbon", region: "eu", match: ["lisbon", "lisboa"] },
  { name: "Zurich", region: "eu", match: ["zurich", "zürich"] },
  { name: "Madrid", region: "eu", match: ["madrid"] },
  { name: "Stuttgart", region: "eu", match: ["stuttgart"] },
  { name: "Frankfurt", region: "eu", match: ["frankfurt"] },
  { name: "Hannover", region: "eu", match: ["hannover", "hanover"] },
  { name: "Karlsruhe", region: "eu", match: ["karlsruhe"] },
  { name: "Bremen", region: "eu", match: ["bremen"] },
  { name: "Düsseldorf", region: "eu", match: ["düsseldorf", "dusseldorf"] },
  { name: "Reutlingen", region: "eu", match: ["reutlingen"] },
  { name: "Krakow", region: "eu", match: ["krakow", "kraków"] },
  { name: "Katowice", region: "eu", match: ["katowice"] },
  { name: "Lodz", region: "eu", match: ["lodz", "łódź"] },
  { name: "New York", region: "na", match: ["new york", "nyc"] },
  { name: "San Francisco", region: "na", match: ["san francisco", "bay area", "san jose", "silicon valley", "san mateo", "palo alto"] },
  { name: "Seattle", region: "na", match: ["seattle"] },
  { name: "Austin", region: "na", match: ["austin"] },
  { name: "Boston", region: "na", match: ["boston"] },
  { name: "Los Angeles", region: "na", match: ["los angeles"] },
  { name: "Chicago", region: "na", match: ["chicago"] },
  { name: "Toronto", region: "na", match: ["toronto"] },
  { name: "Vancouver", region: "na", match: ["vancouver"] },
  { name: "Montreal", region: "na", match: ["montreal", "montréal"] },
];
const OTHER_HUB = "Other";

const HUB_REGION: Record<string, "eu" | "na"> = HUB_TOKENS.reduce(
  (acc, hub) => ({ ...acc, [hub.name]: hub.region }),
  {},
);

export function hubFor(location: string): string {
  const text = location.toLowerCase();
  const hit = HUB_TOKENS.find((hub) => hub.match.some((token) => text.includes(token)));
  return hit ? hit.name : OTHER_HUB;
}

// Mirrors web/app.js's tierBadge() -- elite-tier names get the more specific
// "FAANG" word instead of the generic NOTABLE pill (trading and notable tiers
// both read as NOTABLE, same as the badge shown on the main table).
export function tierBadge(tierId: string | null): "FAANG" | "NOTABLE" | null {
  if (!tierId) return null;
  return tierId === "elite" ? "FAANG" : "NOTABLE";
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

const TRACK_IDS: Record<string, string> = { internship: "intern", "new-grad": "newgrad", junior: "junior" };

// Mirrors web/app.js's trackFor() -- categories[0] wins when a title matches
// more than one category (e.g. "Graduate Program Intern" matches both).
export function trackFor(categories: string[]): string {
  return TRACK_IDS[categories[0]] ?? "intern";
}

// --- Estimated pay ----------------------------------------------------------
// Mirrors web/app.js's estimatePay()/marketFor() -- same "nothing exposes a
// real salary" reasoning as there (see the comment on HUB_BASE in app.js).
// Kept hand-synced since the browser can't import this module.
const HUB_BASE: Record<string, number> = {
  Zurich: 33, London: 22, Dublin: 21, Amsterdam: 19, Munich: 18, Stockholm: 17,
  Berlin: 17, Helsinki: 16, Paris: 15, Barcelona: 12, Madrid: 12, Lisbon: 10,
  Warsaw: 10, Tallinn: 10,
  "San Francisco": 45, Seattle: 42, "New York": 42, Boston: 38, Austin: 35, "Los Angeles": 35,
  Chicago: 32, Vancouver: 30, Toronto: 30, Montreal: 27,
};

const NA_TOKENS = [
  "united states", "u.s.", "usa", ", us", "canada", "ontario", "quebec", "british columbia",
  "california", "washington", "new york", "texas", "massachusetts", "illinois", "colorado",
  "georgia", "florida", "virginia", "new jersey", "utah", "arizona", "oregon", "michigan",
  ", ca", ", ny", ", wa", ", tx", ", ma", ", nj", ", ut", ", il", ", co", ", or",
];

const EUR_TO_USD = 1.08;
const TRACK_PAY_MULT: Record<string, number> = { intern: 1, junior: 1.35, newgrad: 1.6 };
const CATEGORY_MULT: Record<string, number> = { quant: 1.35, ai: 1.15, swe: 1, hw: 0.95, product: 1, design: 0.85, biz: 0.8 };
const SPREAD_KNOWN = 0.11;
const SPREAD_LOOSE = 0.18;

export interface PayEstimate {
  currency: "eur" | "usd";
  low: number;
  high: number;
  // Normalised so a Berlin euro band and a San Francisco dollar one compare
  // on the same scale instead of ordering by raw number.
  usdMid: number;
  loose: boolean;
}

export function estimatePay(
  job: {
    company: string;
    location: string;
    title: string;
    categories: string[];
    advancedDegree?: number | null;
  },
  tiers: CompanyTier[],
): PayEstimate {
  const hub = hubFor(job.location);
  const base = HUB_BASE[hub];
  const known = base !== undefined;
  const na = NA_TOKENS.some((token) => job.location.toLowerCase().includes(token));
  const currency: "eur" | "usd" = (known ? HUB_REGION[hub] : na ? "na" : "eu") === "na" ? "usd" : "eur";
  const marketBase = known ? (base as number) : na ? 32 : 14;

  const tier = tierForCompany(job.company, tiers);
  const track = trackFor(job.categories);
  const discipline = disciplineFor(job.title).id;

  const mid =
    marketBase *
    (tier ? tier.mult : 1) *
    (TRACK_PAY_MULT[track] ?? 1) *
    (CATEGORY_MULT[discipline] ?? 1) *
    (job.advancedDegree ? 1.25 : 1);

  const spread = known ? SPREAD_KNOWN : SPREAD_LOOSE;
  return {
    currency,
    low: mid * (1 - spread),
    high: mid * (1 + spread),
    usdMid: currency === "eur" ? mid * EUR_TO_USD : mid,
    loose: !known || !tier,
  };
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
