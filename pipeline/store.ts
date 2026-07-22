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
  fetched_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
CREATE INDEX IF NOT EXISTS idx_jobs_posted ON jobs(posted_date);
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
  fetched_at = excluded.fetched_at;
`;

// ponytail: covers DBs created before these columns existed, since CREATE
// TABLE IF NOT EXISTS is a no-op on an existing table. Add to this list
// whenever a new nullable column joins the schema.
const ADDED_COLUMNS = [
  { name: "season", type: "TEXT" },
  { name: "advanced_degree", type: "INTEGER" },
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
}

export function storeJobs(jobs: Job[]): void {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
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

export function openDb(): DatabaseSync {
  const db = new DatabaseSync(DB_PATH);
  db.exec(SCHEMA);
  migrate(db);
  return db;
}
