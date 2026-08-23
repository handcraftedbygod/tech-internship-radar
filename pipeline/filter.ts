import { createHash } from "node:crypto";
import type { RawJob, Job } from "../types/job.ts";
import type { KeywordsConfig, LocationsConfig, SettingsConfig } from "../config/load.ts";

function computeId(job: RawJob): string {
  // company must match the trimmed value actually stored (see the Job push
  // below) -- a source with inconsistent whitespace on the same listing
  // (freehire does this) would otherwise hash a different id run to run for
  // a URL-less job, creating a duplicate row instead of upserting it.
  const basis = job.url?.trim() || `${job.company.trim()}|${job.title}|${job.location}`;
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

// vanshb03/cvrve are each single-purpose community lists (Summer-Internships /
// New-Grad) that already curate for the right career stage, but plenty of
// their entries are titled like "Software Development Co-op" or "Software
// Engineer I" -- no literal "intern"/"new grad" wording for title-matching to
// catch. Force the category their source name implies, same trust already
// extended to them for the tech gate below.
const SOURCE_CATEGORY: Record<string, string> = {
  vanshb03: "internship",
  cvrve: "new-grad",
};

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
  const sourceCategory = SOURCE_CATEGORY[job.source];
  if (sourceCategory && !categories.includes(sourceCategory)) categories.push(sourceCategory);
  return categories;
}

// adzuna/arbeitnow/remotive/themuse/eures/remoteok/usajobs are all-industry
// job boards with no tech filter of their own -- "internship" as a search
// term surfaces nursing, retail, hospitality, etc. just as readily as
// software roles (confirmed live for remoteok: its /api feed includes e.g. a
// music-designer posting alongside dev roles). usajobs.ts already scopes its
// query to tech Keyword terms server-side, but gets gated too as
// defense-in-depth since a federal agency's "software" match can still pull
// in e.g. procurement-of-software-systems admin roles.
// smartrecruiters/recruitee are curated via config/companies.json like
// greenhouse/lever/ashby/workday, but (unlike those) their typical customer
// is a large mixed-workforce employer (e.g. Sixt, Delivery Hero, bunq) where
// most postings are ops/retail/legal/commercial, not tech -- so they get
// gated too. greenhouse/lever/ashby/workday postings come from companies
// picked because the *whole* board is tech, so they skip this gate.
// vanshb03/cvrve skip the gate despite being external/crowdsourced: they're
// submission-curated to tech/CS/quant/PM internships and new-grad roles by
// the source repo itself (same division of labor as config/companies.json,
// just crowdsourced instead of hand-picked) -- gating them would drop the
// PM/quant roles that are part of what the list is for.
// arbeitsamt/freehire/reed are general-purpose or broad-aggregator boards,
// not tech-exclusive, same reasoning as adzuna/arbeitnow. aidevjobs/aijobs/
// findwork are already tech/AI-scoped by construction (like usajobs' own
// server-side Keyword scoping) but get gated too as defense-in-depth -- an
// adjacent title (e.g. "AI Sales Engineer") can still slip through a niche
// board's own categorization.
const BROAD_SOURCES = new Set([
  "adzuna",
  "arbeitnow",
  "remotive",
  "smartrecruiters",
  "recruitee",
  "themuse",
  "eures",
  "remoteok",
  "usajobs",
  "arbeitsamt",
  "freehire",
  "aidevjobs",
  "aijobs",
  "reed",
  "findwork",
]);

// UK IT-bootcamp/training lead-gen mills that mass-repost the same handful of
// templated "Trainee X" titles across every UK postcode -- confirmed live
// across multiple independent sources (Reed's own API, and again via
// freehire's aggregation of other UK boards), so this is gated centrally
// rather than as a per-fetcher blocklist.
const SPAM_COMPANIES = ["IT Career Switch", "ITOL Recruit", "Newto Training"];

function isSpamCompany(company: string): boolean {
  const name = company.toLowerCase();
  return SPAM_COMPANIES.some((spam) => hasKeyword(name, spam));
}

function isTechRelevant(job: RawJob, keywords: KeywordsConfig): boolean {
  if (!BROAD_SOURCES.has(job.source)) return true;
  if (!keywords.techGate) return true;
  const text = job.title.toLowerCase();
  return keywords.techGate.include.some((kw) => hasKeyword(text, kw));
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

const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
  "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT",
  "VA", "WA", "WV", "WI", "WY", "DC",
]);

// "City, ST" job-board formatting for the many US cities with no dedicated hub
// entry (Denver, Dallas, Bellevue, ...). Checked against the ORIGINAL
// (not lowercased) text and only on a comma-prefixed two-letter token, so a
// common word that happens to equal a state code ("or", "in", "hi", "me")
// can't false-positive -- that shape only occurs after a comma in a real
// postal-style address, confirmed against real vanshb03/cvrve drops.
function hasUSStateCode(location: string): boolean {
  for (const match of location.matchAll(/,\s*([A-Z]{2})\b/g)) {
    if (US_STATE_CODES.has(match[1])) return true;
  }
  return false;
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
  if (!locations.allowRemoteGlobal) return false;
  // "canada"/"remote" added after the vanshb03/cvrve community lists showed real
  // entries with location text of just "Canada" or "Remote" -- no city, no "USA"/
  // "US"/"CA" token, so the existing alternation silently dropped them. Same
  // story for "united states"/"washington, d.c." -- neither contains a bare
  // "us"/"usa" token on its own.
  if (/europe|\beu\b|north america|canada|remote|\b(usa|us|ca)\b|united states|washington,? d\.?c\.?/.test(text)) {
    return true;
  }
  return hasUSStateCode(job.location);
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
    // A fetcher never throws, but its source API can still hand back a
    // malformed entry (e.g. a posting with no title, or freehire's Telegram-
    // sourced postings with a blank company field) -- one bad job used to
    // crash the whole run here, since every downstream check assumes a
    // string title, and a blank company breaks its company-page link
    // (company.html?slug=). Skip it instead: it's unusable either way.
    if (!raw.title) continue;
    if (!raw.company?.trim()) continue;
    // freehire occasionally carries a bare internal listing ID (e.g. "130844")
    // in the company field instead of a real name -- no real employer is
    // registered as just a number, so this is unusable the same way.
    if (/^\d+$/.test(raw.company.trim())) continue;
    if (isSpamCompany(raw.company)) continue;

    const categories = matchedCategories(raw, keywords);
    if (categories.length === 0) continue;
    if (!isTechRelevant(raw, keywords)) continue;
    if (!matchesLocation(raw, locations)) continue;
    if (!isRecentEnough(raw, settings.maxAgeDays)) continue;

    const { descriptionText, ...rest } = raw;
    jobs.push({
      ...rest,
      // freehire's aggregation sometimes carries a leading/trailing space on
      // the company name (e.g. " nology") -- cosmetic, but shows up verbatim
      // anywhere the name is displayed.
      company: raw.company.trim(),
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
