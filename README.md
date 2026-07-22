# Tech Internship Radar

[![CI](https://github.com/handcraftedbygod/tech-internship-radar/actions/workflows/ci.yml/badge.svg)](https://github.com/handcraftedbygod/tech-internship-radar/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Daily-refreshing tracker of internship & working-student listings across European and North
American tech hubs.

### 🔗 [**View the live site → handcraftedbygod.github.io/tech-internship-radar**](https://handcraftedbygod.github.io/tech-internship-radar/)

No sign-up, nothing to install.

![Screenshot of the dark-mode UI, showing the search bar, role/hub/season filter chips, and a sortable table of internship listings](docs/screenshot-dark.png)

## Features

- Freshness badges, hiring-cycle tags (e.g. "Summer 2027"), notable-company (🏆) and
  advanced-degree (🎓) badges — all auto-detected straight from job titles, no manual curation.
- Bookmarks and "new since last visit," both local via `localStorage` — no login, no backend.
- RSS feed (`feed.xml`).
- Every hub, keyword, and company lives in `config/` — additions are data changes, not code.
- Sources: Greenhouse/Lever/Ashby/Workday's public job board APIs for a curated company list,
  plus the Adzuna, Arbeitnow, and Remotive job APIs.

## How it works

```
fetchers/  →  pipeline/filter.ts  →  pipeline/dedupe.ts  →  pipeline/store.ts  →  pipeline/export.ts
(one file    (keyword + location     (collapse by id)      (SQLite upsert)       (SQLite → jobs.json,
per source)   + recency + season,                                                 meta.json, feed.xml)
              all from config/)
```

Each fetcher never throws — a dead or failing source reports an error but returns whatever jobs it
did get, so one bad source can't break the run.

## Configuring

- **Keywords** — `config/keywords.json` (title-only matching, to avoid ATS boilerplate false
  positives).
- **Hubs & remote eligibility** — `config/locations.json`.
- **Companies** — `config/companies.json`:
  ```jsonc
  { "name": "Example Co", "source": "greenhouse", "boardToken": "examplecoslug" }
  { "name": "Example Co", "source": "lever", "company": "examplecoslug" }
  { "name": "Example Co", "source": "ashby", "companyName": "examplecoslug" }
  { "name": "Example Co", "source": "workday", "endpointUrl": "https://<tenant>.wdN.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs" }
  ```
  A wrong slug just 404s that one company for a run (visible in `pipeline-summary.md`).
- **Max listing age** — `config/settings.json` → `maxAgeDays` (default 7).

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
