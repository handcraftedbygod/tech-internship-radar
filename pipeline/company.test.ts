import { test } from "node:test";
import assert from "node:assert/strict";
import { companySlug, hubFor, disciplineFor, buildCompanySummaries, type CompanyJobRow } from "./company.ts";
import type { CompanyTier } from "../config/load.ts";

test("companySlug lowercases and normalizes separators", () => {
  assert.equal(companySlug("Acme"), "acme");
  assert.equal(companySlug("  Acme  "), "acme");
});

test("companySlug is the same regardless of casing", () => {
  assert.equal(companySlug("ACME"), companySlug("acme"));
  assert.equal(companySlug("Acme Corp"), companySlug("acme corp"));
});

test("companySlug strips common legal suffixes", () => {
  assert.equal(companySlug("Acme Inc"), "acme");
  assert.equal(companySlug("Acme Inc."), "acme");
  assert.equal(companySlug("Acme GmbH"), "acme");
  assert.equal(companySlug("Acme Ltd"), "acme");
  assert.equal(companySlug("Acme AG"), "acme");
  assert.equal(companySlug("Acme B.V."), "acme");
  assert.equal(companySlug("Acme SE"), "acme");
});

test("companySlug leaves suffix-like substrings mid-name alone", () => {
  // "Cisco" must not lose its trailing "co" -- the suffix pattern only
  // matches a whole trailing word, not any substring.
  assert.equal(companySlug("Cisco"), "cisco");
});

test("companySlug applies an alias override after suffix stripping", () => {
  const aliases = { facebook: "Meta" };
  assert.equal(companySlug("Facebook Inc", aliases), "meta");
  assert.equal(companySlug("Facebook Inc", aliases), companySlug("Meta", aliases));
});

test("companySlug with no aliases passes clean names through unchanged", () => {
  assert.equal(companySlug("Databricks"), "databricks");
});

test("hubFor matches a known city", () => {
  assert.equal(hubFor("Berlin, Germany"), "Berlin");
  assert.equal(hubFor("Madrid, Spain"), "Madrid");
});

test("hubFor does not swallow Madrid into Barcelona via a country-wide alias", () => {
  // config/locations.json's Barcelona carries a "Spain" alias for filter.ts's
  // broader location-gating; hubFor() must not reuse that -- it mirrors
  // app.js's tight city-only tokens instead.
  assert.equal(hubFor("Madrid"), "Madrid");
  assert.notEqual(hubFor("Madrid"), "Barcelona");
});

test("hubFor falls back to Other for an unmatched location", () => {
  assert.equal(hubFor("Bucharest, Romania"), "Other");
});

test("disciplineFor matches known-order-sensitive keywords", () => {
  assert.equal(disciplineFor("Quantitative Developer").id, "quant");
  assert.equal(disciplineFor("Software Engineering Intern").id, "swe");
  assert.equal(disciplineFor("Machine Learning Engineer").id, "ai");
});

test("disciplineFor falls back to swe for an unmatched title", () => {
  assert.equal(disciplineFor("Mystery Role").id, "swe");
});

function row(overrides: Partial<CompanyJobRow>): CompanyJobRow {
  return {
    id: "id-1",
    title: "Software Engineering Intern",
    company: "Acme",
    location: "Berlin",
    url: "https://example.com/job/1",
    first_seen_at: "2026-01-01T00:00:00.000Z",
    closed_at: null,
    ...overrides,
  };
}

const TIERS: CompanyTier[] = [{ id: "elite", mult: 1.35, names: ["acme"] }];

test("buildCompanySummaries groups rows by companySlug and counts open vs. total", () => {
  const rows = [
    row({ id: "a", closed_at: null }),
    row({ id: "b", closed_at: "2026-01-10T00:00:00.000Z" }),
    row({ id: "c", company: "Acme Inc", closed_at: null }),
  ];
  const [summary] = buildCompanySummaries(rows, TIERS, {});
  assert.equal(summary.slug, "acme");
  assert.equal(summary.totalPostings, 3);
  assert.equal(summary.currentOpenings, 2);
  assert.equal(summary.tier, "elite");
});

test("buildCompanySummaries computes average posting duration only from closed rows", () => {
  const rows = [
    row({ id: "a", first_seen_at: "2026-01-01T00:00:00.000Z", closed_at: "2026-01-11T00:00:00.000Z" }),
    row({ id: "b", first_seen_at: "2026-01-01T00:00:00.000Z", closed_at: null }),
  ];
  const [summary] = buildCompanySummaries(rows, TIERS, {});
  assert.equal(summary.avgPostingDurationDays, 10);
});

test("buildCompanySummaries returns null avgPostingDurationDays when nothing has closed", () => {
  const [summary] = buildCompanySummaries([row({})], TIERS, {});
  assert.equal(summary.avgPostingDurationDays, null);
});

test("buildCompanySummaries tallies top locations and disciplines", () => {
  const rows = [
    row({ id: "a", location: "Berlin", title: "Software Engineering Intern" }),
    row({ id: "b", location: "Berlin", title: "Backend Engineer" }),
    row({ id: "c", location: "Madrid", title: "Data Scientist" }),
  ];
  const [summary] = buildCompanySummaries(rows, TIERS, {});
  assert.deepEqual(summary.topLocations[0], { hub: "Berlin", count: 2 });
  assert.equal(summary.topDisciplines.find((d) => d.id === "swe")?.count, 2);
  assert.equal(summary.topDisciplines.find((d) => d.id === "ai")?.count, 1);
});

test("buildCompanySummaries buckets hiringMonths by first-seen calendar month", () => {
  const rows = [
    row({ id: "a", first_seen_at: "2026-01-05T00:00:00.000Z" }),
    row({ id: "b", first_seen_at: "2026-01-20T00:00:00.000Z" }),
    row({ id: "c", first_seen_at: "2026-08-01T00:00:00.000Z" }),
  ];
  const [summary] = buildCompanySummaries(rows, TIERS, {});
  assert.equal(summary.hiringMonths[0], 2);
  assert.equal(summary.hiringMonths[7], 1);
  assert.equal(summary.hiringMonths.reduce((a, b) => a + b, 0), 3);
});
