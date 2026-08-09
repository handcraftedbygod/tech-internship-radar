import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { openDb } from "./store.ts";
import { loadCompanyAliases, loadTiers, tierForCompany, type CompanyTier } from "../config/load.ts";
import { hubFor, disciplineFor, companySlug, tierBadge, estimatePay } from "./company.ts";

const REPORTS_PATH = path.join(import.meta.dirname, "..", "web", "data", "reports.json");
// Regenerated every run and gitignored, like pipeline-summary.md -- delivered
// via $GITHUB_STEP_SUMMARY in the workflow step rather than committed.
const DRAFT_PATH = path.join(import.meta.dirname, "..", "weekly-report-draft.md");
const SITE_URL = "https://handcraftedbygod.github.io/tech-internship-radar/";
// weekly-report runs as its own job (see .github/workflows/pipeline.yml),
// separate from the nightly fetch -- it reads yc.json rather than refetching
// yc-oss/api itself.
const YC_PATH = path.join(import.meta.dirname, "..", "web", "data", "yc.json");

interface ReportRow {
  company: string;
  location: string;
  title: string;
  url: string;
  categories: string[];
  advanced_degree: number | null;
  season: string | null;
  first_seen_at: string;
}

export interface WeeklyReport {
  weekOf: string; // ISO date, start of the 7-day window this report covers
  newCount: number;
  prevWeekCount: number;
  pctChange: number;
  topHubs: { hub: string; count: number }[];
  topCompanies: { name: string; slug: string; count: number }[];
  fastestGrowingDiscipline: { id: string; label: string; pctChange: number } | null;
  notableHiring: { name: string; slug: string; badge: "FAANG" | "NOTABLE"; count: number }[];
  ycHiring: { europe: number; northAmerica: number };
  topPay: {
    company: string;
    title: string;
    url: string;
    hub: string;
    currency: "eur" | "usd";
    low: number;
    high: number;
  } | null;
  // One editorial pick for the top of every draft: the freshest listing from
  // a FAANG/notable-tier company this week (falling back to the single
  // freshest listing overall if none posted), not just "the highest usdMid"
  // -- that's what topPay already covers, and repeating it here would make
  // the two fields redundant instead of complementary.
  headline: {
    company: string;
    title: string;
    url: string;
    hub: string;
    badge: "FAANG" | "NOTABLE" | null;
    currency: "eur" | "usd";
    low: number;
    high: number;
  } | null;
  // The listing with the furthest-out hiring cycle spotted this week (season
  // year beyond the current calendar year) -- the FOMO hook: applicants who
  // want to be first in line for a cycle nobody else has noticed yet.
  earlyPick: { company: string; title: string; url: string; season: string; hub: string } | null;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Floor before a discipline counts as "fastest growing" -- otherwise 1->2
// postings reads as a headline-grabbing "+100%" that's really just noise.
const MIN_DISCIPLINE_COUNT = 3;

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// Mirrors web/app.js's isEarly() year check, reading the already-extracted
// season column instead of re-parsing the title.
function seasonYear(season: string | null): number | null {
  if (!season) return null;
  const match = season.match(/(20\d{2})/);
  return match ? Number(match[1]) : null;
}

export function buildWeeklyReport(
  rows: ReportRow[],
  aliases: Record<string, string>,
  tiers: CompanyTier[],
  ycHiring: WeeklyReport["ycHiring"] = { europe: 0, northAmerica: 0 },
  now: Date = new Date(),
): WeeklyReport {
  const cutoffThisWeek = new Date(now.getTime() - WEEK_MS).toISOString();
  const cutoffLastWeek = new Date(now.getTime() - 2 * WEEK_MS).toISOString();

  const thisWeek = rows.filter((r) => r.first_seen_at >= cutoffThisWeek);
  const lastWeek = rows.filter((r) => r.first_seen_at >= cutoffLastWeek && r.first_seen_at < cutoffThisWeek);

  const hubCounts = new Map<string, number>();
  for (const r of thisWeek) {
    const hub = hubFor(r.location);
    hubCounts.set(hub, (hubCounts.get(hub) ?? 0) + 1);
  }
  const topHubs = [...hubCounts.entries()]
    .map(([hub, count]) => ({ hub, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const companyCounts = new Map<string, { name: string; count: number }>();
  for (const r of thisWeek) {
    const slug = companySlug(r.company, aliases);
    const existing = companyCounts.get(slug);
    companyCounts.set(slug, { name: r.company, count: (existing?.count ?? 0) + 1 });
  }
  const topCompanies = [...companyCounts.entries()]
    .map(([slug, v]) => ({ slug, name: v.name, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const disciplineThisWeek = new Map<string, { label: string; count: number }>();
  for (const r of thisWeek) {
    const d = disciplineFor(r.title);
    const existing = disciplineThisWeek.get(d.id);
    disciplineThisWeek.set(d.id, { label: d.label, count: (existing?.count ?? 0) + 1 });
  }
  const disciplineLastWeek = new Map<string, number>();
  for (const r of lastWeek) {
    const id = disciplineFor(r.title).id;
    disciplineLastWeek.set(id, (disciplineLastWeek.get(id) ?? 0) + 1);
  }

  let fastestGrowingDiscipline: WeeklyReport["fastestGrowingDiscipline"] = null;
  let bestPct = -Infinity;
  for (const [id, { label, count }] of disciplineThisWeek) {
    if (count < MIN_DISCIPLINE_COUNT) continue;
    const pct = pctChange(count, disciplineLastWeek.get(id) ?? 0);
    if (pct > bestPct) {
      bestPct = pct;
      fastestGrowingDiscipline = { id, label, pctChange: pct };
    }
  }

  const notableCounts = new Map<string, { name: string; badge: "FAANG" | "NOTABLE"; count: number }>();
  for (const r of thisWeek) {
    const tier = tierForCompany(r.company, tiers);
    if (!tier) continue;
    const badge = tierBadge(tier.id);
    if (!badge) continue;
    const slug = companySlug(r.company, aliases);
    const existing = notableCounts.get(slug);
    notableCounts.set(slug, { name: r.company, badge, count: (existing?.count ?? 0) + 1 });
  }
  const notableHiring = [...notableCounts.entries()]
    .map(([slug, v]) => ({ slug, name: v.name, badge: v.badge, count: v.count }))
    .sort((a, b) => b.count - a.count);

  let topPay: WeeklyReport["topPay"] = null;
  let bestUsdMid = -Infinity;
  for (const r of thisWeek) {
    const pay = estimatePay(r, tiers);
    if (pay.usdMid <= bestUsdMid) continue;
    bestUsdMid = pay.usdMid;
    topPay = {
      company: r.company,
      title: r.title,
      url: r.url,
      hub: hubFor(r.location),
      currency: pay.currency,
      low: Math.round(pay.low),
      high: Math.round(pay.high),
    };
  }

  let headline: WeeklyReport["headline"] = null;
  const tiered = thisWeek
    .map((r) => ({ r, tier: tierForCompany(r.company, tiers) }))
    .filter((x): x is { r: ReportRow; tier: CompanyTier } => x.tier !== null);
  const headlinePool = tiered.length ? tiered : thisWeek.map((r) => ({ r, tier: null as CompanyTier | null }));
  // Prefer FAANG (elite) tier over trading/notable over untiered, then the
  // most recently seen -- "the freshest big-name opening", not just "the
  // freshest listing, period".
  const tierRank = (t: CompanyTier | null) => (t?.id === "elite" ? 2 : t ? 1 : 0);
  const pick = headlinePool.reduce<(typeof headlinePool)[number] | null>((best, cur) => {
    if (!best) return cur;
    if (tierRank(cur.tier) !== tierRank(best.tier)) return tierRank(cur.tier) > tierRank(best.tier) ? cur : best;
    return cur.r.first_seen_at > best.r.first_seen_at ? cur : best;
  }, null);
  if (pick) {
    const pay = estimatePay(pick.r, tiers);
    headline = {
      company: pick.r.company,
      title: pick.r.title,
      url: pick.r.url,
      hub: hubFor(pick.r.location),
      badge: tierBadge(pick.tier?.id ?? null),
      currency: pay.currency,
      low: Math.round(pay.low),
      high: Math.round(pay.high),
    };
  }

  let earlyPick: WeeklyReport["earlyPick"] = null;
  let earlyBestYear = -Infinity;
  let earlyBestSeenAt = "";
  const thisYear = now.getFullYear();
  for (const r of thisWeek) {
    const year = seasonYear(r.season);
    if (year === null || year <= thisYear) continue;
    if (year < earlyBestYear) continue;
    if (year === earlyBestYear && r.first_seen_at <= earlyBestSeenAt) continue;
    earlyBestYear = year;
    earlyBestSeenAt = r.first_seen_at;
    earlyPick = { company: r.company, title: r.title, url: r.url, season: r.season as string, hub: hubFor(r.location) };
  }

  return {
    weekOf: cutoffThisWeek.slice(0, 10),
    newCount: thisWeek.length,
    prevWeekCount: lastWeek.length,
    pctChange: pctChange(thisWeek.length, lastWeek.length),
    topHubs,
    topCompanies,
    fastestGrowingDiscipline,
    notableHiring,
    ycHiring,
    topPay,
    headline,
    earlyPick,
  };
}

function pctLabel(pct: number): string {
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

// Snapshot phrasing ("hiring right now"), not a week-over-week delta -- unlike
// the job-row stats, yc.json is a current-state list (see pipeline/ycHiring.ts),
// not events dated to this week.
function ycSummary(yc: WeeklyReport["ycHiring"]): string | null {
  if (!yc.europe && !yc.northAmerica) return null;
  return `Y Combinator startups hiring right now: ${yc.europe} in Europe, ${yc.northAmerica} in North America.`;
}

const CURRENCY_SYMBOL: Record<string, string> = { eur: "€", usd: "$" };

function formatPayRange(pay: { currency: "eur" | "usd"; low: number; high: number }): string {
  const symbol = CURRENCY_SYMBOL[pay.currency];
  return `${symbol}${pay.low}–${symbol}${pay.high}/h`;
}

// The one-line spotlight every draft leads with -- combines tier, pay, and
// freshness into a single hook instead of a raw number dump.
function headlineLine(h: NonNullable<WeeklyReport["headline"]>): string {
  const tierPart = h.badge ? `${h.badge} · ` : "";
  return `${tierPart}${h.title} at ${h.company} (${h.hub}) — ${formatPayRange(h)}`;
}

function earlySummary(e: NonNullable<WeeklyReport["earlyPick"]>): string {
  return `First ${e.season} posting spotted: ${e.title} at ${e.company} (${e.hub}).`;
}

const TWITTER_LIMIT = 280;

function buildTwitterDraft(r: WeeklyReport): string {
  const parts = [`This week on Tech Internship Radar: ${r.newCount} new listings (${pctLabel(r.pctChange)}).`];
  // Twitter leads with the headline pick instead of separate FAANG/top-pay
  // clauses -- it already synthesizes both, restating them burns characters.
  if (r.headline) parts.push(`Standout: ${headlineLine(r.headline)}.`);
  const yc = ycSummary(r.ycHiring);
  if (yc) parts.push(yc);
  if (r.topHubs[0]) parts.push(`Top hub: ${r.topHubs[0].hub}.`);
  if (r.topCompanies[0]) parts.push(`Most active: ${r.topCompanies[0].name}.`);
  // Lowest priority -- rare enough that it's fine to be first trimmed by the
  // length cap below when the rest of the draft already fills the budget.
  if (r.earlyPick) parts.push(earlySummary(r.earlyPick));
  const text = parts.join(" ");
  return text.length > TWITTER_LIMIT ? text.slice(0, TWITTER_LIMIT - 1) + "…" : text;
}

function buildLinkedInDraft(r: WeeklyReport): string {
  const lines = [
    `Tech Internship Radar — week of ${r.weekOf}`,
    "",
    `${r.newCount} new internship, new-grad and junior listings this week (${pctLabel(r.pctChange)} vs. last week).`,
  ];
  if (r.headline) lines.push("", `Standout this week: ${headlineLine(r.headline)}`);
  if (r.notableHiring.length) {
    lines.push("", "FAANG / notable companies hiring:", ...r.notableHiring.map((c) => `- ${c.name} [${c.badge}] (${c.count})`));
  }
  if (r.topPay) {
    lines.push("", `Top-paying listing: ${r.topPay.title} at ${r.topPay.company} (${r.topPay.hub}) — ${formatPayRange(r.topPay)}`);
  }
  if (r.earlyPick) lines.push("", earlySummary(r.earlyPick));
  const yc = ycSummary(r.ycHiring);
  if (yc) lines.push("", yc);
  if (r.topHubs.length) lines.push("", "Top hiring hubs:", ...r.topHubs.map((h) => `- ${h.hub} (${h.count})`));
  if (r.topCompanies.length) lines.push("", "Most active companies:", ...r.topCompanies.map((c) => `- ${c.name} (${c.count})`));
  if (r.fastestGrowingDiscipline) {
    lines.push("", `Fastest-growing discipline: ${r.fastestGrowingDiscipline.label} (${pctLabel(r.fastestGrowingDiscipline.pctChange)})`);
  }
  lines.push("", SITE_URL);
  return lines.join("\n");
}

function buildRedditGithubDraft(r: WeeklyReport): string {
  const lines = [`# Tech Internship Radar — week of ${r.weekOf}`, "", `**${r.newCount} new listings** this week (${pctLabel(r.pctChange)} vs. last week).`];
  if (r.headline) lines.push("", `**Standout this week:** ${headlineLine(r.headline)}`);
  if (r.notableHiring.length) {
    lines.push("", "## FAANG / notable companies hiring", ...r.notableHiring.map((c) => `- ${c.name} [${c.badge}] — ${c.count}`));
  }
  if (r.topPay) {
    lines.push(
      "",
      `## Top-paying listing`,
      `**${r.topPay.title}** at **${r.topPay.company}** (${r.topPay.hub}) — ${formatPayRange(r.topPay)}`,
    );
  }
  if (r.earlyPick) lines.push("", earlySummary(r.earlyPick));
  const yc = ycSummary(r.ycHiring);
  if (yc) lines.push("", yc);
  if (r.topHubs.length) lines.push("", "## Top hiring hubs", ...r.topHubs.map((h) => `- ${h.hub} — ${h.count}`));
  if (r.topCompanies.length) lines.push("", "## Most active companies", ...r.topCompanies.map((c) => `- ${c.name} — ${c.count}`));
  if (r.fastestGrowingDiscipline) {
    lines.push("", `## Fastest-growing discipline`, `${r.fastestGrowingDiscipline.label} (${pctLabel(r.fastestGrowingDiscipline.pctChange)})`);
  }
  lines.push("", `[${SITE_URL}](${SITE_URL})`);
  return lines.join("\n");
}

// Three variants, not four: LinkedIn's plain text and the Reddit/GitHub
// markdown draft would otherwise be near-duplicates. Twitter alone needs its
// own pass for the character limit.
export function formatDraft(report: WeeklyReport): string {
  return [
    "## Twitter / X", "", buildTwitterDraft(report), "",
    "## LinkedIn", "", buildLinkedInDraft(report), "",
    "## Reddit / GitHub Discussions", "", buildRedditGithubDraft(report), "",
  ].join("\n");
}

function main() {
  const db = openDb();
  const aliases = loadCompanyAliases();
  let rows: ReportRow[];
  try {
    const raw = db
      .prepare("SELECT company, location, title, url, categories, advanced_degree, season, first_seen_at FROM jobs")
      .all() as unknown as (Omit<ReportRow, "categories"> & { categories: string })[];
    rows = raw.map((r) => ({ ...r, categories: JSON.parse(r.categories) as string[] }));
  } finally {
    db.close();
  }

  const tiers = loadTiers().tiers;
  let ycHiring: WeeklyReport["ycHiring"] = { europe: 0, northAmerica: 0 };
  try {
    const yc = JSON.parse(readFileSync(YC_PATH, "utf8")) as { europe?: unknown[]; northAmerica?: unknown[] };
    ycHiring = { europe: yc.europe?.length ?? 0, northAmerica: yc.northAmerica?.length ?? 0 };
  } catch {
    // No yc.json yet, or the nightly fetch errored -- report without it.
  }
  const report = buildWeeklyReport(rows, aliases, tiers, ycHiring);

  let existing: WeeklyReport[] = [];
  try {
    existing = JSON.parse(readFileSync(REPORTS_PATH, "utf8"));
  } catch {
    // No reports.json yet -- first run.
  }
  writeFileSync(REPORTS_PATH, JSON.stringify([report, ...existing], null, 2));
  writeFileSync(DRAFT_PATH, formatDraft(report));

  console.log(`Weekly report: ${report.newCount} new listings (${pctLabel(report.pctChange)}). Draft written to weekly-report-draft.md`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
