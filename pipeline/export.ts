import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { openDb } from "./store.ts";

const OUT_PATH = path.join(import.meta.dirname, "..", "web", "data", "jobs.json");

interface JobRow {
  id: string;
  title: string;
  company: string;
  location: string;
  country: string | null;
  url: string;
  source: string;
  posted_date: string | null;
  tags: string;
  categories: string;
  first_seen_at: string;
}

export function exportJson(): number {
  const db = openDb();
  try {
    const rows = db.prepare("SELECT * FROM jobs").all() as unknown as JobRow[];
    const internships = rows
      .filter((row) => (JSON.parse(row.categories) as string[]).includes("internship"))
      .map((row) => ({
        id: row.id,
        title: row.title,
        company: row.company,
        location: row.location,
        country: row.country,
        url: row.url,
        source: row.source,
        postedDate: row.posted_date,
        tags: JSON.parse(row.tags) as string[],
        firstSeenAt: row.first_seen_at,
      }));

    mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    writeFileSync(OUT_PATH, JSON.stringify(internships, null, 2));
    return internships.length;
  } finally {
    db.close();
  }
}
