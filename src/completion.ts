// Clumeral — completion.ts
// Renders the completion screen as cards (results page redesign, board O): Today,
// the Daily leaderboard, Streaks, All time, then the countdown and the actions.
// Rendering only — the counting rules live in player-stats.ts so #163 and #148
// can read the same numbers instead of copying them.

import { loadHistory, loadPrefs } from './storage.ts';
import type { HistoryEntry } from './types.ts';
import { todayKey } from './date.ts';
import {
  computePlayerStats,
  formatDuration,
  goesByDay,
  messageCopy,
  speakDuration,
  streakLine,
  todayMessage,
  validSeconds,
  REVEAL_AFTER_GAMES,
  type PlayerStats,
  type TodayMessage,
} from './player-stats.ts';
import { setTimeChartContext, showTimeChart, timeChartSlot } from './time-chart-view.ts';
import { goesStripHtml, wireStrip } from './goes-strip.ts';


// ─── SVG ─────────────────────────────────────────────────────────────────────

// Decorative octopus — copy of welcome's octo with renamed mask id to avoid duplicate ids in DOM.
const COMPLETION_OCTO_SVG = `<svg aria-hidden="true" width="96" height="96" viewBox="0 0 53 52" fill="none" xmlns="http://www.w3.org/2000/svg">
  <mask id="completion-octo-mask" fill="white">
    <path d="M53 48C53 50.2091 51.2091 52 49 52H48C45.7909 52 44 50.2091 44 48V41H42V48C42 50.2091 40.2091 52 38 52H37C34.7909 52 33 50.2091 33 48V41H31V48C31 50.2091 29.2091 52 27 52H26C23.7909 52 22 50.2091 22 48V41H20V48C20 50.2091 18.2091 52 16 52H15C12.7909 52 11 50.2091 11 48V41H9V48C9 50.2091 7.20914 52 5 52H4C1.79086 52 6.44266e-08 50.2091 0 48V15C1.9329e-07 6.71573 6.71573 0 15 0H38C46.2843 5.47619e-07 53 6.71573 53 15V48Z"/>
  </mask>
  <path d="M53 48C53 50.2091 51.2091 52 49 52H48C45.7909 52 44 50.2091 44 48V41H42V48C42 50.2091 40.2091 52 38 52H37C34.7909 52 33 50.2091 33 48V41H31V48C31 50.2091 29.2091 52 27 52H26C23.7909 52 22 50.2091 22 48V41H20V48C20 50.2091 18.2091 52 16 52H15C12.7909 52 11 50.2091 11 48V41H9V48C9 50.2091 7.20914 52 5 52H4C1.79086 52 6.44266e-08 50.2091 0 48V15C1.9329e-07 6.71573 6.71573 0 15 0H38C46.2843 5.47619e-07 53 6.71573 53 15V48Z" fill="var(--color-accent)"/>
  <path d="M53 48H54V48H53ZM49 52V53V52ZM44 48H43V48H44ZM44 41H45V40H44V41ZM42 41V40H41V41H42ZM42 48H43V48H42ZM38 52V53V52ZM33 48H32V48H33ZM33 41H34V40H33V41ZM31 41V40H30V41H31ZM31 48H32V48H31ZM27 52V53V52ZM22 48H21V48H22ZM22 41H23V40H22V41ZM20 41V40H19V41H20ZM20 48H21V48H20ZM16 52V53V52ZM11 48H10V48H11ZM11 41H12V40H11V41ZM9 41V40H8V41H9ZM9 48H10V48H9ZM5 52V53V52ZM0 48H-1V48H0ZM0 15H-1V15H0ZM38 0V-1V-1V0ZM53 15H54V15H53ZM53 48H52C52 49.6569 50.6569 51 49 51V52V53C51.7614 53 54 50.7614 54 48H53ZM49 52V51H48V52V53H49V52ZM48 52V51C46.3431 51 45 49.6569 45 48H44H43C43 50.7614 45.2386 53 48 53V52ZM44 48H45V41H44H43V48H44ZM44 41V40H42V41V42H44V41ZM42 41H41V48H42H43V41H42ZM42 48H41C41 49.6569 39.6569 51 38 51V52V53C40.7614 53 43 50.7614 43 48H42ZM38 52V51H37V52V53H38V52ZM37 52V51C35.3431 51 34 49.6569 34 48H33H32C32 50.7614 34.2386 53 37 53V52ZM33 48H34V41H33H32V48H33ZM33 41V40H31V41V42H33V41ZM31 41H30V48H31H32V41H31ZM31 48H30C30 49.6569 28.6569 51 27 51V52V53C29.7614 53 32 50.7614 32 48H31ZM27 52V51H26V52V53H27V52ZM26 52V51C24.3431 51 23 49.6569 23 48H22H21C21 50.7614 23.2386 53 26 53V52ZM22 48H23V41H22H21V48H22ZM22 41V40H20V41V42H22V41ZM20 41H19V48H20H21V41H20ZM20 48H19C19 49.6569 17.6569 51 16 51V52V53C18.7614 53 21 50.7614 21 48H20ZM16 52V51H15V52V53H16V52ZM15 52V51C13.3431 51 12 49.6569 12 48H11H10C10 50.7614 12.2386 53 15 53V52ZM11 48H12V41H11H10V48H11ZM11 41V40H9V41V42H11V41ZM9 41H8V48H9H10V41H9ZM9 48H8C8 49.6569 6.65685 51 5 51V52V53C7.76142 53 10 50.7614 10 48H9ZM5 52V51H4V52V53H5V52ZM4 52V51C2.34315 51 1 49.6569 1 48H0H-1C-1 50.7614 1.23858 53 4 53V52ZM0 48H1V15H0H-1V48H0ZM0 15H1C1 7.26801 7.26801 1 15 1V0V-1C6.16344 -1 -1 6.16344 -1 15H0ZM15 0V1H38V0V-1H15V0ZM38 0V1C45.732 1 52 7.26801 52 15H53H54C54 6.16344 46.8366 -0.999999 38 -1V0ZM53 15H52V48H53H54V15H53Z" fill="#F6F0E8" mask="url(#completion-octo-mask)"/>
  <circle cx="19" cy="15" r="2.5" fill="#F6F0E8"/>
  <circle cx="33" cy="15" r="2.5" fill="#F6F0E8"/>
  <path d="M21 26C24.3333 27.3333 27.6667 27.3333 31 26" stroke="#F6F0E8" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;


// ─── DOM Cache ────────────────────────────────────────────────────────────────

const dom = {
  panel: document.querySelector('[data-completion-panel]') as HTMLElement | null,
  live: document.querySelector('[data-completion-live]') as HTMLElement | null,
  countdown: document.querySelector('[data-completion-countdown]') as HTMLElement | null,
  feedback: document.querySelector('[data-completion-feedback]') as HTMLElement | null,
  octo: document.querySelector('[data-completion-octo]') as HTMLElement | null,
  links: document.querySelector('[data-completion-links]') as HTMLElement | null,
};


// ─── Copy ────────────────────────────────────────────────────────────────────
//
// The two notes keep their wording (results brief 61).

const NEW_PLAYER_LINE = 'Your streaks and all-time stats start from your third game.';
const RANDOM_LINE = "Random puzzles don't count towards your stats.";


// ─── Which blocks exist ──────────────────────────────────────────────────────

// One value, one switch, so the six states cannot drift apart.
//
//   random      a random puzzle — no history, no streaks, no totals
//   archive     an archive replay — the minimal panel it has today
//   marker      a reload after a saving-off solve: the goes and the time were
//               never stored, so neither can be shown
//   saving-off  score saving is switched off — this game only, from memory
//   new         fewer than three countable games — nothing to show yet
//   full        all four cards
//
// NOTHING about score saving appears on this panel in any of them (P-01). The
// setting lives on the play screen, where the consent happens; the discoverable
// opt-out is deferred to the menu ticket (#309). The silence is deliberate.
type PanelMode = 'random' | 'archive' | 'marker' | 'saving-off' | 'new' | 'full';

function panelMode(
  isRandom: boolean,
  isArchivedOtherDate: boolean,
  tries: number | null,
  stats: PlayerStats,
): PanelMode {
  if (isRandom) return 'random';
  if (isArchivedOtherDate) return 'archive';
  // tries === null means "played, not recorded" — the marker's whole point.
  if (tries === null) return 'marker';
  if (!loadPrefs().saveScore) return 'saving-off';
  if (stats.countableGames <= REVEAL_AFTER_GAMES) return 'new';
  return 'full';
}


// ─── Countdown ───────────────────────────────────────────────────────────────

/** The lead words and the time, so the time can be set in bold (results brief 61). */
function formatCountdown(isRandom: boolean): { lead: string; time: string } | null {
  if (isRandom) return null;
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msUntil = midnight.getTime() - now.getTime();
  const hours = Math.floor(msUntil / 3600000);
  const minutes = Math.floor((msUntil % 3600000) / 60000);
  const lead = 'Next puzzle in ';
  return { lead, time: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m` };
}


// ─── Render ──────────────────────────────────────────────────────────────────

/**
 * The `/play` screen's result sentence: `Solved in 1 go, 0m 30s`.
 *
 * NOT the completion panel's — the panel's Today card has a figure line, not a
 * sentence (redesign brief 38, results brief 16). This function looks like panel code and
 * is not: src/app.ts imports it and writes it into the play screen's feedback
 * line, which redesign brief 39 deliberately protects. The two screens diverged
 * on purpose. Leave it alone when tidying this file.
 *
 * `null` goes means played but not recorded — never "Solved in 0". An unknown
 * time drops the whole clause rather than showing a dash: a dash is right in a
 * column of figures and wrong in the middle of a sentence.
 */
export function heroLine(tries: number | null, seconds: number | null, showTime: boolean): string {
  // Guarded because this string reaches innerHTML and `tries` comes from
  // dlng_history, which loadHistory does not validate — unlike loadActive and
  // loadUndo next door, which validate every field precisely because that store
  // is editable by whoever owns the browser. Anything that is not a real count
  // of goes is "played, not recorded", which is already a state this handles.
  if (tries === null || !Number.isInteger(tries) || tries < 1) return 'Solved!';
  const goes = `Solved in ${tries} ${tries === 1 ? 'go' : 'goes'}`;
  if (!showTime || seconds === null) return goes;
  return `${goes}, ${formatDuration(seconds)}`;
}


// ─── The cards ───────────────────────────────────────────────────────────────
//
// Every card is a <section> labelled by its own heading, so a screen reader can
// jump between them (results brief 44, 62). One accent: figures and heading
// icons in it, every label and sentence in the text colour (brief 45).

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** A card with an h3 and a decorative icon. `heading` is plain text. */
function card(id: string, heading: string, iconId: string, body: string): string {
  return `<section data-stat-block="${id}" class="result-card" aria-labelledby="stat-head-${id}">` +
    `<h3 id="stat-head-${id}" class="result-card__head"><svg class="result-card__icon" aria-hidden="true">` +
    `<use href="/sprites.svg#${iconId}"/></svg>${heading}</h3>${body}</section>`;
}

/** A whole number of goes, or null. `tries` comes from dlng_history, which
 *  loadHistory does not validate, and it reaches innerHTML. */
function realGoes(tries: number | null): number | null {
  return tries !== null && Number.isInteger(tries) && tries >= 1 ? tries : null;
}

/**
 * Today: "Puzzle #238 solved" as the screen's one h2 (results brief 53, 63, 91),
 * the figure line, then the message. No section icon (brief 46). The h2 keeps
 * the data-completion-heading hook the e2e helpers wait on (plan D10).
 */
function todayCard(
  puzzleNum: number,
  isRandom: boolean,
  tries: number | null,
  seconds: number | null,
  showTime: boolean,
  mode: PanelMode,
  message: TodayMessage | null,
): string {
  const name = isRandom ? 'Puzzle' : `Puzzle #${puzzleNum}`;
  const parts = [
    `<h2 id="stat-head-today" class="result-card__title" data-completion-heading>${name} <span class="result-card__solved">solved</span></h2>`,
  ];

  // A marker has no goes, and the heading already says solved (brief 92).
  const goes = realGoes(tries);
  if (goes !== null) {
    const words = `${goes} ${plural(goes, 'go', 'goes')}`;
    // Shown as "2m 28s", spoken as "2 minutes 28 seconds", so "m" is never read
    // as a letter (brief 65).
    const line = showTime && seconds !== null
      ? `<span aria-hidden="true">${words}, ${formatDuration(seconds)}</span><span class="sr-only">${words}, ${speakDuration(seconds)}</span>`
      : words;
    parts.push(`<p class="result-card__figures" data-today-figures>${line}</p>`);
  }

  // Read in place, never announced (brief 64).
  if (message) {
    const c = messageCopy(message);
    parts.push(
      `<p class="result-card__message" data-today-message><span class="result-card__pill">` +
      `<svg class="result-card__msg-icon" aria-hidden="true"><use href="/sprites.svg#${c.icon}"/></svg></span>` +
      `<span>${c.pre}<b>${c.bold}</b>${c.post}</span></p>`,
    );
  }

  if (mode === 'random') parts.push(`<p class="result-card__note">${RANDOM_LINE}</p>`);
  // Not shown to a saving-off player: with saving off no third game ever
  // accumulates, so it would be a promise we are not going to keep.
  if (mode === 'new') parts.push(`<p class="result-card__note">${NEW_PLAYER_LINE}</p>`);

  return `<section data-stat-block="today" class="result-card" aria-labelledby="stat-head-today">${parts.join('')}</section>`;
}

/** Streaks: the play streak, the best, and the goes strip (brief 20–24, 82). */
function streakCard(stats: PlayerStats, history: HistoryEntry[]): string {
  const l = streakLine(stats);
  // One statement at body size (brief 106): the run in text colour with only
  // "N-day" bold, then the figures in bold accent (brief 109).
  const oneGo = l.oneGoRun !== null ? ` One-go run: <b>${l.oneGoRun}</b>.` : '';
  return card('streak', 'Streaks', 'icon-flame',
    `<p class="streak__line" data-streak-line><strong class="streak__run">${l.figure}-day</strong>${l.label.replace(/^-day/, '')}. Best: <b>${l.best}</b>.${oneGo}</p>` +
    goesStripHtml(goesByDay(history)));
}

/** All time: a ledger, label left, figure right (brief 25, 59, 69, 104). */
function allTimeCard(stats: PlayerStats): string {
  const row = (label: string, value: string) =>
    `<div class="ledger__row" data-ledger-row><dt>${label}</dt><dd>${value}</dd></div>`;
  return card('all-time', 'All time', 'icon-calendar-head',
    '<dl class="ledger">' +
    row('Solved in one', `${stats.firstGoPercent ?? 0}%`) +
    row('Best one-go run', String(stats.bestFirstGoStreak)) +
    row('Fastest solve', formatDuration(stats.bestTimeSeconds)) +
    row('Average time', formatDuration(stats.avgTimeSeconds)) +
    row('Puzzles solved', String(stats.plays)) +
    '</dl>');
}

/** Archive replays and markers carry no timing, on screen or in speech. */
function showsTime(mode: PanelMode): boolean {
  return mode !== 'archive' && mode !== 'marker';
}


// ─── The one announcement (brief 126, 139) ───────────────────────────────────
//
// renderCompletion runs BEFORE the completion screen becomes visible — the very
// next statement in app.ts is replaceRoute('/solved') or showScreen('completion'),
// and at that moment the section still carries aria-hidden="true". A live region
// inside an aria-hidden subtree is not spoken, so writing it at render time would
// announce nothing at all. So the text is prepared here and written when the
// transition says the screen is up.
let pendingAnnouncement: string | null = null;
let announced = false;

/**
 * Called when a new puzzle starts, so the next solve announces again.
 *
 * Clears the region's text as well as the pending flag. The region lives outside
 * every screen now, so it is permanently in the accessibility tree — stale text
 * would otherwise sit there for the life of the session, and a screen-reader
 * user browsing /play would meet last game's result between the main content and
 * the footer. Clearing also means two identical solves in a row still announce
 * twice: assigning the same textContent is not a mutation, so without this the
 * second would be silent.
 */
export function resetCompletionAnnouncement(): void {
  pendingAnnouncement = null;
  announced = false;
  if (dom.live) dom.live.textContent = '';
}

document.addEventListener('screens:enter', (e) => {
  const screen = (e as CustomEvent).detail?.screen;
  if (screen !== 'completion') {
    // Leaving the result behind on a screen it does not describe.
    if (dom.live) dom.live.textContent = '';
    return;
  }
  // Every entry is one visit to the card, so it fetches fresh each time (time
  // chart brief item 93). Before the early return below, which skips every
  // visit after the first announcement. The announcement itself is unchanged:
  // the card is read in place, never announced (item 72).
  showTimeChart();
  if (pendingAnnouncement === null) return;
  if (dom.live) dom.live.textContent = pendingAnnouncement;
  pendingAnnouncement = null;
});

function buildAnnouncement(
  tries: number | null,
  seconds: number | null,
  playStreak: number | null,
): string {
  // Spelled out for speech: a screen reader saying "three colon forty-one" is
  // the reason this is not the display string.
  const spoken = speakDuration(seconds);
  return [
    tries === null ? 'Solved.' : `Solved in ${tries}.`,
    spoken ? `${spoken}.` : '',
    playStreak === null ? '' : `Play streak ${playStreak}.`,
  ].filter(Boolean).join(' ');
}

export interface RenderCompletionOpts {
  activeDate?: string;
  todayLocal?: string;
  /** This game's counted time. Absent or invalid renders a dash, never 0:00. */
  seconds?: number;
}

export function renderCompletion(
  puzzleNum: number,
  tries: number | null,
  isRandom: boolean,
  opts: RenderCompletionOpts = {}
): void {
  // Octo injection (idempotent — only injects once per session).
  if (dom.octo && !dom.octo.firstChild) {
    dom.octo.innerHTML = COMPLETION_OCTO_SVG;
  }

  const isArchivedOtherDate =
    !isRandom &&
    typeof opts.activeDate === 'string' &&
    typeof opts.todayLocal === 'string' &&
    opts.activeDate !== opts.todayLocal;

  // Everything is recomputed from history on every render, never kept as a
  // running total — a running total drifts the moment one write is missed
  // (brief 55).
  const history = loadHistory();
  const today = todayKey();
  const stats = computePlayerStats(history, today);
  const mode = panelMode(isRandom, isArchivedOtherDate, tries, stats);
  const seconds = validSeconds(opts.seconds);

  // The time chart (time chart brief 46): today's daily with a recorded or
  // in-memory time. Random and archive have no field (4); a marker has no time
  // (22, 92), and neither does a 0s time, which is junk (87) and would beat
  // every real player, since the server drops 0s rows (116). The uid goes with
  // the request only when today's time was sent — a recorded entry — so the
  // server can leave the player's own row out (110).
  const showsChart =
    (mode === 'full' || mode === 'new' || mode === 'saving-off') && seconds !== null && seconds >= 1;
  const sendUid = history.some((e) => e.date === today && !e.marker && !e.archived);
  setTimeChartContext(showsChart ? { puzzleNum, seconds, sendUid } : null);

  if (dom.panel) {
    // Archive replays and markers carry no timing (brief 54).
    const message = mode === 'full' ? todayMessage(history, today, tries, seconds) : null;
    const cards = [todayCard(puzzleNum, isRandom, tries, seconds, showsTime(mode), mode, message)];
    // Straight under Today: it is about today too (time chart brief 53). Reserved
    // empty now and drawn after the fetch (54).
    if (showsChart) cards.push(timeChartSlot());
    if (mode === 'full') cards.push(streakCard(stats, history), allTimeCard(stats));
    dom.panel.innerHTML = cards.join('');
    wireStrip(dom.panel);
  }

  // Prepared once per solve, written by the screens:enter listener above. The
  // flag is a flag rather than a comparison of the text, so two identical solves
  // in a row still each announce.
  if (!announced) {
    pendingAnnouncement = buildAnnouncement(
      tries,
      showsTime(mode) ? seconds : null,
      mode === 'full' ? stats.playStreak : null,
    );
    announced = true;
  }

  // Countdown (per D-10: hidden for random puzzles)
  if (dom.countdown) {
    const c = formatCountdown(isRandom);
    dom.countdown.textContent = c?.lead ?? '';
    if (c) {
      const b = document.createElement('b');
      b.textContent = c.time;
      dom.countdown.appendChild(b);
    }
    dom.countdown.classList.toggle('hidden', !c);
  }

  // Render Show puzzle + Archive links (SLV-01).
  // Show puzzle is rendered for daily puzzles only (where the user can navigate back to today's
  // game screen). For random puzzles, only Archive shows.
  if (dom.links) {
    dom.links.replaceChildren();

    // Show puzzle: only on today's solved view. Archive solves stay on
    // /archive/<date> and never reach the completion screen, so no Show-puzzle
    // link is needed there. Random has no equivalent puzzle URL to deep-link to.
    if (!isRandom && !isArchivedOtherDate) {
      const a = document.createElement('a');
      a.href = '#';
      a.className = 'btn btn-hollow flex-1';
      a.dataset.completionShowPuzzle = '';
      a.innerHTML = '<svg aria-hidden="true"><use href="/sprites.svg#icon-puzzle"/></svg>Show puzzle';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('completion:show-puzzle'));
      });
      dom.links.appendChild(a);
    }

    // Random is a testing page; its only entry link lives here — replay another
    // random puzzle. A plain anchor does a full navigation to /random, which
    // re-runs the cold-boot path (the SPA router is never initialised on /random).
    if (isRandom) {
      const again = document.createElement('a');
      again.href = '/random';
      again.className = 'btn btn-hollow flex-1';
      again.dataset.completionRandomAgain = '';
      // One word, matching the "Archive" sibling. This button is flex-1 beside
      // Archive so it only gets half the row, and "Play another random puzzle"
      // wrapped to three lines (75px against the 48px single-line height).
      // Measured in this container: at 320px the button is 132px wide and even
      // "Play again" takes two lines; "Another" holds one line at every width.
      // The aria-label restores the context the short label drops, and starts
      // with the visible word so it satisfies WCAG 2.5.3 Label in Name — a
      // voice-control user saying "another" still matches the accessible name.
      again.setAttribute('aria-label', 'Another random puzzle');
      again.innerHTML = '<svg aria-hidden="true"><use href="/sprites.svg#icon-puzzle"/></svg>Another';
      dom.links.appendChild(again);
    }

    // Archive link: always present. Renamed from /puzzles to /archive (ARC-01).
    const archive = document.createElement('a');
    archive.href = '/archive';
    archive.className = 'btn btn-hollow flex-1';
    archive.dataset.completionArchive = '';
    archive.innerHTML = '<svg aria-hidden="true"><use href="/sprites.svg#icon-archive"/></svg>Archive';
    dom.links.appendChild(archive);
  }
}


// ─── Init ────────────────────────────────────────────────────────────────────

// Feedback button delegates to Phase 4's existing [data-fb-btn] trigger (per D-12).
dom.feedback?.addEventListener('click', () => {
  (document.querySelector('[data-fb-btn]') as HTMLElement | null)?.click();
});
