function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Same shape as app.js's WATCHING_KEY -- duplicated rather than shared, same
// tradeoff as tierForCompany()/COMPANY_TIERS (browser JS can't import a
// module across these two standalone pages).
const WATCHING_KEY = "radar.watching";

function loadWatching() {
  try {
    const raw = localStorage.getItem(WATCHING_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistWatching(watching) {
  try {
    localStorage.setItem(WATCHING_KEY, JSON.stringify(watching));
  } catch {}
}

const MONTH_LABELS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const els = {
  header: document.getElementById("company-header"),
  notFound: document.getElementById("company-notfound"),
  signal: document.getElementById("company-signal"),
  monthsSection: document.getElementById("company-months-section"),
  recentSection: document.getElementById("company-recent-section"),
  tierLabel: document.getElementById("company-tier-label"),
  trackedSince: document.getElementById("company-tracked-since"),
  name: document.getElementById("company-name"),
  statOpenings: document.getElementById("company-stat-openings"),
  statTotal: document.getElementById("company-stat-total"),
  statFirst: document.getElementById("company-stat-first"),
  statDuration: document.getElementById("company-stat-duration"),
  locationBars: document.getElementById("company-location-bars"),
  disciplineBars: document.getElementById("company-discipline-bars"),
  monthBars: document.getElementById("company-month-bars"),
  recentList: document.getElementById("company-recent-list"),
  watchToggle: document.getElementById("watch-toggle"),
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Mirrors app.js's inline bar-row template -- reuses the same .bar-row/
// .bar-track/.bar-fill classes so this page matches the main listing page's
// signal density section exactly, just fed a different dataset.
function barsHtml(entries) {
  const max = entries.reduce((m, e) => Math.max(m, e.n), 1);
  return entries
    .map((e) => {
      const w = Math.max(4, Math.round((e.n / max) * 100)) + "%";
      return `
        <div class="bar-row">
          <span class="bar-label">${escapeHtml(e.label)}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${w}"></span></span>
          <span class="bar-count">${e.n}</span>
        </div>`;
    })
    .join("");
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function renderNotFound() {
  els.header.hidden = true;
  els.signal.hidden = true;
  els.monthsSection.hidden = true;
  els.recentSection.hidden = true;
  els.watchToggle.hidden = true;
  els.notFound.hidden = false;
}

function renderWatchToggle(slug) {
  const watching = loadWatching();
  const isWatching = !!watching[slug];
  els.watchToggle.hidden = false;
  els.watchToggle.classList.toggle("is-watching", isWatching);
  els.watchToggle.textContent = isWatching ? "★ WATCHING" : "☆ WATCH";
  els.watchToggle.onclick = () => {
    const current = loadWatching();
    if (current[slug]) delete current[slug];
    else current[slug] = 1;
    persistWatching(current);
    renderWatchToggle(slug);
  };
}

function renderCompany(summary) {
  document.title = `${summary.name} — Tech Internship Radar`;

  els.notFound.hidden = true;
  els.header.hidden = false;
  renderWatchToggle(summary.slug);

  els.tierLabel.textContent = summary.tier ? summary.tier.toUpperCase() + "-TIER" : "COMPANY";
  els.trackedSince.textContent = "TRACKED SINCE " + formatDate(summary.firstTrackedAt).toUpperCase();
  els.name.textContent = summary.name;

  els.statOpenings.textContent = pad2(summary.currentOpenings);
  els.statTotal.textContent = pad2(summary.totalPostings);
  els.statFirst.textContent = formatDate(summary.firstTrackedAt);
  els.statDuration.textContent = summary.avgPostingDurationDays === null ? "—" : Math.round(summary.avgPostingDurationDays);

  els.signal.hidden = false;
  els.locationBars.innerHTML = barsHtml(summary.topLocations.map((l) => ({ label: l.hub.toUpperCase(), n: l.count })));
  els.disciplineBars.innerHTML = barsHtml(summary.topDisciplines.map((d) => ({ label: d.label.toUpperCase(), n: d.count })));

  els.monthsSection.hidden = false;
  els.monthBars.innerHTML = barsHtml(MONTH_LABELS.map((label, i) => ({ label, n: summary.hiringMonths[i] })));

  if (summary.recentPostings.length === 0) {
    els.recentSection.hidden = true;
  } else {
    els.recentSection.hidden = false;
    els.recentList.innerHTML = summary.recentPostings
      .map(
        (p) => `
        <div class="missed-row">
          <span class="missed-check" aria-hidden="true">&#8594;</span>
          <a class="missed-company" href="${escapeHtml(p.url)}" target="_blank" rel="noreferrer">${escapeHtml(p.title)}</a>
          <span class="missed-role"></span>
          <span class="missed-loc">${escapeHtml(p.location)}</span>
          <span class="missed-date">${escapeHtml(formatDate(p.firstSeenAt))}</span>
        </div>`,
      )
      .join("");
  }
}

// Real "back," not just a link to index.html -- restores the previous
// page's scroll position and filter state via bfcache, same as the browser's
// own back button, instead of resetting to a fresh load.
function smartBack(e) {
  e.preventDefault();
  if (history.length > 1 && document.referrer && document.referrer.indexOf(location.origin) === 0) {
    history.back();
  } else {
    location.href = "index.html";
  }
}
const backLink = document.getElementById("back-link");
const brandLink = document.getElementById("brand-link");
if (backLink) backLink.addEventListener("click", smartBack);
if (brandLink) brandLink.addEventListener("click", smartBack);

const slug = new URLSearchParams(location.search).get("slug");

if (!slug) {
  renderNotFound();
} else {
  fetch(`./data/companies/${encodeURIComponent(slug)}.json`)
    .then((res) => {
      if (!res.ok) throw new Error("not found");
      return res.json();
    })
    .then((summary) => renderCompany(summary))
    .catch(() => renderNotFound());
}
