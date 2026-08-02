import { writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fetchAll } from "./fetch.ts";
import { filterJobs } from "./filter.ts";
import { dedupe } from "./dedupe.ts";
import { storeJobs, pruneStale } from "./store.ts";
import { exportJson } from "./export.ts";
import { fetchYcHiring } from "./ycHiring.ts";
import { loadKeywords, loadLocations, loadSettings } from "../config/load.ts";

const YC_OUT_PATH = path.join(import.meta.dirname, "..", "web", "data", "yc.json");

async function main() {
  const { results, jobs: rawJobs } = await fetchAll();
  const keywords = loadKeywords();
  const locations = loadLocations();
  const settings = loadSettings();

  const filtered = filterJobs(rawJobs, keywords, locations, settings);
  const deduped = dedupe(filtered);
  storeJobs(deduped);
  const { archived } = pruneStale(settings.maxAgeDays);
  const exportedCount = exportJson();

  const yc = await fetchYcHiring();
  mkdirSync(path.dirname(YC_OUT_PATH), { recursive: true });
  writeFileSync(YC_OUT_PATH, JSON.stringify(yc.companies, null, 2));

  const summaryLines = [
    "## Pipeline run summary",
    "",
    "| Source | Jobs fetched | Error |",
    "| --- | --- | --- |",
    ...results.map((r) => `| ${r.source} | ${r.jobs.length} | ${r.error ?? "-"} |`),
    "",
    `Matched internships after filter+dedupe: **${deduped.length}** (archived: ${archived}, exported: ${exportedCount})`,
    `YC startups hiring (Europe): **${yc.companies.length}**${yc.error ? ` (error: ${yc.error})` : ""}`,
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
