function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const els = {
  empty: document.getElementById("reports-empty"),
  list: document.getElementById("reports-list"),
  picker: document.getElementById("week-picker"),
};

// Mirrors app.js's inline bar-row template -- same .bar-row/.bar-track/
// .bar-fill classes used everywhere else on the site. .bar-label truncates
// with an ellipsis in its fixed-width column (see style.css), so long names
// like "Hudson River Trading" get a title tooltip for the full text instead
// of wrapping the row onto two lines.
function barsHtml(entries) {
  const max = entries.reduce((m, e) => Math.max(m, e.n), 1);
  return entries
    .map((e) => {
      const w = Math.max(4, Math.round((e.n / max) * 100)) + "%";
      return `
        <div class="bar-row">
          <span class="bar-label" title="${escapeHtml(e.label)}">${escapeHtml(e.label)}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${w}"></span></span>
          <span class="bar-count">${e.n}</span>
        </div>`;
    })
    .join("");
}

function pctLabel(pct) {
  return (pct > 0 ? "+" : "") + pct + "%";
}

const CURRENCY_SYMBOL = { eur: "€", usd: "$" };

function formatPayRange(pay) {
  const symbol = CURRENCY_SYMBOL[pay.currency];
  return `${symbol}${pay.low}–${symbol}${pay.high}/h`;
}

function reportCardHtml(report) {
  const hubBars = barsHtml(report.topHubs.map((h) => ({ label: h.hub.toUpperCase(), n: h.count })));
  const companyBars = barsHtml(report.topCompanies.map((c) => ({ label: c.name.toUpperCase(), n: c.count })));
  const notableHiring = report.notableHiring || [];
  const notableBars = barsHtml(notableHiring.map((c) => ({ label: c.name.toUpperCase(), n: c.count })));
  const discipline = report.fastestGrowingDiscipline;
  const yc = report.ycHiring;
  const ycTotal = yc ? yc.europe + yc.northAmerica : 0;

  return `
    <div class="report-card">
      <div class="signal-heading">
        <span class="signal-title">Week of ${escapeHtml(report.weekOf)}</span>
        <span class="dotted-rule dotted-rule--flex" aria-hidden="true"></span>
        <span class="signal-track-label">${escapeHtml(pctLabel(report.pctChange))} VS. PRIOR WEEK</span>
      </div>
      ${report.headline ? `
      <div class="signal-track-label" style="padding-bottom:6px">THIS WEEK'S STANDOUT</div>
      <a href="${escapeHtml(report.headline.url)}" target="_blank" rel="noreferrer" style="display:block;padding-bottom:18px;">
        ${report.headline.badge ? `<span class="signal-pill">${escapeHtml(report.headline.badge)}</span> ` : ""}
        <span class="row-role" style="font-size:14px">${escapeHtml(report.headline.title)} at ${escapeHtml(report.headline.company)}</span>
        <span style="display:block;margin-top:4px;font-size:11px;color:rgba(244,247,249,0.5);">${escapeHtml(report.headline.hub)} · ${formatPayRange(report.headline)}</span>
      </a>` : ""}
      <div class="stat-strip">
        <div class="stat-cell">
          <div class="stat-label">NEW LISTINGS</div>
          <div class="stat-value">${report.newCount}</div>
        </div>
        <div class="stat-cell">
          <div class="stat-label">PRIOR WEEK</div>
          <div class="stat-value">${report.prevWeekCount}</div>
        </div>
        ${typeof report.totalTracked === "number" ? `
        <div class="stat-cell">
          <div class="stat-label">TOTAL LISTINGS</div>
          <div class="stat-value">${report.totalTracked.toLocaleString()}</div>
        </div>` : ""}
        ${report.newCompanies && report.newCompanies.totalCount ? `
        <div class="stat-cell">
          <div class="stat-label">NEW COMPANIES</div>
          <div class="stat-value" title="${escapeHtml(report.newCompanies.sample.map((c) => c.name).join(", "))}">${report.newCompanies.totalCount}</div>
        </div>` : ""}
        ${ycTotal ? `
        <div class="stat-cell">
          <div class="stat-label">YC STARTUPS HIRING</div>
          <div class="stat-value stat-value--text">${yc.europe} EU / ${yc.northAmerica} NA</div>
        </div>` : ""}
        ${report.topPay ? `
        <div class="stat-cell">
          <div class="stat-label">TOP PAY</div>
          <div class="stat-value stat-value--text" title="${escapeHtml(report.topPay.title)} at ${escapeHtml(report.topPay.company)}">${formatPayRange(report.topPay)}</div>
        </div>` : ""}
        ${report.earlyPick ? `
        <div class="stat-cell">
          <div class="stat-label">EARLY BIRD</div>
          <div class="stat-value stat-value--text" title="${escapeHtml(report.earlyPick.title)} at ${escapeHtml(report.earlyPick.company)}">${escapeHtml(report.earlyPick.season)}</div>
        </div>` : ""}
        ${discipline ? `
        <div class="stat-cell">
          <div class="stat-label">FASTEST GROWING</div>
          <div class="stat-value stat-value--text">${escapeHtml(discipline.label)}</div>
        </div>` : ""}
      </div>
      ${notableHiring.length || report.topHubs.length || report.topCompanies.length ? `
      <div class="signal-cols" style="padding-top: 24px">
        ${notableHiring.length ? `<div class="signal-col"><div class="signal-col-label">FAANG / NOTABLE HIRING</div>${notableBars}</div>` : ""}
        ${report.topHubs.length ? `<div class="signal-col"><div class="signal-col-label">TOP HUBS</div>${hubBars}</div>` : ""}
        ${report.topCompanies.length ? `<div class="signal-col"><div class="signal-col-label">MOST ACTIVE COMPANIES</div>${companyBars}</div>` : ""}
      </div>` : ""}
    </div>`;
}

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

// "2026-08-16" -> "AUG 16". T00:00:00Z + timeZone:"UTC" so a viewer west of
// UTC doesn't see the date roll back a day.
function weekChipLabel(weekOf) {
  return new Date(`${weekOf}T00:00:00Z`)
    .toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    .toUpperCase();
}

let allReports = [];
let activeWeek = null;

function renderPicker() {
  els.picker.innerHTML = allReports
    .map(
      (r) =>
        `<button type="button" class="chip${r.weekOf === activeWeek ? " active" : ""}" data-week="${r.weekOf}">${weekChipLabel(r.weekOf)}</button>`,
    )
    .join("");
}

function renderActiveCard() {
  const report = allReports.find((r) => r.weekOf === activeWeek);
  els.list.innerHTML = report ? reportCardHtml(report) : "";
}

function selectWeek(weekOf) {
  activeWeek = weekOf;
  const url = new URL(location.href);
  url.searchParams.set("week", weekOf);
  history.replaceState(null, "", url);
  renderPicker();
  renderActiveCard();
}

if (els.picker) {
  els.picker.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (btn) selectWeek(btn.dataset.week);
  });
}

fetch("./data/reports.json")
  .then((res) => res.json())
  .then((reports) => {
    if (!reports || reports.length === 0) {
      els.empty.hidden = false;
      return;
    }
    allReports = reports;
    // reports.json is newest-first (see weeklyReport.ts), so reports[0] is
    // the default -- unless the URL asks for a specific week (e.g. shared
    // from that week's og:image link, see ogCard.ts's buildOgHtml()).
    const requested = new URLSearchParams(location.search).get("week");
    activeWeek = requested && reports.some((r) => r.weekOf === requested) ? requested : reports[0].weekOf;
    renderPicker();
    renderActiveCard();
  })
  .catch(() => {
    els.empty.hidden = false;
  });
