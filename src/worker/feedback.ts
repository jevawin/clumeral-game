// Admin feedback view (#213). Renders submissions from D1 as a mobile-first card
// list. Access-gated by the caller (see GET /feedback in index.ts). All
// user-controlled values are HTML-escaped — message/category/userAgent etc. are
// attacker-influenced.

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
  host: string | null;
  // Triage state (#225).
  status: string | null;
  github_issue: number | null;
  resolved_at: string | null;
}

// ── Triage state (#225) ──

// Only two states. Richer outcomes (wontfix, duplicate) are carried by the linked
// GitHub issue's own state rather than duplicated here — one place to be wrong.
export const STATUSES = ["open", "resolved"] as const;
export type Status = (typeof STATUSES)[number];

export function isStatus(v: unknown): v is Status {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}

// Rows written before #225 have no status. Treat them as open — they were never
// triaged, which is exactly what open means.
export function statusOf(row: FeedbackRow): Status {
  return row.status === "resolved" ? "resolved" : "open";
}

// POST /feedback/:id/status — deliberately under the /feedback prefix so it inherits
// the Cloudflare Access rule that gates the dashboard. A route under /api/feedback
// would inherit the *public* rule instead (players submit there), which would leave
// the write path open to anyone.
const STATUS_PATH = /^\/feedback\/(\d+)\/status$/;

export function parseStatusPath(pathname: string): number | null {
  const m = STATUS_PATH.exec(pathname);
  if (m === null) return null;
  const id = Number(m[1]);
  // The regex already excludes signs, decimals and whitespace. This catches the
  // remaining case: an integer too large to represent exactly.
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// Access proves *who* the caller is, not *which page* made the request — an
// authenticated admin's browser can be induced to POST from an attacker's page.
// Requiring a same-origin Origin header closes that. Absent header → reject: this
// route is only ever reached from our own form, so there is no legitimate
// origin-less caller to accommodate.
export function isSameOrigin(origin: string | null, expected: string): boolean {
  if (origin === null || origin === "") return false;
  return origin === expected;
}

// Real feedback comes from the production host; everything else (preview
// deploys, localhost) is test traffic.
const REAL_HOST = "clumeral.com";
function isTest(host: string | null): boolean {
  return host !== null && host !== REAL_HOST;
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Sample cards shown ONLY when the database returns no rows, so the layout can be
// previewed locally without seeding. Clearly flagged as fake by the banner.
const SAMPLE: FeedbackRow[] = [
  { id: 5, created_at: "2026-04-30 09:21:24", category: "general", message: "Great game! Would be useful to have ‘undo’ and ‘restart’ buttons. Is there a reason the number can’t start with 0?", puzzle_number: "#54", puzzle_date: "2026-04-30", device: "iPhone", browser: "Safari 26.4", user_agent: "Mozilla/5.0 (iPhone …) Version/26.4 Mobile/15E148 Safari/604.1", history: null, prefs: null, active: null, tz_offset: 60, local_today: "2026-04-30", screen: "390x844", host: "clumeral.com", status: "open", github_issue: 251, resolved_at: null },
  { id: 4, created_at: "2026-04-22 13:46:22", category: "praise", message: "Absolutely love this puzzle game! I've shared it with work colleagues and friends.", puzzle_number: "#46", puzzle_date: "2026-04-22", device: "Desktop", browser: "Edge 147.0.0.0", user_agent: null, history: null, prefs: null, active: null, tz_offset: null, local_today: null, screen: null, host: "clumeral.com", status: "resolved", github_issue: null, resolved_at: "2026-04-23 08:00:00" },
  { id: 3, created_at: "2026-04-17 07:42:05", category: "suggestion", message: "It would be good to see your winning streak.", puzzle_number: "#41", puzzle_date: "2026-04-17", device: "Android Phone", browser: "Chrome 147.0.0.0", user_agent: null, history: null, prefs: null, active: null, tz_offset: null, local_today: null, screen: null, host: "clumeral.com", status: "open", github_issue: 163, resolved_at: null },
  { id: 2, created_at: "2026-04-09 11:32:18", category: "bug", message: "Couldn't select 0 as the first number once I'd deselected it accidentally.", puzzle_number: "#33", puzzle_date: "2026-04-09", device: "Android Phone", browser: "Chrome 146.0.0.0", user_agent: "Mozilla/5.0 (Linux; Android 10; K) … Chrome/146.0.0.0 Mobile Safari/537.36", history: '[{"date":"2026-04-09","tries":2,"answer":800}]', prefs: '{"theme":"dark"}', active: null, tz_offset: 0, local_today: "2026-04-09", screen: "412x915", host: "clumeral.com", status: "resolved", github_issue: 219, resolved_at: "2026-06-09 12:00:00" },
  { id: 1, created_at: "2026-06-08 21:10:00", category: "general", message: "testing the form on the preview build", puzzle_number: "#93", puzzle_date: "2026-06-08", device: "Desktop", browser: "Firefox 150.0.2", user_agent: "Mozilla/5.0 (Windows NT 10.0 …) Firefox/150.0.2", history: null, prefs: null, active: null, tz_offset: 0, local_today: "2026-06-08", screen: "1280x720", host: "new-design-clumeral-game.jevawin.workers.dev", status: "open", github_issue: null, resolved_at: null },
];

function source(host: string | null): string {
  if (isTest(host)) return `<span class="badge test" title="${esc(host)}">test</span>`;
  return `<span class="badge live">live</span>`;
}

// Raw localStorage / diagnostic blobs, tucked behind an expander.
function debug(row: FeedbackRow): string {
  const parts = ([
    ["host", row.host],
    ["userAgent", row.user_agent],
    ["screen", row.screen],
    ["tzOffset", row.tz_offset],
    ["localToday", row.local_today],
    ["history", row.history],
    ["prefs", row.prefs],
    ["active", row.active],
  ] as [string, unknown][]).filter(([, v]) => v !== null && v !== "");
  if (!parts.length) return "";
  const body = parts.map(([k, v]) => `<div><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join("");
  return `<details class="dbg"><summary>Diagnostics</summary><div class="dbg-body">${body}</div></details>`;
}

const REPO = "https://github.com/jevawin/clumeral-game";

// The triage footer: where this row ended up, and the one control that changes it.
// A plain form POST, not fetch — this page ships no client JS and there is no reason
// to start for an admin-only view. `back` returns the reader to the filter they were
// on instead of dumping them at the default.
function triage(r: FeedbackRow, sample: boolean, back: string): string {
  const st = statusOf(r);
  const next = st === "resolved" ? "open" : "resolved";
  const link =
    r.github_issue !== null
      ? `<a class="issue" href="${REPO}/issues/${esc(r.github_issue)}" rel="noreferrer">#${esc(r.github_issue)}</a>`
      : "";
  const when = st === "resolved" && r.resolved_at !== null
    ? `<span class="when">${esc(r.resolved_at)}</span>`
    : "";
  // Sample cards are not real rows — a button would 404 on a made-up id.
  const button = sample
    ? ""
    : `<form method="post" action="/feedback/${esc(r.id)}/status">
        <input type="hidden" name="status" value="${next}">
        <input type="hidden" name="back" value="${esc(back)}">
        <button type="submit" class="act act-${next}">${next === "resolved" ? "Resolve" : "Reopen"}</button>
      </form>`;
  return `<div class="triage">
    <span class="st st-${st}">${st}</span>${link}${when}${button}
  </div>`;
}

function card(r: FeedbackRow, sample: boolean, back: string): string {
  const meta = [r.puzzle_number, r.puzzle_date, r.device, r.browser]
    .filter((v) => v !== null && v !== "")
    .map((v) => `<span>${esc(v)}</span>`)
    .join("");
  const done = statusOf(r) === "resolved";
  return `<article class="card${isTest(r.host) ? " is-test" : ""}${done ? " is-done" : ""}">
    <div class="row">
      <span class="cat cat-${esc(r.category)}">${esc(r.category)}</span>
      ${source(r.host)}
      <time>${esc(r.created_at)}</time>
    </div>
    <p class="msg">${esc(r.message)}</p>
    <div class="meta">${meta}</div>
    ${triage(r, sample, back)}
    ${debug(r)}
  </article>`;
}

// Rebuilds the current query string so a filter toggle preserves the other filter
// and the resolve button can return you here.
function queryFor(showAll: boolean, showResolved: boolean): string {
  const p = new URLSearchParams();
  if (showAll) p.set("all", "1");
  if (showResolved) p.set("status", "all");
  const q = p.toString();
  return q === "" ? "/feedback" : `/feedback?${q}`;
}

export function renderFeedbackPage(
  rows: FeedbackRow[],
  hostname: string,
  showAll: boolean,
  showResolved = false,
  notice = "",
): string {
  const fake = rows.length === 0;
  const list = fake ? SAMPLE : rows;
  const back = queryFor(showAll, showResolved);

  const banner = fake
    ? `<div class="banner" role="alert">⚠ No feedback in this database yet — showing <b>sample data</b> so you can preview the layout. These are not real submissions.</div>`
    : "";

  // Status changes redirect back here, so the confirmation has to survive the hop.
  const flash = notice === ""
    ? ""
    : `<div class="flash" role="status">${esc(notice)}</div>`;

  const toggle = showAll
    ? `<a class="toggle" href="${queryFor(false, showResolved)}">Show clumeral.com only</a>`
    : `<a class="toggle" href="${queryFor(true, showResolved)}">Show all (incl. test)</a>`;

  const statusToggle = showResolved
    ? `<a class="toggle" href="${queryFor(showAll, false)}">Hide resolved</a>`
    : `<a class="toggle" href="${queryFor(showAll, true)}">Show resolved</a>`;

  const countLabel = fake
    ? "sample data"
    : `${list.length} ${showAll ? "submission" + (list.length === 1 ? "" : "s") + " · all sources" : "submission" + (list.length === 1 ? "" : "s")}${showResolved ? "" : " · open only"}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Feedback · ${esc(hostname)}</title>
<style>
  :root {
    color-scheme: light dark;
    --acc: light-dark(#2563eb, #60a5fa);
    --line: light-dark(#e5e7eb, #2b3240);
    --card: light-dark(#ffffff, #161b22);
    --muted: light-dark(#6b7280, #9aa4b2);
    --warn-fg: light-dark(#92400e, #fbbf24);
    --warn-bd: #f59e0b;
    --warn-bg: light-dark(#fffbeb, #2a230f);
    --ok: light-dark(#15803d, #4ade80);
    --ok-bg: light-dark(#f0fdf4, #10241a);
  }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; margin: 0; background: Canvas; line-height: 1.45; -webkit-text-size-adjust: 100%; }
  .wrap { max-width: 680px; margin: 0 auto; padding: 1rem 1rem 3rem; }
  header.top { position: sticky; top: 0; background: Canvas; padding: 0.75rem 0; border-bottom: 1px solid var(--line); z-index: 1; }
  h1 { font-size: 1.15rem; margin: 0; }
  .sub { color: var(--muted); font-size: 0.82rem; margin: 0.2rem 0 0; display: flex; flex-wrap: wrap; gap: 0.5rem 0.75rem; align-items: center; }
  .toggle { margin-left: auto; color: var(--acc); text-decoration: none; padding: 0.4rem 0.6rem; border: 1px solid var(--line); border-radius: 8px; min-height: 36px; display: inline-flex; align-items: center; }
  .banner { margin: 0.9rem 0 0; padding: 0.7rem 0.85rem; border: 1px solid var(--warn-bd); background: var(--warn-bg); color: var(--warn-fg); border-radius: 10px; font-size: 0.85rem; }
  .list { margin-top: 0.9rem; display: flex; flex-direction: column; gap: 0.75rem; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 0.85rem 0.9rem; }
  .card.is-test { opacity: 0.72; }
  .row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .row time { margin-left: auto; color: var(--muted); font-size: 0.75rem; white-space: nowrap; }
  .cat { display: inline-block; padding: 0.12rem 0.5rem; border-radius: 999px; border: 1px solid var(--line); font-size: 0.72rem; text-transform: capitalize; }
  .cat-bug { color: #dc2626; border-color: #dc2626; }
  .cat-praise { color: #16a34a; border-color: #16a34a; }
  .cat-suggestion { color: var(--acc); border-color: var(--acc); }
  .badge { display: inline-block; padding: 0.12rem 0.5rem; border-radius: 999px; font-size: 0.7rem; }
  .badge.live { color: var(--muted); border: 1px solid var(--line); }
  .badge.test { color: var(--warn-fg); border: 1px solid var(--warn-bd); }
  .msg { margin: 0.55rem 0 0; white-space: pre-wrap; word-break: break-word; font-size: 0.95rem; }
  .meta { margin-top: 0.55rem; display: flex; flex-wrap: wrap; gap: 0.25rem 0.5rem; color: var(--muted); font-size: 0.76rem; }
  .meta span:not(:last-child)::after { content: " ·"; margin-left: 0.5rem; }
  .dbg { margin-top: 0.55rem; }
  .dbg summary { cursor: pointer; color: var(--acc); font-size: 0.8rem; min-height: 32px; display: inline-flex; align-items: center; }
  .dbg-body { margin-top: 0.4rem; font-family: ui-monospace, monospace; font-size: 0.72rem; }
  .dbg-body div { display: flex; gap: 0.5rem; padding: 0.2rem 0; border-top: 1px solid var(--line); }
  .dbg-body b { color: var(--muted); flex: 0 0 5.5rem; }
  .dbg-body span { word-break: break-all; min-width: 0; }
  .empty { color: var(--muted); text-align: center; padding: 2rem 0; }
  .flash { margin: 0.9rem 0 0; padding: 0.6rem 0.85rem; border: 1px solid var(--ok); background: var(--ok-bg); color: var(--ok); border-radius: 10px; font-size: 0.85rem; }
  .card.is-done { opacity: 0.6; }
  .triage { margin-top: 0.6rem; padding-top: 0.55rem; border-top: 1px solid var(--line); display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .st { padding: 0.12rem 0.5rem; border-radius: 999px; font-size: 0.7rem; text-transform: capitalize; border: 1px solid var(--line); }
  .st-open { color: var(--warn-fg); border-color: var(--warn-bd); }
  .st-resolved { color: var(--ok); border-color: var(--ok); }
  .issue { color: var(--acc); text-decoration: none; font-size: 0.76rem; font-family: ui-monospace, monospace; }
  .triage .when { color: var(--muted); font-size: 0.72rem; }
  .triage form { margin: 0 0 0 auto; }
  .act { font: inherit; font-size: 0.78rem; cursor: pointer; padding: 0.35rem 0.7rem; min-height: 36px; border-radius: 8px; border: 1px solid var(--line); background: transparent; color: var(--acc); }
  .act-resolved { border-color: var(--ok); color: var(--ok); }
  .act:hover { border-color: currentColor; }
</style>
</head>
<body>
  <div class="wrap">
    <header class="top">
      <h1>Feedback</h1>
      <p class="sub"><span>${esc(hostname)}</span><span>${countLabel}</span>${statusToggle}${toggle}</p>
    </header>
    ${flash}
    ${banner}
    <div class="list">${list.map((r) => card(r, fake, back)).join("")}</div>
  </div>
</body>
</html>`;
}
