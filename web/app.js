// Category classification -- keyword-matched against job title, in priority
// order, mapped onto the design's fixed category id set (README "Listing
// shape": category: swe | ai | quant | hw | product | design | biz).
// Order matters: more specific buckets (quant, hw) are checked before the
// broad software/data catch-alls so e.g. "Quantitative Developer" doesn't
// fall into swe just because of "developer".
const CATEGORY_PRESETS = [
  { id: "quant", label: "Quant", keywords: ["quant", "quantitative"] },
  { id: "hw", label: "Hardware", keywords: ["hardware", "embedded", "firmware", "electrical engineer", "mechanical engineer"] },
  { id: "ai", label: "Data / AI", keywords: ["data science", "data scientist", "machine learning", "ml engineer", "ai ", "artificial intelligence", "nlp", "computer vision", "data engineer", "data analytics", "analytics"] },
  { id: "product", label: "Product", keywords: ["product manager", "product management", "product engineer", "apm"] },
  { id: "design", label: "Design", keywords: ["design", "ux", "ui "] },
  { id: "biz", label: "Business", keywords: ["marketing", "sales", "business", "growth", "operations", "finance", "hr ", "recruit", "legal", "audit", "tax"] },
  { id: "swe", label: "Software", keywords: ["software", "engineer", "developer", "backend", "frontend", "full stack", "devops", "sre", "platform", "infrastructure"] },
];
const CATS = [{ id: "all", label: "All" }].concat(
  CATEGORY_PRESETS.filter((c) => ["swe", "ai", "quant", "hw", "product", "design", "biz"].includes(c.id))
);
// Fixed display order per the design (Software, Data/AI, Quant, Hardware, Product, Design, Business)
CATS.length = 0;
CATS.push(
  { id: "all", label: "All" },
  { id: "swe", label: "Software" },
  { id: "ai", label: "Data / AI" },
  { id: "quant", label: "Quant" },
  { id: "hw", label: "Hardware" },
  { id: "product", label: "Product" },
  { id: "design", label: "Design" },
  { id: "biz", label: "Business" },
);

function categoryFor(job) {
  const title = job.title.toLowerCase();
  for (const preset of CATEGORY_PRESETS) {
    if (preset.keywords.some((kw) => title.includes(kw))) return preset.id;
  }
  return "swe";
}

// City-specific tokens only (no country-wide aliases like "Germany"/"France")
// so the hub chips stay a clean city list instead of every raw location
// string a source happens to report. Anything that doesn't match falls into
// "Other" rather than being force-bucketed into a same-country hub.
// `region` groups the hub chips into EU / NA rows in the toolbar. "Europe" here
// is geographic, not political -- London and Zurich sit in EU alongside the
// rest of the continent, matching the site's "EUROPE / NORTH AMERICA" framing.
const HUBS = [
  { name: "Tallinn", region: "eu", match: ["tallinn"] },
  { name: "Berlin", region: "eu", match: ["berlin"] },
  { name: "Munich", region: "eu", match: ["munich", "münchen", "munchen"] },
  { name: "Amsterdam", region: "eu", match: ["amsterdam"] },
  { name: "Dublin", region: "eu", match: ["dublin"] },
  { name: "London", region: "eu", match: ["london"] },
  { name: "Paris", region: "eu", match: ["paris"] },
  { name: "Stockholm", region: "eu", match: ["stockholm"] },
  { name: "Helsinki", region: "eu", match: ["helsinki"] },
  { name: "Warsaw", region: "eu", match: ["warsaw", "warszawa"] },
  { name: "Barcelona", region: "eu", match: ["barcelona"] },
  { name: "Lisbon", region: "eu", match: ["lisbon", "lisboa"] },
  { name: "Zurich", region: "eu", match: ["zurich", "zürich"] },
  { name: "Madrid", region: "eu", match: ["madrid"] },
  { name: "New York", region: "na", match: ["new york", "nyc"] },
  { name: "San Francisco", region: "na", match: ["san francisco", "bay area", "san jose", "silicon valley"] },
  { name: "Seattle", region: "na", match: ["seattle"] },
  { name: "Austin", region: "na", match: ["austin"] },
  { name: "Toronto", region: "na", match: ["toronto"] },
  { name: "Vancouver", region: "na", match: ["vancouver"] },
];
const OTHER_HUB = "Other";

// Hub name -> region, so the chip renderer can bucket hub names coming back
// from the listings without re-running the location matcher.
const HUB_REGION = HUBS.reduce((acc, hub) => {
  acc[hub.name] = hub.region;
  return acc;
}, {});

function hubFor(job) {
  const text = job.location.toLowerCase();
  const hit = HUBS.find((hub) => hub.match.some((token) => text.includes(token)));
  return hit ? hit.name : OTHER_HUB;
}

// Best-effort inference from free text -- sources don't expose a clean
// "workplace type" field. Hybrid folds into "remote-friendly" here since
// it's vanishingly rare on its own (internships are overwhelmingly on-site).
function isRemote(job) {
  const text = `${job.location} ${job.title}`.toLowerCase();
  return text.includes("remote") || text.includes("hybrid");
}

// "FAANG+"-tier by reputation/competitiveness, not a strict acronym.
// Deliberately a fixed, edited-by-hand list -- there's no clean signal for
// "notable" in the source data to derive it from.
const NOTABLE_COMPANIES = [
  "Stripe", "Airbnb", "DoorDash", "Robinhood", "Coinbase", "Databricks", "Anthropic", "OpenAI",
  "Palantir", "Salesforce", "SAP", "Visa", "Nike", "Spotify", "Klarna", "Booking.com", "Reddit",
  "Pinterest", "Cloudflare", "Discord", "Figma", "Twilio", "Notion", "Duolingo", "Scale AI",
  "Shopify", "Roblox", "Block", "Instacart", "HubSpot",
].map((name) => name.toLowerCase());

function isNotable(job) {
  const company = job.company.toLowerCase();
  return NOTABLE_COMPANIES.some((name) => company.includes(name));
}

// A season posted for a year beyond the current one is unusually early --
// most companies don't open applications that far out, so it's flagged
// EARLY rather than shown identically to a normal in-cycle listing.
function isEarly(job) {
  if (!job.season) return false;
  const match = job.season.match(/(20\d{2})/);
  return !!match && Number(match[1]) > new Date().getFullYear();
}

const TRACK_META = {
  internship: { id: "intern", label: "Internships" },
  "new-grad": { id: "newgrad", label: "New Grad" },
  junior: { id: "junior", label: "Junior" },
};

function trackFor(job) {
  const cat = job.categories && job.categories[0];
  return (TRACK_META[cat] || TRACK_META.internship).id;
}

function daysAgo(isoDate) {
  if (!isoDate) return 0;
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, days);
}

// Adapts a raw pipeline job record into the design's listing shape (README
// "State" section): { id, hub, company, role, category, track, daysAgo,
// remote, flags[], url }.
function toListing(job) {
  const flags = [];
  if (isEarly(job)) flags.push("EARLY");
  if (isNotable(job)) flags.push("NOTABLE");
  if (job.advancedDegree) flags.push("PHD");
  return {
    id: job.id,
    hub: hubFor(job),
    company: job.company,
    role: job.title,
    category: categoryFor(job),
    track: trackFor(job),
    daysAgo: daysAgo(job.postedDate),
    remote: isRemote(job),
    flags,
    url: job.url,
  };
}

// ---------------------------------------------------------------------------

const SAVED_KEY = "radar.saved";

function loadSaved() {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistSaved(saved) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  } catch {}
}

const state = {
  track: null, // resolved to defaultTrack ('intern') on first render
  q: "",
  cat: "all",
  hub: "all",
  remoteOnly: false,
  savedOnly: false,
  saved: loadSaved(),
  sort: "new",
};

let LISTINGS = [];

const DEFAULT_TRACK = "intern";

const els = {
  trackTabs: document.getElementById("track-tabs"),
  search: document.getElementById("search"),
  roleChips: document.getElementById("role-chips"),
  hubChipsBase: document.getElementById("hub-chips-base"),
  hubChipsEu: document.getElementById("hub-chips-eu"),
  hubChipsNa: document.getElementById("hub-chips-na"),
  hubRowEu: document.getElementById("hub-row-eu"),
  hubRowNa: document.getElementById("hub-row-na"),
  remoteToggle: document.getElementById("remote-toggle"),
  savedToggle: document.getElementById("saved-toggle"),
  resultCount: document.getElementById("result-count"),
  sortNew: document.getElementById("sort-new"),
  sortCo: document.getElementById("sort-co"),
  sortHub: document.getElementById("sort-hub"),
  rows: document.getElementById("listing-rows"),
  emptyState: document.getElementById("empty-state"),
  resetFilters: document.getElementById("reset-filters"),
  signalTrackLabel: document.getElementById("signal-track-label"),
  hubBars: document.getElementById("hub-bars"),
  catBars: document.getElementById("cat-bars"),
  statListings: document.getElementById("stat-listings"),
  statHubs: document.getElementById("stat-hubs"),
  statToday: document.getElementById("stat-today"),
  statSweep: document.getElementById("stat-sweep"),
  globeSigma: document.getElementById("globe-sigma"),
  footerSweep: document.getElementById("footer-sweep"),
};

function posted(d) {
  if (d === 0) return "TODAY";
  if (d < 7) return d + "D";
  if (d < 30) return Math.round(d / 7) + "W";
  return Math.round(d / 30) + "MO";
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function sweepStamp() {
  const now = new Date();
  return pad2(now.getHours()) + ":" + pad2(now.getMinutes());
}

function renderTrackTabs() {
  const track = state.track || DEFAULT_TRACK;
  els.trackTabs.innerHTML = "";
  ["intern", "newgrad", "junior"].forEach((id) => {
    const label = { intern: "Internships", newgrad: "New Grad", junior: "Junior" }[id];
    const count = LISTINGS.filter((r) => r.track === id).length;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "track-tab" + (track === id ? " active" : "");
    btn.innerHTML = `<span>${label}</span><span>${pad2(count)}</span>`;
    btn.addEventListener("click", () => {
      state.track = id;
      state.hub = "all";
      state.cat = "all";
      render();
    });
    els.trackTabs.appendChild(btn);
  });
}

function renderChipRow(container, items, activeId, onSelect) {
  container.innerHTML = "";
  items.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (item.id === activeId ? " active" : "");
    btn.textContent = item.label;
    btn.addEventListener("click", () => onSelect(item.id));
    container.appendChild(btn);
  });
}

function render() {
  if (!state.track) state.track = DEFAULT_TRACK;
  const track = state.track;
  const trackLabel = { intern: "Internships", newgrad: "New Grad", junior: "Junior" }[track];
  const inTrack = LISTINGS.filter((r) => r.track === track);
  const q = state.q.trim().toLowerCase();

  let rows = inTrack.filter((r) => {
    if (state.cat !== "all" && r.category !== state.cat) return false;
    if (state.hub !== "all" && r.hub !== state.hub) return false;
    if (state.remoteOnly && !r.remote) return false;
    if (state.savedOnly && !state.saved[r.id]) return false;
    if (q && !(r.company + " " + r.role + " " + r.hub).toLowerCase().includes(q)) return false;
    return true;
  });

  if (state.sort === "co") rows = rows.slice().sort((a, b) => a.company.localeCompare(b.company));
  else if (state.sort === "hub") rows = rows.slice().sort((a, b) => a.hub.localeCompare(b.hub) || a.daysAgo - b.daysAgo);
  else rows = rows.slice().sort((a, b) => a.daysAgo - b.daysAgo);

  // track tabs
  renderTrackTabs();

  // role chips
  renderChipRow(els.roleChips, CATS, state.cat, (id) => {
    state.cat = id;
    render();
  });

  // Hub chips, split into EU / NA rows so the list wraps into short labelled
  // groups instead of one long horizontally-scrolling strip. Hub list is scoped
  // to the whole dataset (matching the design's use of all hub names), and only
  // regions that actually have hubs get a row. "Other" is region-less, so it
  // rides along in the base row next to "All hubs".
  const hubNames = [];
  LISTINGS.forEach((r) => { if (hubNames.indexOf(r.hub) < 0) hubNames.push(r.hub); });

  const onHubSelect = (id) => {
    state.hub = id;
    render();
  };
  const toItems = (names) => names.map((h) => ({ id: h, label: h }));

  const baseItems = [{ id: "all", label: "All hubs" }].concat(
    toItems(hubNames.filter((h) => !HUB_REGION[h]))
  );
  renderChipRow(els.hubChipsBase, baseItems, state.hub, onHubSelect);

  [
    { region: "eu", row: els.hubRowEu, chips: els.hubChipsEu },
    { region: "na", row: els.hubRowNa, chips: els.hubChipsNa },
  ].forEach(({ region, row, chips }) => {
    const names = hubNames.filter((h) => HUB_REGION[h] === region);
    row.hidden = names.length === 0;
    renderChipRow(chips, toItems(names), state.hub, onHubSelect);
  });

  // toggles
  els.remoteToggle.classList.toggle("active", state.remoteOnly);
  els.remoteToggle.setAttribute("aria-pressed", String(state.remoteOnly));
  const savedCount = Object.keys(state.saved).filter((id) => state.saved[id]).length;
  els.savedToggle.textContent = "Saved " + pad2(savedCount);
  els.savedToggle.classList.toggle("active", state.savedOnly);
  els.savedToggle.setAttribute("aria-pressed", String(state.savedOnly));

  // sort buttons
  els.sortNew.classList.toggle("active", state.sort === "new");
  els.sortCo.classList.toggle("active", state.sort === "co");
  els.sortHub.classList.toggle("active", state.sort === "hub");

  // result line
  els.resultCount.textContent = pad2(rows.length) + " OF " + pad2(inTrack.length) + " " + trackLabel.toUpperCase();

  // rows
  els.rows.innerHTML = rows
    .map((r, i) => {
      const flags = (r.remote ? ["REMOTE"] : []).concat(r.flags);
      const saved = !!state.saved[r.id];
      const postedLabel = posted(r.daysAgo);
      const isToday = r.daysAgo === 0;
      return `
        <div class="listing-row">
          <span class="row-no">${pad2(i + 1)}</span>
          <span class="row-hub">${escapeHtml(r.hub)}</span>
          <span class="row-company" title="${escapeHtml(r.company)}">${escapeHtml(r.company)}</span>
          <a href="${escapeHtml(r.url)}" target="_blank" rel="noreferrer" class="row-role">${escapeHtml(r.role)}</a>
          <span class="row-signal">${flags.map((f) => `<span class="signal-pill">${escapeHtml(f)}</span>`).join("")}</span>
          <span class="row-posted${isToday ? " is-today" : ""}">${postedLabel}</span>
          <button type="button" class="row-save${saved ? " saved" : ""}" title="Save listing" data-id="${escapeHtml(r.id)}">${saved ? "★" : "☆"}</button>
        </div>`;
    })
    .join("");

  els.emptyState.hidden = rows.length !== 0;

  // signal density
  els.signalTrackLabel.textContent = trackLabel.toUpperCase();

  const hubCounts = {};
  inTrack.forEach((r) => { hubCounts[r.hub] = (hubCounts[r.hub] || 0) + 1; });
  const catCounts = {};
  inTrack.forEach((r) => { catCounts[r.category] = (catCounts[r.category] || 0) + 1; });

  const barsHtml = (entries) => {
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
  };

  els.hubBars.innerHTML = barsHtml(
    hubNames
      .filter((h) => hubCounts[h])
      .map((h) => ({ label: h.toUpperCase(), n: hubCounts[h] }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 7),
  );
  els.catBars.innerHTML = barsHtml(
    CATS.filter((c) => c.id !== "all" && catCounts[c.id])
      .map((c) => ({ label: c.label.toUpperCase(), n: catCounts[c.id] }))
      .sort((a, b) => b.n - a.n),
  );

  // stat strip
  els.statListings.textContent = pad2(LISTINGS.length);
  els.statHubs.textContent = pad2(hubNames.length);
  els.statToday.textContent = pad2(LISTINGS.filter((r) => r.daysAgo === 0).length);
  const stamp = sweepStamp();
  els.statSweep.textContent = stamp;
  els.globeSigma.textContent = "\u03a3 " + LISTINGS.length;
  els.footerSweep.textContent = "SWEEP " + stamp + " UTC";
}

els.search.addEventListener("input", () => {
  state.q = els.search.value;
  render();
});

window.addEventListener("keydown", (e) => {
  const tag = (e.target && e.target.tagName) || "";
  if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
    e.preventDefault();
    els.search.focus();
  }
});

els.remoteToggle.addEventListener("click", () => {
  state.remoteOnly = !state.remoteOnly;
  render();
});

els.savedToggle.addEventListener("click", () => {
  state.savedOnly = !state.savedOnly;
  render();
});

els.resetFilters.addEventListener("click", () => {
  state.cat = "all";
  state.hub = "all";
  state.remoteOnly = false;
  state.savedOnly = false;
  state.q = "";
  els.search.value = "";
  render();
});

els.sortNew.addEventListener("click", () => { state.sort = "new"; render(); });
els.sortCo.addEventListener("click", () => { state.sort = "co"; render(); });
els.sortHub.addEventListener("click", () => { state.sort = "hub"; render(); });

els.rows.addEventListener("click", (e) => {
  const btn = e.target.closest(".row-save");
  if (!btn) return;
  const id = btn.dataset.id;
  if (state.saved[id]) delete state.saved[id];
  else state.saved[id] = 1;
  persistSaved(state.saved);
  render();
});

fetch("./data/jobs.json")
  .then((res) => res.json())
  .then((data) => {
    LISTINGS = data.map(toListing);
    render();
  })
  .catch(() => {
    els.resultCount.textContent = "Failed to load listings.";
  });
