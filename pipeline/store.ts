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
INSERT INTO jobs (id, external_id, title, company, location, country, url, source, posted_date, tags, categories, first_seen_at, last_seen_at, fetched_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  external_id = excluded.external_id,
  title = excluded.title,
  company = excluded.company,
  location = excluded.location,
  country = excluded.country,
  url = excluded.url,
  source = excluded.source,
  posted_date = excluded.posted_date,
  tags = excluded.tags,
  categories = excluded.categories,
  last_seen_at = excluded.last_seen_at,
  fetched_at = excluded.fetched_at;
`;

export function storeJobs(jobs: Job[]): void {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  try {
    db.exec(SCHEMA);
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
  return db;
}
