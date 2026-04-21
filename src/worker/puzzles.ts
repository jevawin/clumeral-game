// Worker-rendered puzzle history page at /puzzles

interface PuzzleSummary {
  num: number;
  date: string;
  clues: number;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDate();
  const mon = d.toLocaleDateString('en-GB', { month: 'short' });
  const yr = d.getFullYear();
  const now = new Date().getFullYear();
  return yr !== now ? `${day} ${mon}, ${String(yr).slice(2)}` : `${day} ${mon}`;
}

export function renderPuzzlesPage(puzzles: PuzzleSummary[]): string {
  const rows = puzzles
    .sort((a, b) => b.num - a.num)
    .map(p => `["${p.date}",${p.num},${p.clues}]`)
    .join(',');

  const tableRows = puzzles
    .sort((a, b) => b.num - a.num)
    .map(p =>
      `<tr class="row" data-num="${p.num}" data-date="${p.date}" data-clues="${p.clues}">
        <td><a href="/puzzles/${p.num}">${p.num}</a></td>
        <td>${fmtDate(p.date)}</td>
        <td class="num-col">${p.clues}</td>
        <td class="num-col" data-tries></td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Clumeral — Puzzles</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Inconsolata:wght@500;700&display=swap" rel="stylesheet">
<script>
  (function () {
    var t = localStorage.getItem("dlng_theme");
    if (!t) t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.classList.add(t);
  })();
</script>
<style>
  :root { color-scheme: light dark; --acc: light-dark(#0a850a, #1ead52); }
  :root.dark { color-scheme: dark; }
  :root.light { color-scheme: light; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Quicksand", system-ui, sans-serif;
    background: light-dark(#f5edd8, #262624);
    color: light-dark(#262624, #f6f0e8);
    padding: 1.5rem 1rem;
    max-width: 32rem;
    margin: 0 auto;
  }
  a { color: var(--acc); text-decoration: none; border-block-end: 1px solid currentColor; padding-block-end: 0.125rem; }
  .back { font-size: 1rem; margin-block-end: 1rem; display: inline-block; }
  h1 { font-size: 1.5rem; margin-block-end: 0.25rem; }
  .subtitle {
    font-size: 1rem;
    color: light-dark(rgba(38,38,36,0.7), rgba(246,240,232,0.6));
    margin-block-end: 1.5rem;
  }
  table { width: 100%; border-collapse: collapse; }
  th, td {
    padding: 0.5rem 0.5rem;
    text-align: left;
    border-bottom: 1px solid light-dark(rgba(38,38,36,0.1), rgba(255,253,247,0.08));
  }
  th {
    font-size: 1rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: light-dark(rgba(38,38,36,0.5), rgba(246,240,232,0.4));
    border-bottom: 2px solid light-dark(rgba(38,38,36,0.15), rgba(255,253,247,0.12));
    white-space: nowrap;
    user-select: none;
  }
  th.sortable { cursor: pointer; }
  th.sortable .sort-label {
    text-decoration: underline;
    text-underline-offset: 0.2em;
    text-decoration-thickness: 1.5px;
    text-decoration-color: light-dark(rgba(38,38,36,0.3), rgba(246,240,232,0.3));
  }
  th.sortable:hover .sort-label {
    text-decoration-color: light-dark(rgba(38,38,36,0.6), rgba(246,240,232,0.6));
  }
  .sort-icon {
    display: none;
    width: 12px;
    height: 12px;
    vertical-align: -1px;
    margin-inline-start: 0.2rem;
    transition: transform 0.15s;
  }
  th.sorted .sort-icon { display: inline-block; }
  th.sorted.asc .sort-icon { transform: rotate(180deg); }
  td:first-child {
    font-family: "Inconsolata", monospace;
    font-weight: 700;
    width: 3rem;
  }
  td:first-child a {
    color: var(--acc);
  }
  .num-col { font-family: "Inconsolata", monospace; font-weight: 600; text-align: right; }
  th.num-header { text-align: right; }
  .play-link {
    font-family: "Quicksand", system-ui, sans-serif;
    font-weight: 600;
    font-size: 1rem;
  }
  tr.row { cursor: pointer; transition: background 0.1s; }
  tr.row:hover { background: light-dark(rgba(10,133,10,0.04), rgba(30,173,82,0.06)); }
  tr.row:active { background: light-dark(rgba(10,133,10,0.08), rgba(30,173,82,0.1)); }
</style>
</head>
<body>
  <a href="/" class="back">&larr; Back to today's puzzle</a>
  <h1>Every Clumeral ever.</h1>
  <p class="subtitle">Tap to view a puzzle. Tap a column to sort by it.</p>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th class="sortable sorted desc" data-sort="date" data-type="num"><span class="sort-label">Date</span> <svg class="sort-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></th>
        <th class="sortable num-header" data-sort="clues" data-type="num"><span class="sort-label">Clues</span> <svg class="sort-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></th>
        <th class="num-header">Tries</th>
      </tr>
    </thead>
    <tbody id="tbody">
      ${tableRows}
    </tbody>
  </table>

<script>
// Populate tries column from localStorage
(function() {
  var history = [];
  try { history = JSON.parse(localStorage.getItem("dlng_history") || "[]"); } catch(e) {}
  var byDate = {};
  for (var i = 0; i < history.length; i++) byDate[history[i].date] = history[i].tries;

  var rows = document.querySelectorAll("tr.row");
  for (var r = 0; r < rows.length; r++) {
    var date = rows[r].getAttribute("data-date");
    var num = rows[r].getAttribute("data-num");
    var cell = rows[r].querySelector("[data-tries]");
    if (byDate[date] != null) {
      cell.textContent = byDate[date];
    } else {
      cell.innerHTML = '<a href="/puzzles/' + num + '" class="play-link">Play</a>';
    }
  }
})();

// Sorting
var sortKey = "date";
var sortAsc = false;
var tbody = document.getElementById("tbody");

function sortRows() {
  var rows = Array.from(tbody.querySelectorAll("tr.row"));
  rows.sort(function(a, b) {
    var va, vb;
    if (sortKey === "date") {
      va = parseInt(a.getAttribute("data-num"));
      vb = parseInt(b.getAttribute("data-num"));
    } else {
      va = parseInt(a.getAttribute("data-" + sortKey));
      vb = parseInt(b.getAttribute("data-" + sortKey));
    }
    return sortAsc ? va - vb : vb - va;
  });
  for (var i = 0; i < rows.length; i++) tbody.appendChild(rows[i]);
}

document.querySelectorAll("th.sortable").forEach(function(th) {
  th.addEventListener("click", function() {
    var key = th.getAttribute("data-sort");
    if (sortKey === key) { sortAsc = !sortAsc; }
    else { sortKey = key; sortAsc = false; }
    document.querySelectorAll("th.sortable").forEach(function(h) {
      h.classList.remove("sorted", "asc", "desc");
    });
    th.classList.add("sorted", sortAsc ? "asc" : "desc");
    sortRows();
  });
});

// Row click navigation
document.querySelectorAll("tr.row").forEach(function(row) {
  row.addEventListener("click", function(e) {
    if (e.target.tagName === "A") return;
    location.href = "/puzzles/" + row.getAttribute("data-num");
  });
});
</script>
</body>
</html>`;
}
