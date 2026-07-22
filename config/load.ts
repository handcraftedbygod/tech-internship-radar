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
  source: "greenhouse" | "lever" | "ashby" | "workday";
} & Record<string, unknown>;

export interface CompaniesConfig {
  companies: CompanyEntry[];
}

export interface SettingsConfig {
  maxAgeDays: number;
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
