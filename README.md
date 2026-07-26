# Tech Internship Radar

[![CI](https://github.com/handcraftedbygod/tech-internship-radar/actions/workflows/ci.yml/badge.svg)](https://github.com/handcraftedbygod/tech-internship-radar/actions/workflows/ci.yml)
[![Live Site](https://img.shields.io/badge/live%20site-view-2ea44f?style=flat-square)](https://handcraftedbygod.github.io/tech-internship-radar/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

Daily-refreshing tracker of internship, new-grad, and junior listings across European and North American tech hubs. No sign-up, nothing to install.

## Features

- **Internships, New Grad, and Junior in one place.** A single toggle switches the whole view.
- Freshness badges, hiring-cycle tags (e.g. "Summer 2027 🔥"), notable-company (🏆) and advanced-degree (🎓) badges, all auto-detected from job titles.
- Bookmarks and "new since last visit," stored locally. No login, no backend.
- RSS feed (`feed.xml`).
- Every hub, keyword, and company lives in `config/`, so additions are data changes, not code.
- Sources: Greenhouse, Lever, Ashby, and Workday's public job board APIs for a curated company list, plus the Adzuna, Arbeitnow, and Remotive job APIs.

## How it works

```
fetchers/  →  pipeline/filter.ts  →  pipeline/dedupe.ts  →  pipeline/store.ts  →  pipeline/export.ts
(one file      (keyword + location      (collapse by id)      (SQLite upsert)       (SQLite → jobs.json,
per source)     + recency + season,                                                  meta.json, feed.xml)
                all from config/)
```

Each fetcher never throws. A dead or failing source reports an error but returns whatever jobs it did get, so one bad source can't break the run.

## Configuring

- **Keywords**: `config/keywords.json` (title-only matching, to avoid ATS boilerplate false positives)
- **Hubs & remote eligibility**: `config/locations.json`
- **Companies**: `config/companies.json`
  ```jsonc
  { "name": "Example Co", "source": "greenhouse", "boardToken": "examplecoslug" }
  { "name": "Example Co", "source": "lever", "company": "examplecoslug" }
  { "name": "Example Co", "source": "ashby", "companyName": "examplecoslug" }
  { "name": "Example Co", "source": "workday", "endpointUrl": "https://<tenant>.wdN.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs" }
  ```
  A wrong slug just 404s that one company for a run (visible in `pipeline-summary.md`).
- **Max listing age**: `config/settings.json` → `maxAgeDays` (default 7)

## Running locally

```bash
npm ci
cp .env.example .env   # optionally fill in ADZUNA_APP_ID / ADZUNA_APP_KEY
npm run pipeline       # fetch → filter → dedupe → store → export
npx serve web
```

`npm test` / `npm run typecheck` for the rest.

## License

[MIT](LICENSE)
