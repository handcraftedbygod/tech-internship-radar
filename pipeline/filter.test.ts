import { test } from "node:test";
import assert from "node:assert/strict";
import { filterJobs } from "./filter.ts";
import type { RawJob } from "../types/job.ts";
import type { KeywordsConfig, LocationsConfig, SettingsConfig } from "../config/load.ts";

const keywords: KeywordsConfig = {
  lists: {
    internship: {
      include: ["intern", "praktikum"],
      exclude: ["senior intern coordinator"],
    },
  },
};

const locations: LocationsConfig = {
  hubs: [{ city: "Berlin", country: "DE", adzunaCountry: "de", aliases: ["Berlin", "Germany"] }],
  allowRemoteEU: true,
};

const settings: SettingsConfig = { maxAgeDays: 7 };

function job(overrides: Partial<RawJob>): RawJob {
  return {
    externalId: "1",
    title: "Software Engineer",
    company: "Acme",
    location: "Berlin, Germany",
    country: null,
    url: "https://example.com/job/1",
    source: "test",
    postedDate: null,
    ...overrides,
  };
}

test("matches keyword include and location hub", () => {
  const result = filterJobs(
    [job({ title: "Software Engineering Intern" })],
    keywords,
    locations,
    settings,
  );
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].categories, ["internship"]);
});

test("excludes jobs matching an exclude phrase", () => {
  const result = filterJobs(
    [job({ title: "Senior Intern Coordinator" })],
    keywords,
    locations,
    settings,
  );
  assert.equal(result.length, 0);
});

test("does not false-positive match 'intern' inside 'international'", () => {
  const result = filterJobs(
    [job({ title: "International Sales Associate" })],
    keywords,
    locations,
    settings,
  );
  assert.equal(result.length, 0);
});

test("ignores keyword matches in descriptionText (title-only matching)", () => {
  // e.g. ATS benefits boilerplate: "not available for interns/working students"
  // shows up on unrelated roles' descriptions — must not categorize on that.
  const result = filterJobs(
    [
      job({
        title: "Senior Backend Engineer",
        descriptionText: "Pension scheme (not available for interns/working students).",
      }),
    ],
    keywords,
    locations,
    settings,
  );
  assert.equal(result.length, 0);
});

test("drops jobs with no keyword match", () => {
  const result = filterJobs([job({ title: "Software Engineer" })], keywords, locations, settings);
  assert.equal(result.length, 0);
});

test("drops jobs outside configured hubs and not remote-EU", () => {
  const result = filterJobs(
    [job({ title: "Praktikum", location: "Tokyo, Japan" })],
    keywords,
    locations,
    settings,
  );
  assert.equal(result.length, 0);
});

test("keeps remote-EU jobs when allowRemoteEU is true", () => {
  const result = filterJobs(
    [job({ title: "Praktikum", location: "Remote, Europe" })],
    keywords,
    locations,
    settings,
  );
  assert.equal(result.length, 1);
});

test("drops jobs older than settings.maxAgeDays", () => {
  const staleDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const result = filterJobs(
    [job({ title: "Praktikum", postedDate: staleDate })],
    keywords,
    locations,
    settings,
  );
  assert.equal(result.length, 0);
});

test("keeps jobs within settings.maxAgeDays", () => {
  const freshDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const result = filterJobs(
    [job({ title: "Praktikum", postedDate: freshDate })],
    keywords,
    locations,
    settings,
  );
  assert.equal(result.length, 1);
});

test("keeps jobs with a missing postedDate (can't verify age)", () => {
  const result = filterJobs(
    [job({ title: "Praktikum", postedDate: null })],
    keywords,
    locations,
    settings,
  );
  assert.equal(result.length, 1);
});
