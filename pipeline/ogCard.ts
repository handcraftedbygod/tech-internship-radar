import { Resvg } from "@resvg/resvg-js";
import type { WeeklyReport } from "./weeklyReport.ts";

const WIDTH = 1200;
const HEIGHT = 630;
const BG = "#050506";
const FG = "#F4F7F9";
const DIM = "rgba(244,247,249,0.55)";
const FAINT = "rgba(244,247,249,0.32)";
// DejaVu Sans Mono ships on Ubuntu (the GitHub Actions runner) by default --
// closest available match to the site's actual IBM Plex Mono, which isn't
// installed there and would silently fall back anyway.
const FONT = "'DejaVu Sans Mono', monospace";

function esc(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c] as string);
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function currencySymbol(currency: "eur" | "usd"): string {
  return currency === "eur" ? "€" : "$";
}

function payRangeText(pay: { currency: "eur" | "usd"; low: number; high: number }): string {
  const symbol = currencySymbol(pay.currency);
  return `${symbol}${pay.low}–${symbol}${pay.high}/h`;
}

function buildSvg(report: WeeklyReport): string {
  const pct = `${report.pctChange > 0 ? "+" : ""}${report.pctChange}%`;

  const stats: { label: string; value: string }[] = [
    { label: "TRACKED SINCE LAUNCH", value: report.totalTracked.toLocaleString() },
  ];
  if (report.topPay) stats.push({ label: "TOP PAY", value: payRangeText(report.topPay) });
  const ycTotal = report.ycHiring.europe + report.ycHiring.northAmerica;
  if (ycTotal) stats.push({ label: "YC HIRING", value: String(ycTotal) });
  if (report.notableHiring.length) stats.push({ label: "FAANG / NOTABLE", value: String(report.notableHiring.length) });

  const statsBlocks = stats
    .slice(0, 4)
    .map((s, i) => {
      const x = 64 + i * 270;
      return `
      <text x="${x}" y="540" font-family="${FONT}" font-size="14" letter-spacing="2" fill="${DIM}">${esc(s.label)}</text>
      <text x="${x}" y="574" font-family="${FONT}" font-size="30" fill="${FG}">${esc(s.value)}</text>`;
    })
    .join("");

  const headlineBlock = report.headline
    ? `
      <rect x="64" y="376" width="1072" height="122" rx="6" fill="none" stroke="${FAINT}" stroke-width="1.5"/>
      <text x="88" y="416" font-family="${FONT}" font-size="15" letter-spacing="2" fill="${DIM}">${esc(report.headline.badge ?? "STANDOUT")}</text>
      <text x="88" y="452" font-family="${FONT}" font-size="25" fill="${FG}">${esc(truncate(`${report.headline.title} at ${report.headline.company}`, 58))}</text>
      <text x="88" y="480" font-family="${FONT}" font-size="16" fill="${DIM}">${esc(report.headline.hub)} · ${esc(payRangeText(report.headline))}</text>`
    : "";

  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}"/>
  <text x="64" y="80" font-family="${FONT}" font-size="16" letter-spacing="3" fill="${DIM}">TECH INTERNSHIP RADAR</text>
  <text x="64" y="112" font-family="${FONT}" font-size="14" letter-spacing="2" fill="${FAINT}">WEEK OF ${esc(report.weekOf)}</text>
  <text x="60" y="260" font-family="${FONT}" font-size="140" font-weight="700" fill="${FG}">${report.newCount}</text>
  <text x="64" y="300" font-family="${FONT}" font-size="22" fill="${DIM}">NEW LISTINGS THIS WEEK (${esc(pct)} VS. LAST WEEK)</text>
  ${headlineBlock}
  ${statsBlocks}
  <text x="64" y="600" font-family="${FONT}" font-size="14" letter-spacing="1" fill="${FAINT}">handcraftedbygod.github.io/tech-internship-radar</text>
</svg>`;
}

// Rendered once per weekly-report run, never at request time -- a static PNG
// baked into the per-week share page's og:image (see buildOgHtml()), since
// crawlers don't execute JS and can't render the live, client-side report card.
export function renderOgCard(report: WeeklyReport): Buffer {
  const svg = buildSvg(report);
  const resvg = new Resvg(svg, {
    background: BG,
    font: { loadSystemFonts: true, defaultFontFamily: "DejaVu Sans Mono" },
  });
  return resvg.render().asPng();
}

// A static shim, not the real interactive page -- og:title/description/image
// must be present in the FIRST response a crawler sees, and reports.html
// builds its content client-side from reports.json, so every week would
// otherwise show the same generic preview. Redirects a human visitor
// straight through; a crawler stops here and reads the meta tags.
export function buildOgHtml(report: WeeklyReport, imageUrl: string, pageUrl: string): string {
  const title = `Tech Internship Radar — Week of ${report.weekOf}`;
  const pct = `${report.pctChange > 0 ? "+" : ""}${report.pctChange}%`;
  const descriptionParts = [`${report.newCount} new listings this week (${pct} vs. last week).`];
  if (report.headline) {
    descriptionParts.push(`Standout: ${report.headline.title} at ${report.headline.company} — ${payRangeText(report.headline)}.`);
  }
  const description = descriptionParts.join(" ");
  // reports.html now shows one week at a time (a chip picker, not an
  // endless stack), so the redirect must ask for this specific week or a
  // shared link would land on whatever's most recent instead.
  const redirectUrl = `../reports.html?week=${encodeURIComponent(report.weekOf)}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(imageUrl)}">
<meta property="og:url" content="${esc(pageUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(imageUrl)}">
<meta http-equiv="refresh" content="0; url=${esc(redirectUrl)}">
<link rel="canonical" href="${esc(redirectUrl)}">
</head>
<body>
<p><a href="${esc(redirectUrl)}">Continue to the weekly reports page</a>…</p>
<script>location.replace(${JSON.stringify(redirectUrl)});</script>
</body>
</html>
`;
}
