// Admin feedback view (#213). Renders submissions from D1 as a simple HTML table.
// Token-guarded by the caller (see GET /feedback in index.ts). All user-controlled
// values are HTML-escaped here — message/category/userAgent are attacker-influenced.

export interface FeedbackRow {
  id: number;
  created_at: string;
  category: string | null;
  message: string | null;
  puzzle_number: string | null;
  puzzle_date: string | null;
  device: string | null;
  browser: string | null;
  user_agent: string | null;
  history: string | null;
  prefs: string | null;
  active: string | null;
  tz_offset: number | null;
  local_today: string | null;
  screen: string | null;
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Collapsible cell for the raw localStorage debug blobs — kept out of the way but
// available for reproducing a report.
function debug(row: FeedbackRow): string {
  const parts = [
    ["history", row.history],
    ["prefs", row.prefs],
    ["active", row.active],
    ["userAgent", row.user_agent],
    ["screen", row.screen],
    ["tzOffset", row.tz_offset],
    ["localToday", row.local_today],
  ].filter(([, v]) => v !== null && v !== "");
  if (!parts.length) return "<span class=\"muted\">—</span>";
  const body = parts.map(([k, v]) => `<div><b>${esc(k)}:</b> ${esc(v)}</div>`).join("");
  return `<details><summary>debug</summary><div class="dbg">${body}</div></details>`;
}

export function renderFeedbackTable(rows: FeedbackRow[], hostname: string): string {
  const tbody = rows.length
    ? rows
        .map(
          (r) => `<tr>
        <td class="num">${esc(r.id)}</td>
        <td class="nowrap">${esc(r.created_at)}</td>
        <td><span class="cat cat-${esc(r.category)}">${esc(r.category)}</span></td>
        <td class="msg">${esc(r.message)}</td>
        <td class="nowrap">${esc(r.puzzle_number)}</td>
        <td class="nowrap">${esc(r.puzzle_date)}</td>
        <td>${esc(r.device)}</td>
        <td>${esc(r.browser)}</td>
        <td>${debug(r)}</td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="9" class="muted center">No feedback yet.</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Feedback · ${esc(hostname)}</title>
<style>
  :root { color-scheme: light dark; --acc: light-dark(#2563eb, #60a5fa); --line: light-dark(#e5e7eb, #374151); --muted: light-dark(#6b7280, #9ca3af); }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 1.5rem; line-height: 1.4; }
  h1 { font-size: 1.25rem; margin: 0 0 0.25rem; }
  .sub { color: var(--muted); font-size: 0.85rem; margin: 0 0 1rem; }
  table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
  th, td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { position: sticky; top: 0; background: Canvas; font-weight: 600; white-space: nowrap; }
  .num { color: var(--muted); }
  .nowrap { white-space: nowrap; }
  .center { text-align: center; }
  .muted { color: var(--muted); }
  .msg { max-width: 38ch; white-space: pre-wrap; word-break: break-word; }
  .cat { display: inline-block; padding: 0.1rem 0.45rem; border-radius: 999px; border: 1px solid var(--line); font-size: 0.75rem; }
  .cat-bug { color: #dc2626; border-color: #dc2626; }
  .cat-praise { color: #16a34a; border-color: #16a34a; }
  .cat-suggestion { color: var(--acc); border-color: var(--acc); }
  details summary { cursor: pointer; color: var(--acc); }
  .dbg { margin-top: 0.4rem; font-family: ui-monospace, monospace; font-size: 0.72rem; max-width: 40ch; word-break: break-all; }
  .dbg div { margin: 0.15rem 0; }
</style>
</head>
<body>
  <h1>Feedback</h1>
  <p class="sub">${esc(hostname)} · ${rows.length} most recent submission${rows.length === 1 ? "" : "s"}</p>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Received</th><th>Type</th><th>Message</th>
        <th>Puzzle</th><th>Date</th><th>Device</th><th>Browser</th><th>Debug</th>
      </tr>
    </thead>
    <tbody>${tbody}</tbody>
  </table>
</body>
</html>`;
}
