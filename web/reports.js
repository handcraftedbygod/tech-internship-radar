function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const els = {
  empty: document.getElementById("reports-empty"),
  list: document.getElementById("reports-list"),
};

// Mirrors app.js's inline bar-row template -- same .bar-row/.bar-track/
// .bar-fill classes used everywhere else on the site.
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

function pctLabel(pct) {
  return (pct > 0 ? "+" : "") + pct + "%";
}

function reportCardHtml(report) {
  const hubBars = barsHtml(report.topHubs.map((h) => ({ label: h.hub.toUpperCase(), n: h.count })));
  const companyBars = barsHtml(report.topCompanies.map((c) => ({ label: c.name.toUpperCase(), n: c.count })));
  const notableHiring = report.notableHiring || [];
  const notableBars = barsHtml(notableHiring.map((c) => ({ label: `${c.name.toUpperCase()} · ${c.badge}`, n: c.count })));
  const discipline = report.fastestGrowingDiscipline;

  return `
    <div class="report-card">
      <div class="signal-heading">
        <span class="signal-title">Week of ${escapeHtml(report.weekOf)}</span>
        <span class="dotted-rule dotted-rule--flex" aria-hidden="true"></span>
        <span class="signal-track-label">${escapeHtml(pctLabel(report.pctChange))} VS. PRIOR WEEK</span>
      </div>
      <div class="stat-strip">
        <div class="stat-cell">
          <div class="stat-label">NEW LISTINGS</div>
          <div class="stat-value">${report.newCount}</div>
        </div>
        <div class="stat-cell">
          <div class="stat-label">PRIOR WEEK</div>
          <div class="stat-value">${report.prevWeekCount}</div>
        </div>
        ${discipline ? `
        <div class="stat-cell">
          <div class="stat-label">FASTEST GROWING</div>
          <div class="stat-value" style="font-size:18px">${escapeHtml(discipline.label)}</div>
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

fetch("./data/reports.json")
  .then((res) => res.json())
  .then((reports) => {
    if (!reports || reports.length === 0) {
      els.empty.hidden = false;
      return;
    }
    els.list.innerHTML = reports.map(reportCardHtml).join("");
  })
  .catch(() => {
    els.empty.hidden = false;
  });
