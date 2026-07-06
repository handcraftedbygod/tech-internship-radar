import { writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { fetchAll } from "./fetch.ts";
import { filterJobs } from "./filter.ts";
import { dedupe } from "./dedupe.ts";
import { storeJobs } from "./store.ts";
import { exportJson } from "./export.ts";
import { loadKeywords, loadLocations, loadSettings } from "../config/load.ts";

async function main() {
  const { results, jobs: rawJobs } = await fetchAll();
  const keywords = loadKeywords();
  const locations = loadLocations();
  const settings = loadSettings();

  const filtered = filterJobs(rawJobs, keywords, locations, settings);
  const deduped = dedupe(filtered);
  storeJobs(deduped);
  const exportedCount = exportJson();

  const summaryLines = [
    "## Pipeline run summary",
    "",
    "| Source | Jobs fetched | Error |",
    "| --- | --- | --- |",
    ...results.map((r) => `| ${r.source} | ${r.jobs.length} | ${r.error ?? "-"} |`),
    "",
    `Matched internships after filter+dedupe: **${deduped.length}** (exported: ${exportedCount})`,
  ];
  const summary = summaryLines.join("\n");

  console.log(summary);
  writeFileSync(path.join(import.meta.dirname, "..", "pipeline-summary.md"), summary + "\n");

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
  }
}

main().catch((err) => {
  console.error("Pipeline run failed:", err);
  process.exitCode = 1;
});
