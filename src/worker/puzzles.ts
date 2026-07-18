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

export function renderArchivePage(puzzles: PuzzleSummary[]): string {
  const tableRows = puzzles
    .sort((a, b) => b.num - a.num)
    .map(p =>
      `<tr class="row" data-num="${p.num}" data-date="${p.date}" data-clues="${p.clues}">
        <td><a href="/archive/${p.date}">${p.num}</a></td>
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
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Clumeral · Archive</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Inconsolata:wght@400;700&family=Quicksand:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<script>
  (function () {
    var t = localStorage.getItem("dlng_theme");
    if (!t) t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.classList.add(t);
    var THEMES = {
      Lime:   { light: "#0a850a", dark: "#1ead52" },
      Berry:  { light: "#de1f46", dark: "#ea6c85" },
      Blue:   { light: "#376ddb", dark: "#6393f2" },
      Violet: { light: "#9a44ea", dark: "#b679f0" }
    };
    var saved = localStorage.getItem("dlng_colour");
    var theme = THEMES[saved] || THEMES.Lime;
    var accent = t === "dark" ? theme.dark : theme.light;
    document.documentElement.style.setProperty("--color-accent", accent);
  })();
</script>
<style>
  :root {
    color-scheme: light dark;
    --color-bg:      #FAFAFA;
    --color-text:    #262624;
    --color-surface: #FFFFFF;
    --color-border:  rgba(38, 38, 36, 0.12);
    --color-accent:  #0a850a;
    /* Mirrors src/tailwind.css — see the token comments there. accent-strong is
       the AA-safe accent for text; on-accent is the text colour that sits ON an
       accent fill, and must flip to the page bg in dark (#243/#249). */
    --color-accent-strong: color-mix(in srgb, var(--color-accent) 82%, var(--color-text));
    --color-on-accent: #FFFFFF;
  }
  :root.dark {
    color-scheme: dark;
    --color-bg:      #121213;
    --color-text:    #FAF8F4;
    --color-surface: #363634;
    --color-border:  rgba(246, 240, 232, 0.1);
    --color-on-accent: var(--color-bg);
  }
  :root.light { color-scheme: light; }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { font-family: "Quicksand", system-ui, sans-serif; }
  body {
    background: var(--color-bg);
    color: var(--color-text);
    font-weight: 400;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }

  a { color: var(--color-accent-strong); text-decoration: none; }

  /* ─── Header strip (matches SPA app header) ─── */
  header.app-header {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    height: 3.5rem;
    padding: 0 1rem;
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
  }
  header.app-header .brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-text);
    /* Button reset — the brand is a no-nav bounce trigger, not a link, so it
       matches the SPA header brand (tap bounces the octopus, never navigates). */
    background: none;
    border: 0;
    padding: 0;
    font: inherit;
    cursor: pointer;
  }
  header.app-header .brand:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  header.app-header .brand .brand-octo {
    transform-origin: center bottom;
  }
  header.app-header .brand.bounce .brand-octo {
    animation: brand-bounce 0.5s ease;
  }
  @keyframes brand-bounce {
    0%   { transform: translateY(0); }
    30%  { transform: translateY(-12px); }
    55%  { transform: translateY(0); }
    75%  { transform: translateY(-4px); }
    100% { transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    header.app-header .brand.bounce .brand-octo { animation: none; }
  }
  header.app-header .wordmark {
    font-family: "Comfortaa", "Quicksand", system-ui, sans-serif;
    font-weight: 700;
    font-size: 1.25rem;
  }

  main.archive {
    flex: 1;
    width: 100%;
    max-width: 32rem;
    margin: 0 auto;
    padding: 1.25rem 1rem 2rem;
  }

  /* Button system — mirrors src/tailwind.css .btn/.btn-solid/.btn-hollow/.btn-sm */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 3rem;
    padding: 0.75rem 1rem;
    border-radius: 0.375rem;
    font-family: "Quicksand", system-ui, sans-serif;
    font-weight: 600;
    font-size: 1rem;
    line-height: 1;
    text-decoration: none;
    cursor: pointer;
    transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
  }
  .btn-solid { background: var(--color-accent); color: var(--color-on-accent); border: 1.5px solid var(--color-accent); }
  .btn-solid:hover { filter: brightness(1.08); }
  .btn-hollow { background: transparent; color: var(--color-accent-strong); border: 1.5px solid var(--color-accent-strong); }
  .btn-hollow:hover { background: color-mix(in srgb, var(--color-accent) 8%, transparent); }
  .btn-sm { min-height: 2rem; padding: 0.375rem 0.75rem; font-size: 0.875rem; gap: 0.375rem; }
  .btn svg { width: 1rem; height: 1rem; flex-shrink: 0; }
  .btn-sm svg { width: 0.875rem; height: 0.875rem; }

  .archive-actions { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
  .archive-actions .btn { flex: 1; }

  h1 {
    font-family: "Comfortaa", "Quicksand", system-ui, sans-serif;
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
  }
  .subtitle {
    font-size: 1rem;
    color: var(--color-text);
    margin-bottom: 1.5rem;
  }

  table { width: 100%; border-collapse: collapse; }
  th, td {
    padding: 0.6rem 0.5rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
  }
  th {
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text);
    white-space: nowrap;
    user-select: none;
  }
  th.sortable { cursor: pointer; }
  th.sortable .sort-label {
    text-decoration: underline;
    text-underline-offset: 0.2em;
    text-decoration-thickness: 1.5px;
    text-decoration-color: var(--color-text);
  }
  th.sortable:hover .sort-label {
    text-decoration-color: var(--color-text);
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
    font-family: "Inconsolata", ui-monospace, monospace;
    font-weight: 700;
    width: 3rem;
  }
  td:first-child a { color: var(--color-accent-strong); text-decoration: underline; }
  .num-col { font-family: "Inconsolata", ui-monospace, monospace; font-weight: 600; text-align: right; }
  th.num-header { text-align: right; }
  td.action-col { text-align: right; }

  tr.row { cursor: pointer; transition: background 0.1s; }
  tr.row:hover { background: color-mix(in srgb, var(--color-accent) 6%, transparent); }
  tr.row:active { background: color-mix(in srgb, var(--color-accent) 12%, transparent); }

  footer.app-footer {
    text-align: center;
    padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
    color: var(--color-text);
    font-size: 0.875rem;
  }
  footer.app-footer .heart {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    vertical-align: -0.15em;
    color: var(--color-accent);
  }
</style>
</head>
<body>
  <header class="app-header">
    <button type="button" class="brand" aria-label="Bounce Clumeral">
      <svg class="brand-octo" aria-hidden="true" width="24" height="24" viewBox="0 0 53 52" fill="none">
        <path d="M53 48C53 50.2091 51.2091 52 49 52H48C45.7909 52 44 50.2091 44 48V41H42V48C42 50.2091 40.2091 52 38 52H37C34.7909 52 33 50.2091 33 48V41H31V48C31 50.2091 29.2091 52 27 52H26C23.7909 52 22 50.2091 22 48V41H20V48C20 50.2091 18.2091 52 16 52H15C12.7909 52 11 50.2091 11 48V41H9V48C9 50.2091 7.20914 52 5 52H4C1.79086 52 6.44266e-08 50.2091 0 48V15C1.9329e-07 6.71573 6.71573 0 15 0H38C46.2843 5.47619e-07 53 6.71573 53 15V48Z" fill="var(--color-accent)"/>
        <circle cx="19" cy="15" r="2.5" fill="#F6F0E8"/>
        <circle cx="33" cy="15" r="2.5" fill="#F6F0E8"/>
        <path d="M21 26C24.3333 27.3333 27.6667 27.3333 31 26" stroke="#F6F0E8" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <span class="wordmark">Clumeral</span>
    </button>
  </header>

  <main class="archive">
    <div class="archive-actions"><a href="/play" class="btn btn-hollow"><svg aria-hidden="true"><use href="/sprites.svg#icon-puzzle"/></svg>Show puzzle</a><a href="/solved" class="btn btn-hollow"><svg aria-hidden="true"><use href="/sprites.svg#icon-stats"/></svg>Show stats</a></div>
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
  </main>

  <footer class="app-footer">
    Made with
    <svg class="heart" role="img" aria-label="love" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
    by Jamie &amp; Dave. &copy; 2026.
  </footer>

<script>
// Header brand: bounce the octopus on tap, never navigate — mirrors the SPA
// header brand (src/app.ts [data-brand] → bounceBrand). Re-armable each tap.
(function() {
  var brand = document.querySelector(".brand");
  if (!brand) return;
  brand.addEventListener("click", function() {
    brand.classList.remove("bounce");
    void brand.offsetWidth; // reflow so the animation can replay
    brand.classList.add("bounce");
  });
  brand.addEventListener("animationend", function() {
    brand.classList.remove("bounce");
  });
})();

// Populate tries column from localStorage
(function() {
  var history = [];
  try { history = JSON.parse(localStorage.getItem("dlng_history") || "[]"); } catch(e) {}
  var byDate = {};
  for (var i = 0; i < history.length; i++) byDate[history[i].date] = history[i].tries;

  var rows = document.querySelectorAll("tr.row");
  for (var r = 0; r < rows.length; r++) {
    var date = rows[r].getAttribute("data-date");
    var cell = rows[r].querySelector("[data-tries]");
    if (byDate[date] != null) {
      cell.textContent = byDate[date];
    } else {
      cell.innerHTML = '<a href="/archive/' + rows[r].getAttribute("data-date") + '" class="btn btn-solid btn-sm"><svg aria-hidden="true"><use href="/sprites.svg#icon-play"/></svg>Play</a>';
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
    if (e.target.closest && e.target.closest("a")) return;
    location.href = "/archive/" + row.getAttribute("data-date");
  });
});
</script>
</body>
</html>`;
}
