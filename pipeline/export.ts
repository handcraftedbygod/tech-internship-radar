import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { openDb } from "./store.ts";

const OUT_PATH = path.join(import.meta.dirname, "..", "web", "data", "jobs.json");
const META_PATH = path.join(import.meta.dirname, "..", "web", "data", "meta.json");
const FEED_PATH = path.join(import.meta.dirname, "..", "web", "feed.xml");
const FEED_HTML_PATH = path.join(import.meta.dirname, "..", "web", "feed.html");
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

// A plain static HTML page, not an XSLT-styled feed.xml -- Chrome dropped
// built-in XSLT support, so <?xml-stylesheet?> no longer renders feed.xml
// nicely there. This page is what the visible RSS icon links to; feed.xml
// itself stays pure XML for actual feed readers to subscribe to.
function buildFeedHtml(jobs: FeedJob[]): string {
  const items = jobs
    .slice()
    .sort((a, b) => (a.firstSeenAt < b.firstSeenAt ? 1 : -1))
    .slice(0, 100)
    .map(
      (job) => `
      <li>
        <a href="${escapeXml(job.url)}">${escapeXml(job.title)}</a>
        <span>${escapeXml(job.company)} — ${escapeXml(job.location)} · ${new Date(job.firstSeenAt).toLocaleDateString()}</span>
      </li>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tech Internship Radar — RSS Feed</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2.5rem auto; padding: 0 1.25rem; background: #0b0d12; color: #e6e8eb; }
    a { color: inherit; }
    h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
    p.back { margin-top: 0; }
    p.desc { color: #8a90a0; }
    p.hint { background: #12151c; border: 1px solid #1c2029; border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.9rem; }
    p.hint code { background: #1c2029; padding: 0.1rem 0.35rem; border-radius: 4px; }
    ul { list-style: none; padding: 0; }
    li { padding: 0.85rem 0; border-bottom: 1px solid #1c2029; }
    li a { font-weight: 600; text-decoration: none; }
    li a:hover { text-decoration: underline; }
    li span { display: block; color: #8a90a0; font-size: 0.85rem; margin-top: 0.15rem; }
  </style>
</head>
<body>
  <p class="back"><a href="${SITE_URL}">&larr; Tech Internship Radar</a></p>
  <h1>RSS Feed</h1>
  <p class="desc">New internship &amp; working-student listings across European and North American tech hubs.</p>
  <p class="hint">To subscribe, add <code>${SITE_URL}feed.xml</code> to a feed reader (e.g. Feedly). This page is just a human-readable preview of the same ${jobs.length > 100 ? 100 : jobs.length} most recent listings.</p>
  <ul>${items}
  </ul>
</body>
</html>
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
    writeFileSync(FEED_HTML_PATH, buildFeedHtml(internships));
    return internships.length;
  } finally {
    db.close();
  }
}
