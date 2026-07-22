# EU Tech Internship Radar

**A daily-refreshing tracker of internship & working-student listings across major European tech
hubs** — Berlin, Munich, Amsterdam, Dublin, London, Paris, Stockholm, Helsinki, Tallinn, Warsaw,
Barcelona, Lisbon, and Zurich.

### 🔗 [**View the live site → handcraftedbygod.github.io/eu-tech-internship-radar**](https://handcraftedbygod.github.io/eu-tech-internship-radar/)

No sign-up, nothing to install — click the link above and the current listings are already there,
refreshed automatically every day.

![Screenshot of the dark-mode UI, showing the search bar, role/hub filter chips, and a sortable table of internship listings](docs/screenshot-dark.png)

No hardcoded assumptions about nationality, visa status, or language — every filter lives in
`config/` and is editable by anyone, not just the person who built this.

Data comes only from public, ToS-friendly sources: Greenhouse/Lever/Ashby/Workday's public job
board APIs for a curated list of companies, plus the Adzuna, Arbeitnow, and Remotive job APIs. No
scraping of LinkedIn/Indeed or any site that disallows it.

This is project 1 of a family of trackers that will share the same pipeline and job schema (a
new-grad SWE tracker, an AI new-grad tracker, and "Hireflow"). The fetcher interface and schema are
designed so those are config changes, not rewrites — see "How the schema generalizes" below.

## How it works

```
fetchers/  →  pipeline/filter.ts  →  pipeline/dedupe.ts  →  pipeline/store.ts  →  pipeline/export.ts
(one file    (keyword + location     (collapse by id)      (SQLite upsert,       (SQLite → web/data/jobs.json)
per source)   + recency filter,                              first-seen kept)
              all from config/)
```

`pipeline/run.ts` runs all of the above in order, prints a per-source summary, and writes
`pipeline-summary.md` (also appended to the GitHub Actions job summary in CI).

Each fetcher never throws - a dead or failing source reports an error but returns whatever jobs it
did get, so one bad source can't break the run.

## Configuring filters (no code changes needed)

- **Keywords** — `config/keywords.json`. Add/remove words in `lists.internship.include` or
  `exclude`. Matching is case-insensitive, whole-word, **title-only** (not the full description —
  ATS benefits boilerplate like "not available for interns/working students" appears on unrelated
  roles, so scanning descriptions causes false positives).
- **Locations** — `config/locations.json`. Add/remove hubs, aliases, or toggle `allowRemoteGlobal`
  to include/exclude remote-eligible listings.
- **Companies polled via ATS APIs** — `config/companies.json`. See "Adding a company" below.
- **How old a listing can be** — `config/settings.json` → `maxAgeDays` (default 7, to keep the
  list to current capacity). Jobs whose source doesn't report a parseable date are kept, since
  their age can't be verified.

## Adding a company

Add one entry to `config/companies.json`. The required fields depend on the ATS:

```jsonc
{ "name": "Example Co", "source": "greenhouse", "boardToken": "examplecoslug" }
{ "name": "Example Co", "source": "lever", "company": "examplecoslug" }
{ "name": "Example Co", "source": "ashby", "companyName": "examplecoslug" }
{ "name": "Example Co", "source": "workday", "endpointUrl": "https://<tenant>.wdN.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs" }
```

The starter list is a curated, **not live-verified** set of ~40 companies known to use these
platforms — a wrong slug just makes that one company 404 for a run (visible in
`pipeline-summary.md`), it won't break anything else.

## Adding a new source

Add one file to `fetchers/` that default-exports a function matching the `Fetcher` type in
`fetchers/types.ts` (`() => Promise<{ source, jobs, error? }>`), then add it to the array in
`fetchers/index.ts`. It must catch its own errors — never let it throw.

## How the schema generalizes (for the other 3 planned projects)

`types/job.ts`'s `Job` has no `is_internship` boolean. Instead it has `categories: string[]`,
populated from whichever named lists in `config/keywords.json` matched. Project 1 only ever
produces `["internship"]`. A future new-grad or AI-jobs tracker adds a new key to
`keywords.json.lists` (e.g. `"new-grad"`) and gets a second category — with zero changes to
fetchers or pipeline code. Fetchers, config for companies/locations, storage, and the pipeline
orchestration are all reusable as-is.

## Frontend

Plain HTML/CSS/JS, no framework, no build step. Dark is the default theme (falls back to your
system preference on first visit), with a toggle in the header that remembers your choice via
`localStorage`. Typography is [Geist](https://vercel.com/font) throughout. Quick filter chips for
common role categories (Software Engineering, Data & Analytics, Product & Design, Business &
Marketing) and for hub sit above a sortable, searchable table — everything reads from the single
generated `web/data/jobs.json` file, so the whole frontend is static and cacheable.

## Running locally

```bash
npm ci
cp .env.example .env   # fill in ADZUNA_APP_ID / ADZUNA_APP_KEY (https://developer.adzuna.com/)
npm run pipeline       # fetch → filter → dedupe → store → export
npx serve web          # or: python -m http.server --directory web
```

Other scripts: `npm test` (filter/dedupe unit tests), `npm run typecheck`.

## Deployment

Two GitHub Actions workflows:
- `.github/workflows/pipeline.yml` — runs daily (04:00 UTC) and on manual dispatch, runs the
  pipeline, commits the updated `data/jobs.db` and `web/data/jobs.json` to `main`.
- `.github/workflows/pages.yml` — triggered on any push to `main` touching `web/**`, deploys
  `web/` to GitHub Pages.

Repo secrets `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` must be set (`gh secret set ADZUNA_APP_ID`, etc.)
for the Adzuna fetcher to run in CI; other sources work without them.
