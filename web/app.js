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
  { name: "Stuttgart", region: "eu", match: ["stuttgart"] },
  { name: "Frankfurt", region: "eu", match: ["frankfurt"] },
  { name: "Hannover", region: "eu", match: ["hannover", "hanover"] },
  { name: "Karlsruhe", region: "eu", match: ["karlsruhe"] },
  { name: "Bremen", region: "eu", match: ["bremen"] },
  { name: "Düsseldorf", region: "eu", match: ["düsseldorf", "dusseldorf"] },
  { name: "Reutlingen", region: "eu", match: ["reutlingen"] },
  { name: "Krakow", region: "eu", match: ["krakow", "kraków"] },
  { name: "Katowice", region: "eu", match: ["katowice"] },
  { name: "Lodz", region: "eu", match: ["lodz", "łódź"] },
  { name: "New York", region: "na", match: ["new york", "nyc"] },
  { name: "San Francisco", region: "na", match: ["san francisco", "bay area", "san jose", "silicon valley", "san mateo", "palo alto", "santa clara", "foster city", "sf office"] },
  { name: "Seattle", region: "na", match: ["seattle"] },
  { name: "Austin", region: "na", match: ["austin"] },
  { name: "Boston", region: "na", match: ["boston"] },
  { name: "Los Angeles", region: "na", match: ["los angeles"] },
  { name: "Chicago", region: "na", match: ["chicago"] },
  { name: "Toronto", region: "na", match: ["toronto"] },
  { name: "Vancouver", region: "na", match: ["vancouver"] },
  { name: "Montreal", region: "na", match: ["montreal", "montréal"] },
];
const OTHER_HUB = "Other";
const OTHER_EU_HUB = "Other (EU)";
const OTHER_NA_HUB = "Other (NA)";

// Hub name -> region, so the chip renderer can bucket hub names coming back
// from the listings without re-running the location matcher.
const HUB_REGION = HUBS.reduce((acc, hub) => {
  acc[hub.name] = hub.region;
  return acc;
}, {});
HUB_REGION[OTHER_EU_HUB] = "eu";
HUB_REGION[OTHER_NA_HUB] = "na";

// A job whose city isn't one of the specific HUBS above still usually has a
// clear country, so "All EU hubs"/"All NA hubs" shouldn't lose it -- only
// truly ambiguous ones (bare "Remote", non-EU/NA countries) stay in the
// region-less "Other" bucket. Country code first since it's cheap and exact
// when a source reports one; free-text country name second for the sources
// that leave it null but still put the country in the location string.
const EU_COUNTRY_CODES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES",
  "SE", "GB", "CH", "NO", "IS", "UA",
]);
const NA_COUNTRY_CODES = new Set(["US", "CA"]);
const EU_TEXT_HINTS = [
  "germany", "deutschland", "france", "united kingdom", "netherlands", "nederland",
  "switzerland", "sweden", "sverige", "poland", "spain", "portugal", "finland",
  "ireland", "ukraine", "estonia", "italy", "belgium", "austria", "denmark",
  "norway", "europe",
];

// Word-boundary, not NA_TOKENS' plain .includes() -- a bare "us"/"ca" substring
// check would false-positive on e.g. "Brussels"/"Canada"-adjacent EU text.
const BARE_NA_COUNTRY = /\b(us|usa|ca)\b/;

function regionForOther(job) {
  const code = (job.country || "").toUpperCase();
  if (EU_COUNTRY_CODES.has(code)) return "eu";
  if (NA_COUNTRY_CODES.has(code)) return "na";
  const text = job.location.toLowerCase();
  if (NA_TOKENS.some((token) => text.includes(token))) return "na";
  if (EU_TEXT_HINTS.some((token) => text.includes(token))) return "eu";
  if (BARE_NA_COUNTRY.test(text)) return "na";
  return null;
}

function hubFor(job) {
  const text = job.location.toLowerCase();
  const hit = HUBS.find((hub) => hub.match.some((token) => text.includes(token)));
  if (hit) return hit.name;
  const region = regionForOther(job);
  if (region === "eu") return OTHER_EU_HUB;
  if (region === "na") return OTHER_NA_HUB;
  return OTHER_HUB;
}

// Best-effort inference from free text -- sources don't expose a clean
// "workplace type" field. Hybrid folds into "remote-friendly" here since
// it's vanishingly rare on its own (internships are overwhelmingly on-site).
function isRemote(job) {
  const text = `${job.location} ${job.title}`.toLowerCase();
  return text.includes("remote") || text.includes("hybrid");
}

// Company reputation tiers, ordered most- to least-prestigious -- the first
// match wins. Deliberately fixed, edited-by-hand lists (there's no clean signal
// for "notable" in the source data to derive it from), and they drive both the
// FAANG/NOTABLE badge and the pay multiplier, so a company is only ever added once.
//
// `trading` sits above `elite` because prop-trading pay is a different scale
// entirely (a Jane Street intern out-earns a FAANG intern roughly 2x), not
// merely a step up.
const COMPANY_TIERS = [
  { id: "trading", mult: 2.0, names: [
    "Jane Street", "Citadel", "Optiver", "IMC", "Hudson River Trading", "Jump Trading", "Two Sigma",
    "DRW", "SIG", "Susquehanna", "Akuna", "D. E. Shaw", "DE Shaw", "Point72", "Millennium",
    "Tower Research", "XTX", "Squarepoint", "Qube Research", "G-Research", "Old Mission",
  ] },
  { id: "elite", mult: 1.35, names: [
    "Google", "Meta", "Apple", "Amazon", "Microsoft", "Netflix", "NVIDIA", "OpenAI", "Anthropic",
    "Stripe", "Databricks", "Palantir", "DeepMind", "Tesla", "SpaceX",
  ] },
  { id: "notable", mult: 1.15, names: [
    "Airbnb", "DoorDash", "Robinhood", "Coinbase", "Salesforce", "SAP", "Visa", "Nike", "Spotify",
    "Klarna", "Booking.com", "Reddit", "Pinterest", "Cloudflare", "Discord", "Figma", "Twilio",
    "Notion", "Duolingo", "Scale AI", "Shopify", "Roblox", "Block", "Instacart", "HubSpot",
    "Uber", "Lyft", "Snowflake", "Datadog", "Revolut", "Wise", "Adyen", "Celonis", "Personio",
  ] },
].map((tier) => ({ ...tier, names: tier.names.map((n) => n.toLowerCase()) }));

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Word-boundary, not plain substring -- mirrors config/load.ts's
// tierForCompany() fix (plain .includes() false-positived "Rheinmetall AG"
// into FAANG via "Meta", "Innowise" into NOTABLE via "Wise", etc.).
function tierFor(job) {
  const company = job.company.toLowerCase();
  return (
    COMPANY_TIERS.find((tier) =>
      tier.names.some((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`).test(company)),
    ) || null
  );
}

// Elite-tier names get the more specific "FAANG" word instead of the generic
// NOTABLE pill -- trading and notable tiers keep NOTABLE.
function tierBadge(job) {
  const tier = tierFor(job);
  if (!tier) return null;
  return tier.id === "elite" ? "FAANG" : "NOTABLE";
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

// --- Estimated pay ---------------------------------------------------------
// None of the sources expose salary reliably (only Adzuna does, and even then
// it's near-always empty -- see the DROPPED_COLUMNS note in pipeline/store.ts),
// so rather than show a blank column we model it. The estimate is a product of
// four public, coarse signals we already derive for every row: hub, company
// tier, track (level) and discipline. It is explicitly a market band, not a
// number scraped from the listing, and the UI labels it as such.
//
// Baselines are median hourly student/intern pay at a mid-tier company for a
// software role in that hub, in the currency an applicant there is actually
// paid in -- EUR for European hubs, USD for North American ones. European
// internships are legally often "Pflichtpraktikum"-style stipends, hence the
// much lower floor; this is the real market, not a modelling error.
const CURRENCY_SYMBOL = { eur: "\u20ac", usd: "$" };
const EUR_TO_USD = 1.08; // only used to make cross-currency sorting comparable

// Keyed by hub name; the currency comes from HUB_REGION above rather than being
// restated per entry.
const HUB_BASE = {
  Zurich: 33, London: 22, Dublin: 21, Amsterdam: 19, Munich: 18, Stockholm: 17,
  Berlin: 17, Helsinki: 16, Paris: 15, Barcelona: 12, Madrid: 12, Lisbon: 10,
  Warsaw: 10, Tallinn: 10,
  "San Francisco": 45, Seattle: 42, "New York": 42, Boston: 38, Austin: 35, "Los Angeles": 35,
  Chicago: 32, Vancouver: 30, Toronto: 30, Montreal: 27,
};

// Off-hub listings still need a currency. Anything carrying a US/Canadian
// marker is priced in USD; everything else falls back to the European band,
// since that's where the bulk of off-hub listings sit.
const NA_TOKENS = [
  "united states", "u.s.", "usa", ", us", "canada", "ontario", "quebec", "british columbia",
  "california", "washington", "new york", "texas", "massachusetts", "illinois", "colorado",
  "georgia", "florida", "virginia", "new jersey", "utah", "arizona", "oregon", "michigan",
  ", ca", ", ny", ", wa", ", tx", ", ma", ", nj", ", ut", ", il", ", co", ", or",
];

function marketFor(hub, locationText) {
  const base = HUB_BASE[hub];
  if (base) return { currency: HUB_REGION[hub] === "na" ? "usd" : "eur", base, known: true };
  const na = NA_TOKENS.some((token) => locationText.toLowerCase().includes(token));
  return { currency: na ? "usd" : "eur", base: na ? 32 : 14, known: false };
}

// A new grad is a salaried hire, not a student -- the hourly figure is their
// annual package divided down, so it sits well above the intern baseline.
// The label is the singular level noun used in the tooltip's basis line.
const TRACK_PAY = {
  intern: { mult: 1, label: "internship" },
  junior: { mult: 1.35, label: "junior" },
  newgrad: { mult: 1.6, label: "new grad" },
};

const CATEGORY_MULT = {
  quant: 1.35, ai: 1.15, swe: 1, hw: 0.95, product: 1, design: 0.85, biz: 0.8,
};

// Widen the band when we're extrapolating rather than pricing a known hub --
// an honest estimate should look less precise when it is less certain.
const SPREAD_KNOWN = 0.11;
const SPREAD_LOOSE = 0.18;

function estimatePay(job, listing) {
  const market = marketFor(listing.hub, job.location);
  const tier = tierFor(job);
  const level = TRACK_PAY[listing.track] || TRACK_PAY.intern;
  const mid =
    market.base *
    (tier ? tier.mult : 1) *
    level.mult *
    (CATEGORY_MULT[listing.category] || 1) *
    (job.advancedDegree ? 1.25 : 1);

  const spread = market.known ? SPREAD_KNOWN : SPREAD_LOOSE;

  return {
    // Kept unrounded and in the listing's native currency -- rounding and
    // symbol formatting happen at render time via formatPay(), once we know
    // which currency the user has toggled to display.
    currency: market.currency,
    low: mid * (1 - spread),
    high: mid * (1 + spread),
    // Normalised so the COMP sort compares a Berlin euro band against a
    // San Francisco dollar one instead of ordering by raw number.
    usdMid: market.currency === "eur" ? mid * EUR_TO_USD : mid,
    loose: !market.known || !tier,
    basis: [
      market.known ? listing.hub + " market" : "regional average",
      tier ? tier.id + "-tier company" : "market-rate company",
      level.label,
    ].join(" \u00b7 "),
  };
}

// Converts a raw pay amount between the two currencies the site knows about.
// EUR_TO_USD is the only rate in the system -- deliberately coarse, since this
// is already an estimate on top of an estimate.
function convertAmount(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount;
  return fromCurrency === "eur" ? amount * EUR_TO_USD : amount / EUR_TO_USD;
}

// Formats a pay band in whichever currency the user has selected (state.currency),
// regardless of the listing's native currency -- this is what makes "one
// currency for everything" possible without losing the underlying estimate.
function formatPay(pay, currency) {
  const symbol = CURRENCY_SYMBOL[currency];
  const low = Math.round(convertAmount(pay.low, pay.currency, currency));
  const high = Math.round(convertAmount(pay.high, pay.currency, currency));
  return symbol + low + "\u2013" + symbol + high;
}

function daysAgo(isoDate) {
  if (!isoDate) return 0;
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, days);
}

// Hours-aware sibling of daysAgo() -- every listing carries a real
// time-of-day timestamp (not midnight-padded), so freshness badges can be
// meaningfully derived down to the hour instead of only the day.
function hoursAgo(isoDate) {
  if (!isoDate) return 0;
  const hours = Math.floor((Date.now() - new Date(isoDate).getTime()) / (60 * 60 * 1000));
  return Math.max(0, hours);
}

// Opening Velocity: a qualitative freshness signal, not a fabricated
// applicant count. Thresholds are hours-based so "just opened" reflects the
// first day meaningfully instead of collapsing into the same DAYS bucket as
// everything else posted today. Only the single strongest signal is ever
// shown per row (see the caller) to keep the SIGNAL cell from getting noisy.
function velocityFor(hours) {
  if (hours < 24) return { id: "fresh", label: "JUST OPENED" };
  if (hours < 72) return { id: "hot", label: "HOT" };
  if (hours >= 14 * 24) return { id: "saturated", label: "LIKELY SATURATED" };
  return null;
}

// Adapts a raw pipeline job record into the design's listing shape (README
// "State" section): { id, hub, company, role, category, track, daysAgo,
// remote, flags[], url, pay }.
function toListing(job) {
  const flags = [];
  if (isEarly(job)) flags.push("EARLY");
  const badge = tierBadge(job);
  if (badge) flags.push(badge);
  if (job.advancedDegree) flags.push("PHD");
  const listing = {
    id: job.id,
    hub: hubFor(job),
    company: job.company,
    companySlug: job.companySlug,
    role: job.title,
    category: categoryFor(job),
    track: trackFor(job),
    daysAgo: daysAgo(job.postedDate),
    velocity: velocityFor(hoursAgo(job.postedDate)),
    remote: isRemote(job),
    flags,
    url: job.url,
    firstSeenAt: job.firstSeenAt,
  };
  listing.pay = estimatePay(job, listing);
  return listing;
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

// Company-level watchlist -- same shape as SAVED_KEY but keyed by companySlug
// instead of listing id. No accounts, no backend, single device: a deliberate
// scope boundary, not a gap. Duplicated in company.js (where the watch toggle
// lives) rather than shared -- same tradeoff as tierForCompany()/COMPANY_TIERS.
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

// companySlug has no stored display name (only the alias-normalized slug),
// so the watching panel title-cases the slug back into something readable.
// Loses casing nuance (e.g. "IBM" -> "Ibm") -- acceptable for a list label,
// since the link target (the company page) shows the real name.
function watchLabel(slug) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const CURRENCY_KEY = "radar.currency";

function loadCurrency() {
  try {
    const raw = localStorage.getItem(CURRENCY_KEY);
    return raw === "usd" || raw === "eur" ? raw : "usd";
  } catch {
    return "usd";
  }
}

function persistCurrency(currency) {
  try {
    localStorage.setItem(CURRENCY_KEY, currency);
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
  currency: loadCurrency(),
};

let LISTINGS = [];

const DEFAULT_TRACK = "intern";

// Rows render in pages of PAGE_SIZE rather than all at once, so the page
// doesn't force a long scroll past signal density / missed it / yc hiring
// just to reach them. visibleCount resets to PAGE_SIZE whenever the filter
// signature changes (track/category/hub/remote/saved/search/sort) but not
// on unrelated re-renders (currency toggle, saving a star), so "load more"
// state survives those.
const PAGE_SIZE = 20;
let visibleCount = PAGE_SIZE;
let lastFilterKey = "";

// EU has far more hubs than NA (24 vs 9 at time of writing) -- past this cap
// a chip row wraps onto multiple ragged lines instead of NA's clean single
// row. Collapse behind a "+N more" toggle instead; hubNames isn't
// track-filtered (see render()), so this doesn't need resetting alongside
// visibleCount.
const HUB_CHIP_CAP = 11;
let hubExpanded = { eu: false, na: false };

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
  sortPay: document.getElementById("sort-pay"),
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
  loadMoreRow: document.getElementById("load-more-row"),
  loadMore: document.getElementById("load-more"),
  missedSection: document.getElementById("missed-it"),
  missedList: document.getElementById("missed-list"),
  ycSection: document.getElementById("yc-hiring"),
  ycList: document.getElementById("yc-list"),
  ycRegionEu: document.getElementById("yc-region-eu"),
  ycRegionNa: document.getElementById("yc-region-na"),
  currencyToggle: document.getElementById("currency-toggle"),
  currencyGlyph: document.querySelector("#currency-toggle .currency-glyph"),
  watchBanner: document.getElementById("watch-banner"),
  watchingToggle: document.getElementById("watching-toggle"),
  watchingPanel: document.getElementById("watching-panel"),
  watchingList: document.getElementById("watching-list"),
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
    if (state.hub === "eu-all") { if (HUB_REGION[r.hub] !== "eu") return false; }
    else if (state.hub === "na-all") { if (HUB_REGION[r.hub] !== "na") return false; }
    else if (state.hub !== "all" && r.hub !== state.hub) return false;
    if (state.remoteOnly && !r.remote) return false;
    if (state.savedOnly && !state.saved[r.id]) return false;
    if (q && !(r.company + " " + r.role + " " + r.hub).toLowerCase().includes(q)) return false;
    return true;
  });

  if (state.sort === "co") rows = rows.slice().sort((a, b) => a.company.localeCompare(b.company));
  else if (state.sort === "hub") rows = rows.slice().sort((a, b) => a.hub.localeCompare(b.hub) || a.daysAgo - b.daysAgo);
  else if (state.sort === "pay") rows = rows.slice().sort((a, b) => b.pay.usdMid - a.pay.usdMid || a.daysAgo - b.daysAgo);
  else rows = rows.slice().sort((a, b) => a.daysAgo - b.daysAgo);

  const filterKey = JSON.stringify([track, state.cat, state.hub, state.remoteOnly, state.savedOnly, q, state.sort]);
  if (filterKey !== lastFilterKey) {
    visibleCount = PAGE_SIZE;
    lastFilterKey = filterKey;
  }

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
    { region: "eu", row: els.hubRowEu, chips: els.hubChipsEu, allId: "eu-all", allLabel: "All EU hubs" },
    { region: "na", row: els.hubRowNa, chips: els.hubChipsNa, allId: "na-all", allLabel: "All NA hubs" },
  ].forEach(({ region, row, chips, allId, allLabel }) => {
    const names = hubNames.filter((h) => HUB_REGION[h] === region);
    row.hidden = names.length === 0;
    const items = [{ id: allId, label: allLabel }].concat(toItems(names));

    const expanded = hubExpanded[region];
    const overflow = items.length - 1 - HUB_CHIP_CAP; // city chips beyond the cap; "All X hubs" doesn't count against it
    const visible = !expanded && overflow > 0 ? items.slice(0, 1 + HUB_CHIP_CAP) : items;
    renderChipRow(chips, visible, state.hub, onHubSelect);

    if (overflow > 0) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "chip chip--more";
      toggle.textContent = expanded ? "Show less" : `+${overflow} more`;
      toggle.addEventListener("click", () => {
        hubExpanded[region] = !expanded;
        render();
      });
      chips.appendChild(toggle);
    }
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
  els.sortPay.classList.toggle("active", state.sort === "pay");

  // currency toggle -- icon swap plus a solid fill on EUR, so switching
  // reads as a real state change rather than just the glyph changing.
  if (els.currencyToggle) {
    els.currencyGlyph.textContent = CURRENCY_SYMBOL[state.currency];
    els.currencyToggle.classList.toggle("is-eur", state.currency === "eur");
    els.currencyToggle.title = state.currency === "usd" ? "Showing USD — click for EUR" : "Showing EUR — click for USD";
  }

  // result line
  els.resultCount.textContent = pad2(rows.length) + " OF " + pad2(inTrack.length) + " " + trackLabel.toUpperCase();

  // rows -- only the current page renders; "load more" extends visibleCount
  els.rows.innerHTML = rows
    .slice(0, visibleCount)
    .map((r, i) => {
      const flags = (r.remote ? ["REMOTE"] : []).concat(r.flags);
      const saved = !!state.saved[r.id];
      const postedLabel = posted(r.daysAgo);
      const isToday = r.daysAgo === 0;
      const velocity = r.velocity;
      return `
        <div class="listing-row">
          <span class="row-no">${pad2(i + 1)}</span>
          <span class="row-hub">${escapeHtml(r.hub)}</span>
          <a class="row-company" href="company.html?slug=${encodeURIComponent(r.companySlug || "")}" title="${escapeHtml(r.company)}">${escapeHtml(r.company)}</a>
          <a href="${escapeHtml(r.url)}" target="_blank" rel="noreferrer" class="row-role">${escapeHtml(r.role)}</a>
          <span class="row-signal">${flags.map((f) => `<span class="signal-pill">${escapeHtml(f)}</span>`).join("")}</span>
          <span class="row-pay${r.pay.loose ? " is-loose" : ""}" title="Estimated — ${escapeHtml(r.pay.basis)}">${escapeHtml(formatPay(r.pay, state.currency))}<span class="pay-unit">/h</span></span>
          <span class="row-posted${isToday ? " is-today" : ""}">${velocity ? `<span class="velocity-dot velocity-${velocity.id}" title="${escapeHtml(velocity.label)}"></span>` : ""}${postedLabel}</span>
          <button type="button" class="row-save${saved ? " saved" : ""}" title="Save listing" data-id="${escapeHtml(r.id)}">${saved ? "★" : "☆"}</button>
        </div>`;
    })
    .join("");

  els.emptyState.hidden = rows.length !== 0;

  const remaining = rows.length - visibleCount;
  els.loadMoreRow.hidden = remaining <= 0;
  if (remaining > 0) els.loadMore.textContent = `LOAD MORE (${remaining})`;

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

els.loadMore.addEventListener("click", () => {
  visibleCount += PAGE_SIZE;
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
els.sortPay.addEventListener("click", () => { state.sort = "pay"; render(); });

if (els.currencyToggle) {
  els.currencyToggle.addEventListener("click", () => {
    state.currency = state.currency === "usd" ? "eur" : "usd";
    persistCurrency(state.currency);
    render();
  });
}

els.rows.addEventListener("click", (e) => {
  const btn = e.target.closest(".row-save");
  if (!btn) return;
  const id = btn.dataset.id;
  if (state.saved[id]) delete state.saved[id];
  else state.saved[id] = 1;
  persistSaved(state.saved);
  render();
});

// Runs once on load, independent of the filter/render cycle -- diffs the
// watchlist against today's listings client-side, no backend, no accounts.
function renderWatchBanner() {
  if (!els.watchBanner) return;
  const watching = loadWatching();
  const watchedSlugs = Object.keys(watching).filter((s) => watching[s]);
  const postedToday = new Set(
    LISTINGS.filter((r) => r.companySlug && watchedSlugs.includes(r.companySlug) && hoursAgo(r.firstSeenAt) < 24).map(
      (r) => r.companySlug,
    ),
  );
  if (postedToday.size === 0) {
    els.watchBanner.hidden = true;
    return;
  }
  els.watchBanner.hidden = false;
  els.watchBanner.textContent = `${postedToday.size} watched compan${postedToday.size === 1 ? "y" : "ies"} posted today`;
}

// Renders the watched-companies list into the topnav dropdown -- the only
// place to see what's on the watchlist, independent of whether the banner
// above has anything to show today. Runs off localStorage alone so it works
// before (and regardless of) the jobs.json fetch.
function renderWatchingPanel() {
  if (!els.watchingToggle) return;
  const watching = loadWatching();
  const slugs = Object.keys(watching).filter((s) => watching[s]).sort();
  els.watchingToggle.textContent = "Watching " + pad2(slugs.length);
  els.watchingList.innerHTML = slugs.length
    ? slugs
        .map(
          (slug) => `
          <div class="watching-row">
            <a href="company.html?slug=${encodeURIComponent(slug)}">${escapeHtml(watchLabel(slug))}</a>
            <button type="button" class="watching-unwatch" data-slug="${escapeHtml(slug)}" title="Stop watching">&times;</button>
          </div>`,
        )
        .join("")
    : '<div class="watching-empty">Not watching any companies yet — open a company page to start.</div>';
}

if (els.watchingToggle) {
  renderWatchingPanel();
  els.watchingToggle.addEventListener("click", () => {
    els.watchingPanel.hidden = !els.watchingPanel.hidden;
    if (!els.watchingPanel.hidden) renderWatchingPanel();
  });
  els.watchingPanel.addEventListener("click", (e) => {
    const btn = e.target.closest(".watching-unwatch");
    if (!btn) return;
    const current = loadWatching();
    delete current[btn.dataset.slug];
    persistWatching(current);
    renderWatchingPanel();
    renderWatchBanner();
  });
  document.addEventListener("click", (e) => {
    if (els.watchingPanel.hidden) return;
    if (els.watchingPanel.contains(e.target) || e.target === els.watchingToggle) return;
    els.watchingPanel.hidden = true;
  });
}

fetch("./data/jobs.json")
  .then((res) => res.json())
  .then((data) => {
    LISTINGS = data.map(toListing);
    render();
    renderWatchBanner();
  })
  .catch(() => {
    els.resultCount.textContent = "Failed to load listings.";
  });

// "Missed It" -- recently closed listings from top-tier companies (see
// config/tiers.json archiveTiers). Independent of the main render() cycle
// since it doesn't respond to filters; it only needs to run once. The
// section hides itself entirely when there's nothing to show yet, rather
// than rendering an empty box -- real closures take about a week of nightly
// runs to accumulate.
function renderMissedIt(closed) {
  if (!closed || closed.length === 0) {
    els.missedSection.hidden = true;
    return;
  }
  els.missedSection.hidden = false;
  els.missedList.innerHTML = closed
    .map((c) => {
      const closedDate = c.closedAt ? new Date(c.closedAt) : null;
      const dateLabel = closedDate
        ? closedDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : "";
      return `
        <div class="missed-row">
          <span class="missed-check" aria-hidden="true">&#10003;</span>
          <span class="missed-company">${escapeHtml(c.company)}</span>
          <span class="missed-role">${escapeHtml(c.title)}</span>
          <span class="missed-loc">${escapeHtml(c.location)}</span>
          <span class="missed-date">${escapeHtml(dateLabel)}</span>
        </div>`;
    })
    .join("");
}

fetch("./data/closed.json")
  .then((res) => res.json())
  .then((data) => renderMissedIt(data))
  .catch(() => {
    els.missedSection.hidden = true;
  });

// YC startups currently hiring (see pipeline/ycHiring.ts) -- a company
// directory, not job listings: yc-oss/api has no per-role data, so each row
// links out to the company's YC page rather than an apply URL. Both regions
// are fetched once; the toggle just switches which list is shown.
let ycData = { europe: [], northAmerica: [] };
let ycRegion = "europe";

function renderYc() {
  if (ycData.europe.length === 0 && ycData.northAmerica.length === 0) {
    els.ycSection.hidden = true;
    return;
  }
  els.ycSection.hidden = false;
  els.ycRegionEu.classList.toggle("active", ycRegion === "europe");
  els.ycRegionNa.classList.toggle("active", ycRegion === "northAmerica");
  els.ycList.innerHTML = ycData[ycRegion]
    .map(
      (c) => `
        <a class="yc-row" href="${escapeHtml(c.url)}" target="_blank" rel="noreferrer">
          <span class="yc-batch">${escapeHtml(c.batch)}</span>
          <span class="yc-company">${escapeHtml(c.name)}</span>
          <span class="yc-liner">${escapeHtml(c.oneLiner)}</span>
          <span class="yc-loc">${escapeHtml(c.location)}</span>
          <span class="yc-arrow" aria-hidden="true">&#8599;</span>
        </a>`,
    )
    .join("");
}

els.ycRegionEu.addEventListener("click", () => {
  ycRegion = "europe";
  renderYc();
});
els.ycRegionNa.addEventListener("click", () => {
  ycRegion = "northAmerica";
  renderYc();
});

fetch("./data/yc.json")
  .then((res) => res.json())
  .then((data) => {
    ycData = { europe: data.europe ?? [], northAmerica: data.northAmerica ?? [] };
    renderYc();
  })
  .catch(() => {
    els.ycSection.hidden = true;
  });
