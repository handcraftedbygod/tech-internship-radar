# Contributing

Most useful contributions don't touch code:

- **A wrong or dead company slug** — edit `config/companies.json` and open a PR.
  See "Configuring" in the README for the field format per ATS.
- **A missing hub, alias, or keyword** — edit `config/locations.json` or
  `config/keywords.json`.
- **A new job source** — add one file to `fetchers/` implementing the
  `Fetcher` type, then register it in `fetchers/index.ts`. It must catch its
  own errors; see the README's "How it works" section.

For anything else, open an issue first if the change is more than a couple of
lines — saves both of us a rewritten PR.

## Running locally

```bash
npm ci
npm run pipeline   # fetch -> filter -> dedupe -> store -> export
npm test           # filter/dedupe unit tests
npm run typecheck
npx serve web       # preview the frontend against whatever web/data/jobs.json has
```

PRs run `npm test` and `npm run typecheck` in CI; both must pass.
