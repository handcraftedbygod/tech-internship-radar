import { test } from "node:test";
import assert from "node:assert/strict";
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

test("pruneStale deletes rows not re-seen within maxAgeDays", () => {
  withTempDb((dbPath) => {
    const stale = job({ id: "stale", fetchedAt: "2020-01-01T00:00:00.000Z" });
    storeJobs([stale], dbPath);

    const deleted = pruneStale(7, dbPath);
    assert.equal(deleted, 1);

    const db = openDb(dbPath);
    const remaining = db.prepare("SELECT COUNT(*) as c FROM jobs").get() as { c: number };
    db.close();
    assert.equal(remaining.c, 0);
  });
});

test("pruneStale keeps rows re-seen within maxAgeDays", () => {
  withTempDb((dbPath) => {
    const fresh = job({ id: "fresh", fetchedAt: new Date().toISOString() });
    storeJobs([fresh], dbPath);

    const deleted = pruneStale(7, dbPath);
    assert.equal(deleted, 0);

    const db = openDb(dbPath);
    const remaining = db.prepare("SELECT COUNT(*) as c FROM jobs").get() as { c: number };
    db.close();
    assert.equal(remaining.c, 1);
  });
});
