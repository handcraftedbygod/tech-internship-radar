import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWeeklyReport } from "./weeklyReport.ts";

const NOW = new Date("2026-08-09T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * DAY).toISOString();
}

function row(
  overrides: Partial<{
    company: string;
    location: string;
    title: string;
    url: string;
    categories: string[];
    advanced_degree: number | null;
    first_seen_at: string;
  }>,
) {
  return {
    company: "Acme",
    location: "Berlin",
    title: "Software Engineering Intern",
    url: "https://example.com/job/1",
    categories: ["internship"],
    advanced_degree: null,
    first_seen_at: daysAgo(1),
    ...overrides,
  };
}

test("buildWeeklyReport counts rows in the trailing 7-day window as newCount", () => {
  const rows = [row({ first_seen_at: daysAgo(1) }), row({ first_seen_at: daysAgo(6) }), row({ first_seen_at: daysAgo(10) })];
  const report = buildWeeklyReport(rows, {}, [], undefined, NOW);
  assert.equal(report.newCount, 2);
});

test("buildWeeklyReport counts the prior 7-14 day window as prevWeekCount", () => {
  const rows = [row({ first_seen_at: daysAgo(1) }), row({ first_seen_at: daysAgo(9) }), row({ first_seen_at: daysAgo(13) })];
  const report = buildWeeklyReport(rows, {}, [], undefined, NOW);
  assert.equal(report.prevWeekCount, 2);
});

test("buildWeeklyReport computes pctChange relative to the prior week", () => {
  const rows = [row({ first_seen_at: daysAgo(1) }), row({ first_seen_at: daysAgo(2) }), row({ first_seen_at: daysAgo(9) })];
  const report = buildWeeklyReport(rows, {}, [], undefined, NOW);
  assert.equal(report.newCount, 2);
  assert.equal(report.prevWeekCount, 1);
  assert.equal(report.pctChange, 100);
});

test("buildWeeklyReport treats a zero prior week as +100% when there's any growth, 0% when flat", () => {
  const grew = buildWeeklyReport([row({ first_seen_at: daysAgo(1) })], {}, [], undefined, NOW);
  assert.equal(grew.pctChange, 100);

  const flat = buildWeeklyReport([], {}, [], undefined, NOW);
  assert.equal(flat.pctChange, 0);
});

test("buildWeeklyReport tallies topHubs and topCompanies for the current week only", () => {
  const rows = [
    row({ location: "Berlin", company: "Acme", first_seen_at: daysAgo(1) }),
    row({ location: "Berlin", company: "Acme", first_seen_at: daysAgo(2) }),
    row({ location: "Madrid", company: "Beta", first_seen_at: daysAgo(3) }),
    // Outside the window -- must not count.
    row({ location: "Berlin", company: "Acme", first_seen_at: daysAgo(20) }),
  ];
  const report = buildWeeklyReport(rows, {}, [], undefined, NOW);
  assert.deepEqual(report.topHubs[0], { hub: "Berlin", count: 2 });
  assert.equal(report.topCompanies[0].name, "Acme");
  assert.equal(report.topCompanies[0].count, 2);
});

test("buildWeeklyReport excludes a discipline from fastestGrowingDiscipline below the minimum-N floor", () => {
  // 1 -> 2 postings is a "+100%" swing but far too small a sample to headline.
  const rows = [
    row({ title: "Product Manager Intern", first_seen_at: daysAgo(1) }),
    row({ title: "Product Manager Intern", first_seen_at: daysAgo(9) }),
    // Software has enough volume to clear the floor but a smaller % jump.
    row({ title: "Software Engineering Intern", first_seen_at: daysAgo(1) }),
    row({ title: "Software Engineering Intern", first_seen_at: daysAgo(2) }),
    row({ title: "Software Engineering Intern", first_seen_at: daysAgo(3) }),
    row({ title: "Software Engineering Intern", first_seen_at: daysAgo(9) }),
    row({ title: "Software Engineering Intern", first_seen_at: daysAgo(10) }),
  ];
  const report = buildWeeklyReport(rows, {}, [], undefined, NOW);
  assert.equal(report.fastestGrowingDiscipline?.id, "swe");
});

test("buildWeeklyReport returns null fastestGrowingDiscipline when nothing clears the floor", () => {
  const rows = [row({ title: "Product Manager Intern", first_seen_at: daysAgo(1) })];
  const report = buildWeeklyReport(rows, {}, [], undefined, NOW);
  assert.equal(report.fastestGrowingDiscipline, null);
});

test("buildWeeklyReport applies company aliases when tallying topCompanies", () => {
  const rows = [
    row({ company: "Facebook Inc", first_seen_at: daysAgo(1) }),
    row({ company: "Meta", first_seen_at: daysAgo(2) }),
  ];
  const report = buildWeeklyReport(rows, { facebook: "Meta" }, [], undefined, NOW);
  assert.equal(report.topCompanies.length, 1);
  assert.equal(report.topCompanies[0].count, 2);
});

const TIERS = [
  { id: "elite", mult: 1.35, names: ["Meta", "Google"] },
  { id: "notable", mult: 1.15, names: ["Wise"] },
];

test("buildWeeklyReport tallies notableHiring with the FAANG/NOTABLE badge split", () => {
  const rows = [
    row({ company: "Meta", first_seen_at: daysAgo(1) }),
    row({ company: "Meta", first_seen_at: daysAgo(2) }),
    row({ company: "Wise", first_seen_at: daysAgo(1) }),
    row({ company: "NotTracked Inc", first_seen_at: daysAgo(1) }),
  ];
  const report = buildWeeklyReport(rows, {}, TIERS, undefined, NOW);
  assert.deepEqual(
    report.notableHiring.map((c) => [c.name, c.badge, c.count]),
    [
      ["Meta", "FAANG", 2],
      ["Wise", "NOTABLE", 1],
    ],
  );
});

test("buildWeeklyReport does not false-positive tier-match a company name substring", () => {
  // "Innowise" contains "Wise" as a substring but is not Wise -- word-boundary
  // matching in tierForCompany() must keep it out of notableHiring.
  const rows = [row({ company: "Innowise", first_seen_at: daysAgo(1) })];
  const report = buildWeeklyReport(rows, {}, TIERS, undefined, NOW);
  assert.equal(report.notableHiring.length, 0);
});

const PAY_TIERS = [{ id: "trading", mult: 2.0, names: ["DRW"] }];

test("buildWeeklyReport picks the highest-usdMid listing as topPay, not the highest raw base", () => {
  const rows = [
    // San Francisco has the higher base rate (45 vs 33) but no tier multiplier.
    row({ company: "Generic Co", location: "San Francisco", url: "https://example.com/sf" }),
    // Zurich's lower base is more than offset by DRW's trading-tier 2x multiplier.
    row({ company: "DRW", location: "Zurich", url: "https://example.com/zurich" }),
  ];
  const report = buildWeeklyReport(rows, {}, PAY_TIERS, undefined, NOW);
  assert.equal(report.topPay?.company, "DRW");
  assert.equal(report.topPay?.hub, "Zurich");
  assert.equal(report.topPay?.currency, "eur");
  assert.equal(report.topPay?.url, "https://example.com/zurich");
});

test("buildWeeklyReport returns null topPay when there are no rows this week", () => {
  const report = buildWeeklyReport([], {}, [], undefined, NOW);
  assert.equal(report.topPay, null);
});

test("buildWeeklyReport passes ycHiring through unchanged, defaulting to zero", () => {
  const withYc = buildWeeklyReport([], {}, [], { europe: 12, northAmerica: 8 }, NOW);
  assert.deepEqual(withYc.ycHiring, { europe: 12, northAmerica: 8 });

  const withoutYc = buildWeeklyReport([], {}, [], undefined, NOW);
  assert.deepEqual(withoutYc.ycHiring, { europe: 0, northAmerica: 0 });
});
