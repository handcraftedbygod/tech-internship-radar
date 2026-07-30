import { writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { fetchAll } from "./fetch.ts";
import { filterJobs } from "./filter.ts";
import { dedupe } from "./dedupe.ts";
import { storeJobs, pruneStale } from "./store.ts";
import { exportJson } from "./export.ts";
import { loadKeywords, loadLocations, loadSettings, loadTiers } from "../config/load.ts";

async function main() {
  const { results, jobs: rawJobs } = await fetchAll();
  const keywords = loadKeywords();
  const locations = loadLocations();
  const settings = loadSettings();
  const { archiveTiers, tiers } = loadTiers();

  const filtered = filterJobs(rawJobs, keywords, locations, settings);
  const deduped = dedupe(filtered);
  storeJobs(deduped);
  // Only the gated tiers survive pruning as archived "Missed It" rows.
  const archiveNames = tiers.filter((t) => archiveTiers.includes(t.id)).flatMap((t) => t.names);
  const { deleted, archived } = pruneStale(settings.maxAgeDays, undefined, archiveNames);
  const exportedCount = exportJson();

  const summaryLines = [
    "## Pipeline run summary",
    "",
    "| Source | Jobs fetched | Error |",
    "| --- | --- | --- |",
    ...results.map((r) => `| ${r.source} | ${r.jobs.length} | ${r.error ?? "-"} |`),
    "",
    `Matched internships after filter+dedupe: **${deduped.length}** (pruned stale: ${deleted}, archived: ${archived}, exported: ${exportedCount})`,
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
