// Shared job schema — the reuse seam for future projects (new-grad tracker, AI jobs tracker, Hireflow).
// Adding a new keyword category later is a config change (config/keywords.json), not a change here.

export interface RawJob {
  externalId: string;
  title: string;
  company: string;
  location: string;
  country: string | null;
  url: string;
  source: string;
  postedDate: string | null;
  salary?: string;
  season?: string;
  advancedDegree?: boolean;
  descriptionText?: string;
}

export interface Job extends Omit<RawJob, "descriptionText"> {
  id: string;
  tags: string[];
  categories: string[];
  fetchedAt: string;
  firstSeenAt: string;
}
