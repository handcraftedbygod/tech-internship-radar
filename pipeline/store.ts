import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Job } from "../types/job.ts";

const DB_PATH = path.join(import.meta.dirname, "..", "data", "jobs.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS jobs (
  id            TEXT PRIMARY KEY,
  external_id   TEXT NOT NULL,
  title         TEXT NOT NULL,
  company       TEXT NOT NULL,
  location      TEXT NOT NULL,
  country       TEXT,
  url           TEXT NOT NULL,
  source        TEXT NOT NULL,
  posted_date   TEXT,
  season        TEXT,
  advanced_degree INTEGER,
  tags          TEXT NOT NULL,
  categories    TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL,
  fetched_at    TEXT NOT NULL,
  closed_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
CREATE INDEX IF NOT EXISTS idx_jobs_posted ON jobs(posted_date);
`;

// Indexes on migration-added columns can't live in SCHEMA: db.exec(SCHEMA) runs
// before migrate(), and on a pre-existing table CREATE TABLE IF NOT EXISTS
// no-ops -- so the column wouldn't exist yet and the CREATE INDEX would throw
// "no such column". These run after migrate() instead.
const POST_MIGRATION_SCHEMA = `
CREATE INDEX IF NOT EXISTS idx_jobs_closed ON jobs(closed_at);
`;

const UPSERT = `
INSERT INTO jobs (id, external_id, title, company, location, country, url, source, posted_date, season, advanced_degree, tags, categories, first_seen_at, last_seen_at, fetched_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  external_id = excluded.external_id,
  title = excluded.title,
  company = excluded.company,
  location = excluded.location,
  country = excluded.country,
  url = excluded.url,
  source = excluded.source,
  posted_date = excluded.posted_date,
  season = excluded.season,
  advanced_degree = excluded.advanced_degree,
  tags = excluded.tags,
  categories = excluded.categories,
  last_seen_at = excluded.last_seen_at,
  fetched_at = excluded.fetched_at,
  -- A previously-archived listing that shows up again is live once more, so it
  -- must leave the "Missed It" archive rather than appear in both places.
  closed_at = NULL;
`;

// ponytail: covers DBs created before these columns existed, since CREATE
// TABLE IF NOT EXISTS is a no-op on an existing table. Add to this list
// whenever a new nullable column joins the schema.
const ADDED_COLUMNS = [
  { name: "season", type: "TEXT" },
  { name: "advanced_degree", type: "INTEGER" },
  { name: "closed_at", type: "TEXT" },
];

// ponytail: salary turned out not to be worth showing (near-always empty --
// only Adzuna reports it), so this drops it from any DB created while the
// column existed. Not generalized into a list since column removal should
// stay rare and deliberate, unlike additions.
const DROPPED_COLUMNS = ["salary"];

function migrate(db: DatabaseSync): void {
  const columns = db.prepare("PRAGMA table_info(jobs)").all() as unknown as { name: string }[];
  const existing = new Set(columns.map((c) => c.name));
  for (const col of ADDED_COLUMNS) {
    if (!existing.has(col.name)) {
      db.exec(`ALTER TABLE jobs ADD COLUMN ${col.name} ${col.type}`);
    }
  }
  for (const name of DROPPED_COLUMNS) {
    if (existing.has(name)) {
      db.exec(`ALTER TABLE jobs DROP COLUMN ${name}`);
    }
  }
  db.exec(POST_MIGRATION_SCHEMA);
}

export function storeJobs(jobs: Job[], dbPath: string = DB_PATH): void {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(SCHEMA);
    migrate(db);
    const stmt = db.prepare(UPSERT);
    db.exec("BEGIN");
    for (const job of jobs) {
      stmt.run(
        job.id,
        job.externalId,
        job.title,
        job.company,
        job.location,
        job.country,
        job.url,
        job.source,
        job.postedDate,
        job.season ?? null,
        job.advancedDegree ? 1 : null,
        JSON.stringify(job.tags),
        JSON.stringify(job.categories),
        job.firstSeenAt,
        job.fetchedAt,
        job.fetchedAt,
      );
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  } finally {
    db.close();
  }
}

// storeJobs only ever upserts -- a job that stops being returned by its
// fetcher (taken down, or now rejected by a tightened filter.ts/keywords.json
// rule, e.g. the tech-relevance gate) keeps its last row forever, since
// nothing ever deletes it. exportJson() dumps the whole table, so that dead
// row would show up in jobs.json indefinitely. Prune anything not re-seen in
// the last maxAgeDays -- a still-live posting gets last_seen_at refreshed
// every run, so only truly stale/rejected rows are ever older than that.
//
// Exception: listings from archiveTiers companies (config/tiers.json) are
// stamped with closed_at instead of deleted, so the site can show a "closed
// recently" section. Only the top tiers qualify -- gating lower would bury the
// genuinely enviable misses under routine listings, and the archive would grow
// without bound. Returns both counts so the run summary can report them.
export interface PruneResult {
  deleted: number;
  archived: number;
}

export function pruneStale(
  maxAgeDays: number,
  dbPath: string = DB_PATH,
  archiveNames: string[] = [],
): PruneResult {
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(SCHEMA);
    migrate(db);
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();

    // Substring match on company, mirroring tierForCompany() in config/load.ts.
    // Built as OR'd LIKE clauses so the matching stays in SQL rather than
    // pulling every stale row into JS just to filter it.
    let archived = 0;
    if (archiveNames.length > 0) {
      const clause = archiveNames.map(() => "LOWER(company) LIKE ?").join(" OR ");
      const params = archiveNames.map((n) => `%${n.toLowerCase()}%`);
      const result = db
        .prepare(
          `UPDATE jobs SET closed_at = ? WHERE last_seen_at < ? AND closed_at IS NULL AND (${clause})`,
        )
        .run(new Date().toISOString(), cutoff, ...params);
      archived = Number(result.changes);
    }

    // Anything still stale after archiving wasn't gated, so it goes for good.
    // Archived rows are excluded -- they're intentionally kept.
    const result = db
      .prepare("DELETE FROM jobs WHERE last_seen_at < ? AND closed_at IS NULL")
      .run(cutoff);
    return { deleted: Number(result.changes), archived };
  } finally {
    db.close();
  }
}

export function openDb(dbPath: string = DB_PATH): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);
  migrate(db);
  return db;
}
