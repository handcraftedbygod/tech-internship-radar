import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { openDb } from "./store.ts";
import { loadCompanyAliases, loadTiers, tierForCompany, type CompanyTier } from "../config/load.ts";
import { hubFor, disciplineFor, companySlug, tierBadge } from "./company.ts";

const REPORTS_PATH = path.join(import.meta.dirname, "..", "web", "data", "reports.json");
// Regenerated every run and gitignored, like pipeline-summary.md -- delivered
// via $GITHUB_STEP_SUMMARY in the workflow step rather than committed.
const DRAFT_PATH = path.join(import.meta.dirname, "..", "weekly-report-draft.md");
const SITE_URL = "https://handcraftedbygod.github.io/tech-internship-radar/";

interface ReportRow {
  company: string;
  location: string;
  title: string;
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
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Floor before a discipline counts as "fastest growing" -- otherwise 1->2
// postings reads as a headline-grabbing "+100%" that's really just noise.
const MIN_DISCIPLINE_COUNT = 3;

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function buildWeeklyReport(
  rows: ReportRow[],
  aliases: Record<string, string>,
  tiers: CompanyTier[],
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

  return {
    weekOf: cutoffThisWeek.slice(0, 10),
    newCount: thisWeek.length,
    prevWeekCount: lastWeek.length,
    pctChange: pctChange(thisWeek.length, lastWeek.length),
    topHubs,
    topCompanies,
    fastestGrowingDiscipline,
    notableHiring,
  };
}

function pctLabel(pct: number): string {
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

const TWITTER_LIMIT = 280;

function buildTwitterDraft(r: WeeklyReport): string {
  const parts = [`This week on Tech Internship Radar: ${r.newCount} new listings (${pctLabel(r.pctChange)}).`];
  const faang = r.notableHiring.filter((c) => c.badge === "FAANG");
  const spotlight = faang.length ? faang : r.notableHiring;
  if (spotlight.length) {
    parts.push(`${spotlight[0].badge} hiring: ${spotlight.slice(0, 3).map((c) => c.name).join(", ")}.`);
  }
  if (r.topHubs[0]) parts.push(`Top hub: ${r.topHubs[0].hub}.`);
  if (r.topCompanies[0]) parts.push(`Most active: ${r.topCompanies[0].name}.`);
  const text = parts.join(" ");
  return text.length > TWITTER_LIMIT ? text.slice(0, TWITTER_LIMIT - 1) + "…" : text;
}

function buildLinkedInDraft(r: WeeklyReport): string {
  const lines = [
    `Tech Internship Radar — week of ${r.weekOf}`,
    "",
    `${r.newCount} new internship, new-grad and junior listings this week (${pctLabel(r.pctChange)} vs. last week).`,
  ];
  if (r.notableHiring.length) {
    lines.push("", "FAANG / notable companies hiring:", ...r.notableHiring.map((c) => `- ${c.name} [${c.badge}] (${c.count})`));
  }
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
  if (r.notableHiring.length) {
    lines.push("", "## FAANG / notable companies hiring", ...r.notableHiring.map((c) => `- ${c.name} [${c.badge}] — ${c.count}`));
  }
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
    rows = db.prepare("SELECT company, location, title, first_seen_at FROM jobs").all() as unknown as ReportRow[];
  } finally {
    db.close();
  }

  const tiers = loadTiers().tiers;
  const report = buildWeeklyReport(rows, aliases, tiers);

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
