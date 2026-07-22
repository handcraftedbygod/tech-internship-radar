import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { openDb } from "./store.ts";

const OUT_PATH = path.join(import.meta.dirname, "..", "web", "data", "jobs.json");
const META_PATH = path.join(import.meta.dirname, "..", "web", "data", "meta.json");
const FEED_PATH = path.join(import.meta.dirname, "..", "web", "feed.xml");
const SITE_URL = "https://handcraftedbygod.github.io/tech-internship-radar/";

interface FeedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  firstSeenAt: string;
}

function escapeXml(str: string): string {
  return str.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c] as string,
  );
}

// One RSS item per listing, newest first, capped at 100 -- plenty for a feed
// reader's unread count without the file growing unbounded as history piles up.
function buildFeed(jobs: FeedJob[]): string {
  const items = jobs
    .slice()
    .sort((a, b) => (a.firstSeenAt < b.firstSeenAt ? 1 : -1))
    .slice(0, 100)
    .map(
      (job) => `
  <item>
    <title>${escapeXml(`${job.title} at ${job.company}`)}</title>
    <link>${escapeXml(job.url)}</link>
    <guid isPermaLink="false">${escapeXml(job.id)}</guid>
    <pubDate>${new Date(job.firstSeenAt).toUTCString()}</pubDate>
    <description>${escapeXml(`${job.company} — ${job.location}`)}</description>
  </item>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="feed.xsl"?>
<rss version="2.0">
<channel>
  <title>Tech Internship Radar</title>
  <link>${SITE_URL}</link>
  <description>New internship &amp; working-student listings across European and North American tech hubs</description>
${items}
</channel>
</rss>
`;
}

interface JobRow {
  id: string;
  title: string;
  company: string;
  location: string;
  country: string | null;
  url: string;
  source: string;
  posted_date: string | null;
  season: string | null;
  advanced_degree: number | null;
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
        season: row.season ?? undefined,
        advancedDegree: row.advanced_degree ? true : undefined,
        tags: JSON.parse(row.tags) as string[],
        firstSeenAt: row.first_seen_at,
      }));

    mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    writeFileSync(OUT_PATH, JSON.stringify(internships, null, 2));
    writeFileSync(META_PATH, JSON.stringify({ generatedAt: new Date().toISOString() }, null, 2));
    writeFileSync(FEED_PATH, buildFeed(internships));
    return internships.length;
  } finally {
    db.close();
  }
}
