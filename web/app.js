let allJobs = [];
let sortKey = "postedDate";
let sortDir = -1;

const tbody = document.querySelector("#jobs-table tbody");
const searchInput = document.getElementById("search");
const hubFilter = document.getElementById("hub-filter");
const countEl = document.getElementById("count");
const emptyState = document.getElementById("empty-state");

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const hub = hubFilter.value;

  let rows = allJobs.filter((job) => {
    const matchesQuery =
      !query || job.title.toLowerCase().includes(query) || job.company.toLowerCase().includes(query);
    const matchesHub = !hub || job.location.includes(hub);
    return matchesQuery && matchesHub;
  });

  rows.sort((a, b) => {
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    return av < bv ? -sortDir : av > bv ? sortDir : 0;
  });

  tbody.innerHTML = rows
    .map(
      (job) => `
    <tr>
      <td>${escapeHtml(job.location)}</td>
      <td>${escapeHtml(job.company)}</td>
      <td><a href="${escapeAttr(job.url)}" target="_blank" rel="noopener">${escapeHtml(job.title)}</a></td>
      <td>${job.postedDate ? new Date(job.postedDate).toLocaleDateString() : "-"}</td>
    </tr>`,
    )
    .join("");

  countEl.textContent = `${rows.length} listing${rows.length === 1 ? "" : "s"}`;
  emptyState.hidden = rows.length !== 0;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function escapeAttr(str) {
  return escapeHtml(str);
}

function populateHubFilter() {
  const hubs = [...new Set(allJobs.map((j) => j.location))].sort();
  for (const hub of hubs) {
    const opt = document.createElement("option");
    opt.value = hub;
    opt.textContent = hub;
    hubFilter.appendChild(opt);
  }
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

searchInput.addEventListener("input", render);
hubFilter.addEventListener("change", render);

fetch("./data/jobs.json")
  .then((res) => res.json())
  .then((data) => {
    allJobs = data;
    populateHubFilter();
    render();
  })
  .catch(() => {
    countEl.textContent = "Failed to load listings.";
  });
