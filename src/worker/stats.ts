// Analytics Engine query helpers and stats dashboard

interface Env {
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
}

interface QueryResult {
  data: Record<string, string | number>[];
  rows: number;
}

async function query(env: Env, sql: string): Promise<QueryResult> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
        "Content-Type": "text/plain",
      },
      body: sql,
    },
  );
  if (!res.ok) throw new Error(`Analytics query failed: ${res.status}`);
  return res.json() as Promise<QueryResult>;
}

function intervalClause(days: number): string {
  return days > 0 ? `WHERE timestamp > NOW() - INTERVAL '${days}' DAY` : "";
}

export async function getStats(env: Env, days: number) {
  const where = intervalClause(days);

  const [events, daily, uniqueUsers, guessDistribution] = await Promise.all([
    // Event totals by type
    query(
      env,
      `SELECT blob1 AS event, COUNT() AS count FROM clumeral ${where} GROUP BY blob1 ORDER BY count DESC`,
    ),
    // Daily event counts
    query(
      env,
      `SELECT toStartOfDay(timestamp) AS day, blob1 AS event, COUNT() AS count FROM clumeral ${where} GROUP BY day, event ORDER BY day ASC`,
    ),
    // Unique users
    query(
      env,
      `SELECT COUNT(DISTINCT blob2) AS total, SUM(CASE WHEN double2 = 1 THEN 1 ELSE 0 END) AS new_users FROM clumeral ${where} AND blob1 = 'puzzle_start'`,
    ),
    // Guess distribution for completed puzzles
    query(
      env,
      `SELECT double1 AS guesses, COUNT() AS count FROM clumeral ${where} AND blob1 = 'puzzle_complete' GROUP BY guesses ORDER BY guesses ASC`,
    ),
  ]);

  return { events, daily, uniqueUsers, guessDistribution };
}

export function renderDashboard(
  stats: Awaited<ReturnType<typeof getStats>>,
  days: number,
): string {
  const eventMap = new Map<string, number>();
  for (const row of stats.events.data) {
    eventMap.set(row.event as string, Number(row.count));
  }

  const totalPlays = (eventMap.get("puzzle_start") ?? 0);
  const completions = (eventMap.get("puzzle_complete") ?? 0);
  const incorrectGuesses = (eventMap.get("incorrect_guess") ?? 0);
  const completionRate = totalPlays > 0 ? ((completions / totalPlays) * 100).toFixed(1) : "0";
  const uniqueTotal = Number(stats.uniqueUsers.data[0]?.total ?? 0);
  const newUsers = Number(stats.uniqueUsers.data[0]?.new_users ?? 0);
  const returningUsers = uniqueTotal - newUsers;

  // Daily plays for chart
  const dailyPlays = new Map<string, number>();
  for (const row of stats.daily.data) {
    if (row.event === "puzzle_start") {
      const day = String(row.day).slice(0, 10);
      dailyPlays.set(day, Number(row.count));
    }
  }
  const dailyEntries = [...dailyPlays.entries()].sort();
  const maxDaily = Math.max(1, ...dailyEntries.map(([, v]) => v));
  const dailyAvg =
    dailyEntries.length > 0
      ? (dailyEntries.reduce((s, [, v]) => s + v, 0) / dailyEntries.length).toFixed(1)
      : "0";

  // SVG chart
  const chartW = 600;
  const chartH = 200;
  const barW = dailyEntries.length > 0 ? Math.max(2, Math.floor(chartW / dailyEntries.length) - 2) : 4;
  const bars = dailyEntries
    .map(([, v], i) => {
      const h = (v / maxDaily) * (chartH - 20);
      const x = i * (barW + 2);
      const y = chartH - h;
      return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="1" fill="var(--acc)"/>`;
    })
    .join("");

  // Guess distribution bars
  const guessRows = stats.guessDistribution.data
    .map((row) => {
      const g = Number(row.guesses);
      const c = Number(row.count);
      return `<tr><td>${g}</td><td>${c}</td></tr>`;
    })
    .join("");

  // Interaction events
  const interactions = [
    ["htp_opened", "How to Play opened"],
    ["htp_dismissed", "How to Play dismissed"],
    ["feedback_submitted", "Feedback submitted"],
    ["theme_toggle", "Theme toggled"],
    ["colour_change", "Colour changed"],
    ["tooltip_opened", "Tooltip opened"],
  ]
    .map(
      ([key, label]) =>
        `<tr><td>${label}</td><td>${eventMap.get(key) ?? 0}</td></tr>`,
    )
    .join("");

  const periodLabel = days > 0 ? `Last ${days} days` : "All time (90 day max)";
  const periodLinks = [30, 60, 90, 0]
    .map((d) => {
      const label = d > 0 ? `${d}d` : "All";
      const active = d === days ? ' class="active"' : "";
      return `<a href="/stats${d > 0 ? `?period=${d}` : ""}"${active}>${label}</a>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Clumeral Stats</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Inconsolata:wght@500;700&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: light dark; }
  :root.dark { color-scheme: dark; }
  :root.light { color-scheme: light; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "DM Sans", system-ui, sans-serif;
    background: light-dark(#f5edd8, #262624);
    color: light-dark(#262624, #f6f0e8);
    padding: 1.5rem;
    max-width: 40rem;
    margin: 0 auto;
  }
  h1 { font-size: 1.5rem; margin-block-end: 0.25rem; }
  .period-label { color: light-dark(rgba(38,38,36,0.7), rgba(246,240,232,0.6)); margin-block-end: 1rem; }
  .period-nav { display: flex; gap: 0.5rem; margin-block-end: 1.5rem; }
  .period-nav a {
    font-family: "Inconsolata", monospace;
    font-weight: 700;
    font-size: 0.875rem;
    text-decoration: none;
    padding: 0.25rem 0.75rem;
    border-radius: 0.25rem;
    border: 1.5px solid light-dark(#bc3c2c, #ff8070);
    color: light-dark(#bc3c2c, #ff8070);
    background: transparent;
    transition: background 0.2s, color 0.2s;
  }
  .period-nav a.active,
  .period-nav a:hover {
    background: #bc3c2c;
    color: #fff;
  }
  --acc: light-dark(#bc3c2c, #ff8070);
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); gap: 0.75rem; margin-block-end: 1.5rem; }
  .card {
    background: light-dark(#fffdf7, #2e2e2c);
    border-radius: 0.375rem;
    padding: 1rem;
    box-shadow: 3px 3px 0 light-dark(rgba(38,38,36,0.08), rgba(0,0,0,0.25));
    border: 1px solid light-dark(rgba(38,38,36,0.12), rgba(255,253,247,0.1));
  }
  .card__val { font-family: "Inconsolata", monospace; font-size: 2rem; font-weight: 700; }
  .card__label { font-size: 0.8125rem; color: light-dark(rgba(38,38,36,0.7), rgba(246,240,232,0.6)); margin-block-start: 0.25rem; }
  section { margin-block-end: 1.5rem; }
  h2 { font-size: 1.125rem; margin-block-end: 0.75rem; }
  .chart-wrap { overflow-x: auto; }
  .chart-wrap svg { display: block; }
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  td, th { padding: 0.375rem 0.5rem; text-align: left; border-bottom: 1px solid light-dark(rgba(38,38,36,0.12), rgba(255,253,247,0.1)); }
  td:last-child, th:last-child { text-align: right; font-family: "Inconsolata", monospace; font-weight: 700; }
</style>
</head>
<body>
  <h1>Clumeral Stats</h1>
  <p class="period-label">${periodLabel}</p>
  <nav class="period-nav">${periodLinks}</nav>

  <div class="cards">
    <div class="card"><div class="card__val">${uniqueTotal}</div><div class="card__label">Unique users</div></div>
    <div class="card"><div class="card__val">${newUsers}</div><div class="card__label">New users</div></div>
    <div class="card"><div class="card__val">${returningUsers}</div><div class="card__label">Returning</div></div>
    <div class="card"><div class="card__val">${totalPlays}</div><div class="card__label">Puzzles played</div></div>
    <div class="card"><div class="card__val">${completions}</div><div class="card__label">Completed</div></div>
    <div class="card"><div class="card__val">${completionRate}%</div><div class="card__label">Completion rate</div></div>
    <div class="card"><div class="card__val">${dailyAvg}</div><div class="card__label">Avg daily plays</div></div>
    <div class="card"><div class="card__val">${incorrectGuesses}</div><div class="card__label">Incorrect guesses</div></div>
  </div>

  <section>
    <h2>Daily plays</h2>
    <div class="chart-wrap">
      <svg width="${Math.max(chartW, dailyEntries.length * (barW + 2))}" height="${chartH}" role="img" aria-label="Daily plays chart">
        ${bars}
      </svg>
    </div>
  </section>

  <section>
    <h2>Guess distribution</h2>
    <table>
      <tr><th>Guesses</th><th>Count</th></tr>
      ${guessRows || "<tr><td colspan='2'>No data yet</td></tr>"}
    </table>
  </section>

  <section>
    <h2>Interactions</h2>
    <table>
      <tr><th>Event</th><th>Count</th></tr>
      ${interactions}
    </table>
  </section>

  <script>
    const theme = localStorage.getItem('dlng_theme');
    if (theme) document.documentElement.classList.add(theme);
  </script>
</body>
</html>`;
}
