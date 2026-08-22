import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const configDir = path.dirname(fileURLToPath(import.meta.url));

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(configDir, file), "utf8")) as T;
}

export interface KeywordList {
  description?: string;
  include: string[];
  exclude?: string[];
}

export interface KeywordsConfig {
  lists: Record<string, KeywordList>;
  techGate?: KeywordList;
}

export interface LocationHub {
  city: string;
  country: string;
  adzunaCountry: string | null;
  aliases: string[];
}

export interface LocationsConfig {
  hubs: LocationHub[];
  allowRemoteGlobal: boolean;
}

export type CompanyEntry = {
  name: string;
  source: "greenhouse" | "lever" | "ashby" | "workday" | "smartrecruiters" | "recruitee" | "icims";
} & Record<string, unknown>;

export interface CompaniesConfig {
  companies: CompanyEntry[];
}

export interface SettingsConfig {
  maxAgeDays: number;
}

export interface CompanyTier {
  id: string;
  mult: number;
  names: string[];
}

export interface TiersConfig {
  description?: string;
  tiers: CompanyTier[];
}

export function loadKeywords(): KeywordsConfig {
  return readJson<KeywordsConfig>("keywords.json");
}

export function loadLocations(): LocationsConfig {
  return readJson<LocationsConfig>("locations.json");
}

export function loadCompanies(source: CompanyEntry["source"]): CompanyEntry[] {
  const { companies } = readJson<CompaniesConfig>("companies.json");
  return companies.filter((c) => c.source === source);
}

export function loadSettings(): SettingsConfig {
  return readJson<SettingsConfig>("settings.json");
}

export function loadTiers(): TiersConfig {
  return readJson<TiersConfig>("tiers.json");
}

// Normalized raw-company-string -> canonical display name, for companies whose
// name varies across sources (e.g. "Meta Careers" vs "Meta"). Starts sparse --
// populate as real duplicates are observed (SELECT DISTINCT company FROM jobs).
export function loadCompanyAliases(): Record<string, string> {
  return readJson<Record<string, string>>("companyAliases.json");
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Case-insensitive, word-boundary match against the company name, first tier
// wins. Plain substring used to false-positive badly -- "Rheinmetall AG"
// contains "Meta", "Innowise"/"Workwise GmbH" contain "Wise",
// "Quberesearchandtechnologies" contains "Uber", "Tenth Revolution Group"
// contains "Revolut" (the "revolution" prefix) -- all verified live matches
// against real company names in the tracked data. Shared by the pipeline
// (archive gate) and mirrored in web/app.js for the browser, which can't
// import TS -- config/tiers.json is the single source of truth for both.
export function tierForCompany(company: string, tiers: CompanyTier[]): CompanyTier | null {
  const name = company.toLowerCase();
  return (
    tiers.find((tier) =>
      tier.names.some((n) => new RegExp(`\\b${escapeRegExp(n.toLowerCase())}\\b`).test(name)),
    ) ?? null
  );
}
