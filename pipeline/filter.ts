import { createHash } from "node:crypto";
import type { RawJob, Job } from "../types/job.ts";
import type { KeywordsConfig, LocationsConfig, SettingsConfig } from "../config/load.ts";

function computeId(job: RawJob): string {
  const basis = job.url?.trim() || `${job.company}|${job.title}|${job.location}`;
  return createHash("sha1").update(basis).digest("hex");
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Word-boundary match, not plain substring — "intern" as a substring would also
// match "international"/"internal", which plain .includes() was doing.
function hasKeyword(text: string, keyword: string): boolean {
  return new RegExp(`\\b${escapeRegExp(keyword.toLowerCase())}\\b`).test(text);
}

// Matching is title-only, not full description: ATS boilerplate (e.g. "this
// benefit is not available for interns/working students" in a benefits list)
// mentions internship terms on plenty of non-internship postings. The title
// is how job boards categorize roles in practice, and is a much cleaner signal.
function matchedCategories(job: RawJob, keywords: KeywordsConfig): string[] {
  const text = job.title.toLowerCase();
  const categories: string[] = [];
  for (const [name, list] of Object.entries(keywords.lists)) {
    const included = list.include.some((kw) => hasKeyword(text, kw));
    const excluded = (list.exclude ?? []).some((kw) => hasKeyword(text, kw));
    if (included && !excluded) categories.push(name);
  }
  return categories;
}

function matchedTags(job: RawJob, keywords: KeywordsConfig): string[] {
  const text = job.title.toLowerCase();
  const tags = new Set<string>();
  for (const list of Object.values(keywords.lists)) {
    for (const kw of list.include) {
      if (hasKeyword(text, kw)) tags.add(kw);
    }
  }
  return [...tags];
}

// Detected straight from the title, not curated -- a hiring-cycle chip like
// "Summer 2027" appears in our data the moment a source posts it, with no
// wait for someone to notice and add it by hand.
const SEASON_PATTERN = /\b(spring|summer|fall|autumn|winter)\s+(20\d{2})\b/i;

function extractSeason(title: string): string | undefined {
  const match = title.match(SEASON_PATTERN);
  if (!match) return undefined;
  const season = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
  return `${season} ${match[2]}`;
}

// Same title-only approach as season detection -- degree requirements are
// usually buried in the description, but when a posting IS degree-gated it's
// common for the title itself to say so (e.g. "PhD Research Intern"). Requires
// the "'s"/"s" on master(')s -- bare "Master" also means "Scrum Master" or
// "expert", not the degree, and would false-positive on those titles.
const ADVANCED_DEGREE_PATTERN = /\b(phd|ph\.d\.?|master'?s|msc|m\.sc\.?|mba)\b/i;

function requiresAdvancedDegree(title: string): boolean {
  return ADVANCED_DEGREE_PATTERN.test(title);
}

function isRecentEnough(job: RawJob, maxAgeDays: number): boolean {
  if (!job.postedDate) return true; // ponytail: unparseable/missing date, can't enforce recency, so let it through
  const posted = new Date(job.postedDate);
  if (Number.isNaN(posted.getTime())) return true;
  const ageMs = Date.now() - posted.getTime();
  return ageMs <= maxAgeDays * 24 * 60 * 60 * 1000;
}

function matchesLocation(job: RawJob, locations: LocationsConfig): boolean {
  const text = `${job.location} ${job.country ?? ""}`.toLowerCase();
  const hubMatch = locations.hubs.some(
    (hub) =>
      text.includes(hub.city.toLowerCase()) ||
      hub.aliases.some((alias) => text.includes(alias.toLowerCase())) ||
      (job.country && job.country.toUpperCase() === hub.country),
  );
  if (hubMatch) return true;
  return locations.allowRemoteGlobal && /europe|\beu\b|north america|\b(usa|us|ca)\b/.test(text);
}

export function filterJobs(
  rawJobs: RawJob[],
  keywords: KeywordsConfig,
  locations: LocationsConfig,
  settings: SettingsConfig,
): Job[] {
  const now = new Date().toISOString();
  const jobs: Job[] = [];

  for (const raw of rawJobs) {
    const categories = matchedCategories(raw, keywords);
    if (categories.length === 0) continue;
    if (!matchesLocation(raw, locations)) continue;
    if (!isRecentEnough(raw, settings.maxAgeDays)) continue;

    const { descriptionText, ...rest } = raw;
    jobs.push({
      ...rest,
      id: computeId(raw),
      tags: matchedTags(raw, keywords),
      categories,
      season: raw.season ?? extractSeason(raw.title),
      advancedDegree: requiresAdvancedDegree(raw.title) || undefined,
      fetchedAt: now,
      firstSeenAt: now,
    });
  }

  return jobs;
}
