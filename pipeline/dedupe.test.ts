import { test } from "node:test";
import assert from "node:assert/strict";
import { dedupe } from "./dedupe.ts";
import type { Job } from "../types/job.ts";

function job(overrides: Partial<Job>): Job {
  return {
    id: "id-1",
    externalId: "1",
    title: "Intern",
    company: "Acme",
    location: "Berlin",
    country: "DE",
    url: "https://example.com/job/1",
    source: "test",
    postedDate: null,
    tags: ["intern"],
    categories: ["internship"],
    fetchedAt: "2026-01-01T00:00:00.000Z",
    firstSeenAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("collapses jobs with the same id, keeping the first", () => {
  const result = dedupe([job({ id: "a" }), job({ id: "a", title: "Duplicate" })]);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Intern");
});

test("keeps distinct jobs with different ids", () => {
  const result = dedupe([job({ id: "a" }), job({ id: "b" })]);
  assert.equal(result.length, 2);
});
