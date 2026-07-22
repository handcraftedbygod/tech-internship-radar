const ROLE_PRESETS = [
  { label: "All roles", keywords: [] },
  { label: "Software Engineering", keywords: ["software", "engineer", "developer", "backend", "frontend", "full stack", "devops"] },
  { label: "Data & Analytics", keywords: ["data", "analytics", "analyst", "bi ", "machine learning", "ml "] },
  { label: "Product & Design", keywords: ["product", "design", "ux", "ui "] },
  { label: "Business & Marketing", keywords: ["marketing", "sales", "business", "growth", "operations"] },
];

// City-specific tokens only (no country-wide aliases like "Germany"/"France") so
// the hub chips stay a clean ~13-city list instead of every raw location string
// a source happens to report. Anything that doesn't match one of these falls
// into "Other" rather than being force-bucketed into a same-country hub.
const HUBS = [
  { name: "Tallinn", match: ["tallinn"] },
  { name: "Berlin", match: ["berlin"] },
  { name: "Munich", match: ["munich", "münchen", "munchen"] },
  { name: "Amsterdam", match: ["amsterdam"] },
  { name: "Dublin", match: ["dublin"] },
  { name: "London", match: ["london"] },
  { name: "Paris", match: ["paris"] },
  { name: "Stockholm", match: ["stockholm"] },
  { name: "Helsinki", match: ["helsinki"] },
  { name: "Warsaw", match: ["warsaw", "warszawa"] },
  { name: "Barcelona", match: ["barcelona"] },
  { name: "Lisbon", match: ["lisbon", "lisboa"] },
  { name: "Zurich", match: ["zurich", "zürich"] },
  { name: "New York", match: ["new york", "nyc"] },
  { name: "San Francisco", match: ["san francisco", "bay area", "san jose", "silicon valley"] },
  { name: "Seattle", match: ["seattle"] },
  { name: "Austin", match: ["austin"] },
  { name: "Toronto", match: ["toronto"] },
  { name: "Vancouver", match: ["vancouver"] },
];
const OTHER_HUB = "Other";

function hubFor(job) {
  const text = job.location.toLowerCase();
  const hit = HUBS.find((hub) => hub.match.some((token) => text.includes(token)));
  return hit ? hit.name : OTHER_HUB;
}

// Best-effort inference from free text, like hubFor() -- sources don't expose
// a clean "workplace type" field. Hybrid folds into "remote-friendly" here
// since it's vanishingly rare on its own in this data (internships are
// overwhelmingly on-site) and doesn't warrant its own filter bucket.
function isRemote(job) {
  const text = `${job.location} ${job.title}`.toLowerCase();
  return text.includes("remote") || text.includes("hybrid");
}

const PAGE_SIZE = 20;

let allJobs = [];
let sortKey = "postedDate";
let sortDir = -1;
let activeHub = "";
let activeRole = ROLE_PRESETS[0].label;
let remoteOnly = false;
let visibleCount = PAGE_SIZE;

const tbody = document.querySelector("#jobs-table tbody");
const searchInput = document.getElementById("search");
const hubChipsEl = document.getElementById("hub-chips");
const roleChipsEl = document.getElementById("role-chips");
const remoteToggle = document.getElementById("remote-toggle");
const countEl = document.getElementById("count");
const emptyState = document.getElementById("empty-state");
const themeToggle = document.getElementById("theme-toggle");
const loadMoreBtn = document.getElementById("load-more");
const lastUpdatedEl = document.getElementById("last-updated");

function matchesRole(job, roleLabel) {
  if (roleLabel === ROLE_PRESETS[0].label) return true;
  const preset = ROLE_PRESETS.find((r) => r.label === roleLabel);
  const title = job.title.toLowerCase();
  return preset.keywords.some((kw) => title.includes(kw));
}

function resetPageAndRender() {
  visibleCount = PAGE_SIZE;
  render();
}

function render() {
  const query = searchInput.value.trim().toLowerCase();

  let rows = allJobs.filter((job) => {
    const matchesQuery =
      !query || job.title.toLowerCase().includes(query) || job.company.toLowerCase().includes(query);
    const matchesHub = !activeHub || hubFor(job) === activeHub;
    const matchesRemote = !remoteOnly || isRemote(job);
    return matchesQuery && matchesHub && matchesRemote && matchesRole(job, activeRole);
  });

  rows.sort((a, b) => {
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    return av < bv ? -sortDir : av > bv ? sortDir : 0;
  });

  const visibleRows = rows.slice(0, visibleCount);

  tbody.innerHTML = visibleRows
    .map(
      (job) => `
    <tr data-url="${escapeAttr(job.url)}" tabindex="0">
      <td>${escapeHtml(job.location)}</td>
      <td>${escapeHtml(job.company)}</td>
      <td><a href="${escapeAttr(job.url)}" target="_blank" rel="noopener">${escapeHtml(job.title)}</a></td>
      <td>${job.postedDate ? postedCell(job.postedDate) : "-"}</td>
    </tr>`,
    )
    .join("");

  countEl.textContent = `${visibleRows.length} of ${rows.length} listing${rows.length === 1 ? "" : "s"}`;
  emptyState.hidden = rows.length !== 0;

  const remaining = rows.length - visibleRows.length;
  loadMoreBtn.hidden = remaining <= 0;
  loadMoreBtn.textContent = `Load ${Math.min(PAGE_SIZE, remaining)} more (${remaining} remaining)`;

  updateSortCarets();
}

// Every listing is <= settings.maxAgeDays old by the time it's exported, so a
// relative label ("Today", "2d ago") is more scannable than a raw date and
// never needs to fall back to a long-form date.
function relativeDate(isoDate) {
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

function postedCell(isoDate) {
  const label = relativeDate(isoDate);
  return label === "Today" ? `<span class="posted-fresh">${label}</span>` : label;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function escapeAttr(str) {
  return escapeHtml(str);
}

function renderChips(container, labels, activeValue, onSelect) {
  container.innerHTML = "";
  for (const label of labels) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (label === activeValue ? " active" : "");
    btn.textContent = label;
    btn.addEventListener("click", () => onSelect(label));
    container.appendChild(btn);
  }
}

function renderHubChips() {
  const present = new Set(allJobs.map((j) => hubFor(j)));
  const ordered = [...HUBS.map((h) => h.name), OTHER_HUB].filter((name) => present.has(name));
  const labels = ["All hubs", ...ordered];
  renderChips(hubChipsEl, labels, activeHub || "All hubs", (label) => {
    activeHub = label === "All hubs" ? "" : label;
    renderHubChips();
    resetPageAndRender();
  });
}

function renderRoleChips() {
  renderChips(
    roleChipsEl,
    ROLE_PRESETS.map((r) => r.label),
    activeRole,
    (label) => {
      activeRole = label;
      renderRoleChips();
      resetPageAndRender();
    },
  );
}

function updateSortCarets() {
  document.querySelectorAll("th[data-key]").forEach((th) => {
    const existing = th.querySelector(".caret");
    if (existing) existing.remove();
    if (th.dataset.key === sortKey) {
      const caret = document.createElement("span");
      caret.className = "caret";
      caret.textContent = sortDir === 1 ? "▲" : "▼";
      th.appendChild(caret);
    }
  });
}

document.querySelectorAll("th[data-key]").forEach((th) => {
  th.addEventListener("click", () => {
    const key = th.dataset.key;
    if (sortKey === key) {
      sortDir *= -1;
    } else {
      sortKey = key;
      sortDir = 1;
    }
    render();
  });
});

searchInput.addEventListener("input", resetPageAndRender);

remoteToggle.addEventListener("click", () => {
  remoteOnly = !remoteOnly;
  remoteToggle.classList.toggle("active", remoteOnly);
  remoteToggle.setAttribute("aria-pressed", String(remoteOnly));
  resetPageAndRender();
});

loadMoreBtn.addEventListener("click", () => {
  visibleCount += PAGE_SIZE;
  render();
});

tbody.addEventListener("click", (e) => {
  if (e.target.closest("a")) return; // let the title link's own navigation happen
  const row = e.target.closest("tr[data-url]");
  if (row) window.open(row.dataset.url, "_blank", "noopener");
});

tbody.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const row = e.target.closest("tr[data-url]");
  if (row) window.open(row.dataset.url, "_blank", "noopener");
});

themeToggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("theme", next);
});

fetch("./data/jobs.json")
  .then((res) => res.json())
  .then((data) => {
    allJobs = data;
    renderHubChips();
    renderRoleChips();
    render();
  })
  .catch(() => {
    countEl.textContent = "Failed to load listings.";
  });

fetch("./data/meta.json")
  .then((res) => res.json())
  .then((meta) => {
    const formatted = new Date(meta.generatedAt).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    lastUpdatedEl.textContent = `Last updated ${formatted}`;
  })
  .catch(() => {
    // meta.json may not exist yet (e.g. before the first pipeline run after
    // this feature shipped) -- leave the element empty rather than erroring.
  });
