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
    "new-grad": {
      include: ["new grad", "entry level", "graduate program"],
    },
    junior: {
      include: ["junior"],
      exclude: ["junior partner"],
    },
  },
  techGate: {
    include: ["software", "developer", "data engineer"],
  },
};

const locations: LocationsConfig = {
  hubs: [{ city: "Berlin", country: "DE", adzunaCountry: "de", aliases: ["Berlin", "Germany"] }],
  allowRemoteGlobal: true,
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

test("skips a raw job with no title instead of crashing the whole run", () => {
  const malformed = job({ title: "Software Engineering Intern" });
  // @ts-expect-error simulating a malformed API response, not a valid RawJob
  malformed.title = undefined;
  const result = filterJobs([malformed, job({ title: "Praktikum" })], keywords, locations, settings);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Praktikum");
});

test("skips a raw job with a blank company (breaks its company-page link otherwise)", () => {
  const result = filterJobs(
    [job({ title: "Software Engineering Intern", company: "" }), job({ title: "Praktikum", company: "  " })],
    keywords,
    locations,
    settings,
  );
  assert.equal(result.length, 0);
});

test("drops known templated-spam companies regardless of source, even with an otherwise-matching title", () => {
  const result = filterJobs(
    [
      job({ title: "Software Engineering Intern", company: "IT Career Switch", source: "reed" }),
      job({ title: "Software Engineering Intern", company: "ITOL Recruit", source: "freehire" }),
      job({ title: "Software Engineering Intern", company: "NEWTO TRAINING LIMITED", source: "freehire" }),
      job({ title: "Software Engineering Intern", company: "Acme" }),
    ],
    keywords,
    locations,
    settings,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].company, "Acme");
});

test("matches the new-grad category independently of internship", () => {
  const result = filterJobs(
    [job({ title: "Software Engineer, New Grad Program" })],
    keywords,
    locations,
    settings,
  );
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].categories, ["new-grad"]);
});

test("a title can match both internship and new-grad categories", () => {
  const result = filterJobs(
    [job({ title: "Graduate Program Intern" })],
    keywords,
    locations,
    settings,
  );
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].categories.sort(), ["internship", "new-grad"]);
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

test("keeps remote-EU jobs when allowRemoteGlobal is true", () => {
  const result = filterJobs(
    [job({ title: "Praktikum", location: "Remote, Europe" })],
    keywords,
    locations,
    settings,
  );
  assert.equal(result.length, 1);
});

test("keeps remote-North America jobs when allowRemoteGlobal is true", () => {
  const result = filterJobs(
    [job({ title: "Praktikum", location: "Remote, USA" })],
    keywords,
    locations,
    settings,
  );
  assert.equal(result.length, 1);
});

test("keeps a bare 'Remote' location with no country/region qualifier", () => {
  const result = filterJobs(
    [job({ title: "Praktikum", location: "Remote" })],
    keywords,
    locations,
    settings,
  );
  assert.equal(result.length, 1);
});

test("keeps a bare 'Canada' location with no city", () => {
  const result = filterJobs(
    [job({ title: "Praktikum", location: "Canada" })],
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

test("detects a hiring-cycle season from the title", () => {
  const result = filterJobs(
    [job({ title: "Summer 2027 Software Engineering Intern" })],
    keywords,
    locations,
    settings,
  );
  assert.equal(result[0].season, "Summer 2027");
});

test("leaves season undefined when the title has no season+year", () => {
  const result = filterJobs([job({ title: "Software Engineering Intern" })], keywords, locations, settings);
  assert.equal(result[0].season, undefined);
});

test("normalizes season capitalization regardless of title casing", () => {
  const result = filterJobs(
    [job({ title: "intern - SUMMER 2027 cohort" })],
    keywords,
    locations,
    settings,
  );
  assert.equal(result[0].season, "Summer 2027");
});

test("flags advanced-degree requirement from the title", () => {
  const result = filterJobs([job({ title: "PhD Research Intern" })], keywords, locations, settings);
  assert.equal(result[0].advancedDegree, true);
});

test("does not flag bare 'Master' (e.g. Scrum Master) as an advanced-degree requirement", () => {
  const result = filterJobs([job({ title: "Scrum Master Intern" })], keywords, locations, settings);
  assert.equal(result[0].advancedDegree, undefined);
});

test("flags Master's degree requirement from the title", () => {
  const result = filterJobs([job({ title: "Master's Thesis Intern" })], keywords, locations, settings);
  assert.equal(result[0].advancedDegree, true);
});

test("drops a non-tech internship from a broad job board (e.g. nursing)", () => {
  const result = filterJobs(
    [job({ title: "Registered Nurse I - Nursing Internship", source: "adzuna" })],
    keywords,
    locations,
    settings,
  );
  assert.equal(result.length, 0);
});

test("keeps a tech internship from a broad job board", () => {
  const result = filterJobs(
    [job({ title: "Software Engineering Intern", source: "adzuna" })],
    keywords,
    locations,
    settings,
  );
  assert.equal(result.length, 1);
});

test("skips the tech gate for curated ATS sources (already a hand-picked tech company list)", () => {
  const result = filterJobs(
    [job({ title: "People Operations Intern", source: "greenhouse" })],
    keywords,
    locations,
    settings,
  );
  assert.equal(result.length, 1);
});

test("matches the junior category on a tech title", () => {
  const result = filterJobs(
    [job({ title: "Junior Software Developer", source: "greenhouse" })],
    keywords,
    locations,
    settings,
  );
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].categories, ["junior"]);
});

test("excludes 'Junior Partner' from the junior category (a senior title, not entry-level)", () => {
  const result = filterJobs(
    [job({ title: "Junior Partner", source: "greenhouse" })],
    keywords,
    locations,
    settings,
  );
  assert.equal(result.length, 0);
});

test("junior postings from broad job boards still need the tech gate", () => {
  const result = filterJobs(
    [job({ title: "Junior Account Manager", source: "adzuna" })],
    keywords,
    locations,
    settings,
  );
  assert.equal(result.length, 0);
});
