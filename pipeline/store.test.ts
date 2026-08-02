import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { storeJobs, pruneStale, openDb } from "./store.ts";
import type { Job } from "../types/job.ts";

function job(overrides: Partial<Job>): Job {
  return {
    id: "id-1",
    externalId: "1",
    title: "Software Engineering Intern",
    company: "Acme",
    location: "Berlin",
    country: "DE",
    url: "https://example.com/job/1",
    source: "adzuna",
    postedDate: null,
    tags: ["intern"],
    categories: ["internship"],
    fetchedAt: "2026-01-01T00:00:00.000Z",
    firstSeenAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function withTempDb(fn: (dbPath: string) => void): void {
  const dir = mkdtempSync(path.join(tmpdir(), "jobs-db-test-"));
  const dbPath = path.join(dir, "jobs.db");
  try {
    fn(dbPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("pruneStale archives rows not re-seen within maxAgeDays", () => {
  withTempDb((dbPath) => {
    const stale = job({ id: "stale", fetchedAt: "2020-01-01T00:00:00.000Z" });
    storeJobs([stale], dbPath);

    const { archived } = pruneStale(7, dbPath);
    assert.equal(archived, 1);

    const db = openDb(dbPath);
    const row = db.prepare("SELECT closed_at FROM jobs WHERE id = 'stale'").get() as {
      closed_at: string | null;
    };
    const remaining = db.prepare("SELECT COUNT(*) as c FROM jobs").get() as { c: number };
    db.close();
    assert.ok(row.closed_at, "expected closed_at to be stamped");
    assert.equal(remaining.c, 1, "row must survive -- nothing is ever deleted");
  });
});

test("pruneStale keeps rows re-seen within maxAgeDays live", () => {
  withTempDb((dbPath) => {
    const fresh = job({ id: "fresh", fetchedAt: new Date().toISOString() });
    storeJobs([fresh], dbPath);

    const { archived } = pruneStale(7, dbPath);
    assert.equal(archived, 0);

    const db = openDb(dbPath);
    const row = db.prepare("SELECT closed_at FROM jobs WHERE id = 'fresh'").get() as {
      closed_at: string | null;
    };
    db.close();
    assert.equal(row.closed_at, null);
  });
});

test("migrates a pre-existing DB that lacks the newer columns", () => {
  withTempDb((dbPath) => {
    // Simulates the production DB: created before closed_at existed. CREATE
    // TABLE IF NOT EXISTS no-ops on it, so anything referencing a newer column
    // (notably CREATE INDEX) must run after migrate(), not inside SCHEMA.
    const legacy = new DatabaseSync(dbPath);
    legacy.exec(`
      CREATE TABLE jobs (
        id TEXT PRIMARY KEY, external_id TEXT NOT NULL, title TEXT NOT NULL,
        company TEXT NOT NULL, location TEXT NOT NULL, country TEXT,
        url TEXT NOT NULL, source TEXT NOT NULL, posted_date TEXT,
        tags TEXT NOT NULL, categories TEXT NOT NULL, first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL, fetched_at TEXT NOT NULL
      );
      INSERT INTO jobs VALUES ('old','1','Intern','Acme','Berlin','DE',
        'https://example.com','adzuna',NULL,'[]','["internship"]',
        '2020-01-01T00:00:00.000Z','2020-01-01T00:00:00.000Z','2020-01-01T00:00:00.000Z');
    `);
    legacy.close();

    const db = openDb(dbPath);
    const cols = (db.prepare("PRAGMA table_info(jobs)").all() as unknown as { name: string }[]).map(
      (c) => c.name,
    );
    const rows = db.prepare("SELECT COUNT(*) as c FROM jobs").get() as { c: number };
    db.close();

    assert.ok(cols.includes("closed_at"), "closed_at should be added by migrate()");
    assert.equal(rows.c, 1, "existing rows must survive the migration");
  });
});

test("an archived listing that gets reposted leaves the archive", () => {
  withTempDb((dbPath) => {
    const listing = job({
      id: "repost",
      company: "Databricks",
      fetchedAt: "2020-01-01T00:00:00.000Z",
    });
    storeJobs([listing], dbPath);
    assert.equal(pruneStale(7, dbPath).archived, 1);

    // Same listing seen again on a later run -- it's live, so closed_at clears.
    storeJobs([{ ...listing, fetchedAt: new Date().toISOString() }], dbPath);

    const db = openDb(dbPath);
    const row = db.prepare("SELECT closed_at FROM jobs WHERE id = 'repost'").get() as {
      closed_at: string | null;
    };
    db.close();
    assert.equal(row.closed_at, null);
  });
});

test("pruneStale does not re-stamp an already-archived listing", () => {
  withTempDb((dbPath) => {
    const stale = job({
      id: "once",
      company: "Palantir",
      fetchedAt: "2020-01-01T00:00:00.000Z",
    });
    storeJobs([stale], dbPath);
    pruneStale(7, dbPath);

    const db = openDb(dbPath);
    const first = (db.prepare("SELECT closed_at FROM jobs WHERE id = 'once'").get() as {
      closed_at: string;
    }).closed_at;
    db.close();

    // A second run must be a no-op: closed_at is the date it *closed*, so
    // re-stamping would make every archived listing look freshly closed.
    const { archived } = pruneStale(7, dbPath);
    assert.equal(archived, 0);

    const db2 = openDb(dbPath);
    const second = (db2.prepare("SELECT closed_at FROM jobs WHERE id = 'once'").get() as {
      closed_at: string;
    }).closed_at;
    db2.close();
    assert.equal(second, first);
  });
});
