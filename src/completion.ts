// Clumeral — completion.ts
// Renders the completion screen: heading, the three stat blocks, countdown,
// feedback button. Rendering only — the counting rules live in player-stats.ts
// so #163 and #148 can read the same numbers instead of copying them.

import { loadHistory, loadPrefs } from './storage.ts';
import { todayKey } from './date.ts';
import {
  computePlayerStats,
  formatDuration,
  speakDuration,
  validSeconds,
  REVEAL_AFTER_GAMES,
  type PlayerStats,
} from './player-stats.ts';


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
  heading: document.querySelector('[data-completion-heading]') as HTMLElement | null,
  subheading: document.querySelector('[data-completion-subheading]') as HTMLElement | null,
  panel: document.querySelector('[data-completion-panel]') as HTMLElement | null,
  live: document.querySelector('[data-completion-live]') as HTMLElement | null,
  countdown: document.querySelector('[data-completion-countdown]') as HTMLElement | null,
  feedback: document.querySelector('[data-completion-feedback]') as HTMLElement | null,
  octo: document.querySelector('[data-completion-octo]') as HTMLElement | null,
  links: document.querySelector('[data-completion-links]') as HTMLElement | null,
};


// ─── Copy ────────────────────────────────────────────────────────────────────
//
// Explanatory lines under the All-time rows only. The boxes carry none: the
// redesign dropped them because "Best" over "Current" under a labelled icon is
// already the explanation, and three sentences inside three small boxes was the
// clutter the redesign was called for (redesign brief 45).

const NOTES = {
  plays: 'Daily puzzles you have finished.',
  firstGoWins: 'Puzzles you got on your first guess.',
  avgGoes: 'Your average number of guesses.',
  avgTime: 'How long you usually take.',
  fastest: 'Your quickest win on a first guess.',
} as const;

const NEW_PLAYER_LINE = 'Your streaks and all-time stats start from your third game.';
const RANDOM_LINE = "Random puzzles don't count towards your stats.";
const CHART_LABEL = 'How many goes you take';


// ─── Which blocks exist ──────────────────────────────────────────────────────

// One value, one switch, so the six states cannot drift apart.
//
//   random      a random puzzle — no history, no streaks, no totals
//   archive     an archive replay — the minimal panel it has today
//   marker      a reload after a saving-off solve: the goes and the time were
//               never stored, so neither can be shown
//   saving-off  score saving is switched off — this game only, from memory
//   new         fewer than three countable games — nothing to show yet
//   full        all three blocks
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

function formatCountdown(isRandom: boolean): string | null {
  if (isRandom) return null;
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msUntil = midnight.getTime() - now.getTime();
  const hours = Math.floor(msUntil / 3600000);
  const minutes = Math.floor((msUntil % 3600000) / 60000);
  if (hours > 0) return `Next puzzle in ${hours}h ${minutes}m`;
  return `Next puzzle in ${minutes}m`;
}


// ─── Render ──────────────────────────────────────────────────────────────────

// A block is a <section> with its own heading, so a screen reader can jump
// between them. The rule beside the heading is decorative.
function block(id: string, heading: string, body: string): string {
  return `<section data-stat-block="${id}" class="stat-block" aria-labelledby="stat-head-${id}">
    <div class="stat-block__head">
      <h3 id="stat-head-${id}">${heading}</h3>
      <span class="stat-block__rule" aria-hidden="true"></span>
    </div>
    ${body}
  </section>`;
}

// Every number is a <dl> pair, so it is read with its label attached rather than
// as a loose figure (brief 97). The explanatory line is a second <dd> under the
// number — valid against a single <dt>, and it reads in the right order.
function statRow(label: string, value: string, note: string): string {
  return `<div class="stat-row">
    <dt>${label}</dt>
    <dd>${value}</dd>
    <dd class="stat-note">${note}</dd>
  </div>`;
}

/**
 * One box: a title with its icon, and a description list of one or two pairs.
 *
 * The `dl` sits INSIDE the box, below the `h4`. A `dt` with no `dl` ancestor is
 * not a description list at all — it breaks the pairing brief 46 relies on and
 * trips axe's definition-list rule at serious level, which the accessibility
 * spec runs over /solved in both colour schemes.
 */
function statBox(title: string, iconId: string, pairs: string): string {
  return `<div class="stat-box shadow-box">
    <h4 class="stat-box__title">
      <svg class="stat-box__icon" aria-hidden="true"><use href="/sprites.svg#${iconId}"/></svg>${title}
    </h4>
    <dl class="m-0">${pairs}</dl>
  </div>`;
}

/**
 * One number and its label (brief 78).
 *
 * The short word on screen and the full one in speech are two separate spans,
 * not a prefix and a hidden suffix: "Avg." is not the start of "Average time",
 * so a suffix could never have produced the Average block's labels. One
 * mechanism, both blocks.
 *
 * The number sits above its label on screen while the DOM stays `dt` then `dd`
 * — the reversal is CSS (`.stat-box__pair`), because `dd` before `dt` is not
 * conforming HTML and a screen reader must hear the label first.
 */
function statPair(shortLabel: string, fullLabel: string, value: string, isBest = false): string {
  return `<div class="stat-box__pair">
    <dt><span class="stat-box__label" aria-hidden="true">${shortLabel}</span><span class="sr-only">${fullLabel}</span></dt>
    <dd class="stat-box__value${isBest ? ' stat-box__value--best' : ''}">${value}</dd>
  </div>`;
}

function goesChart(distribution: PlayerStats['goesDistribution']): string {
  const max = Math.max(1, ...distribution.map((d) => d.count));
  const rows = distribution
    .map((d) => {
      const pct = Math.round((d.count / max) * 100);
      // The bar is aria-hidden; the count beside it is the accessible content,
      // so nothing in the chart is available only as a picture (brief 98).
      return `<li class="goes-row" data-goes-row>
        <span data-goes-label>${d.bucket}</span>
        <span class="goes-row__track" aria-hidden="true"><span class="goes-row__fill" style="inline-size: ${pct}%"></span></span>
        <span class="goes-row__count" data-goes-count>${d.count}</span>
      </li>`;
    })
    .join('');
  return `<div class="goes-chart">
    <h4 id="goes-chart-label" class="stat-note">${CHART_LABEL}</h4>
    <ul class="list-none p-0 m-0" aria-labelledby="goes-chart-label">${rows}</ul>
  </div>`;
}

/**
 * The `/play` screen's result sentence: `Solved in 1 go, 0m 30s`.
 *
 * NOT the completion panel's — the panel shows two icon figures now and has no
 * sentence at all (redesign brief 38). This function looks like panel code and
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

/**
 * One figure: an icon, a word only a screen reader hears, and the number.
 *
 * The word is not optional decoration. Without it the panel reads as a bare
 * "1 go" beside a bare "2m 38s" and the icon carries the meaning, which is
 * exactly what an icon cannot do in speech (brief 47, 49).
 */
function figure(iconId: string, spokenLabel: string, value: string): string {
  return `<span class="stat-figure">
    <svg class="stat-figure__icon" aria-hidden="true"><use href="/sprites.svg#${iconId}"/></svg>
    <span class="sr-only">${spokenLabel}, </span><span class="stat-figure__value">${value}</span>
  </span>`;
}

/**
 * The Today block's body: the goes and the time, side by side (brief 38, 65).
 *
 * An unknown time drops the stopwatch figure entirely rather than showing an
 * empty one (brief 36). Unknowable goes — a reload after a saving-off solve —
 * is the plain word `Solved!` and no figures at all (brief 76).
 */
export function todayFigures(tries: number | null, seconds: number | null, showTime: boolean): string {
  // The same guard heroLine applies, and for the same reason: this string
  // reaches innerHTML and `tries` comes from dlng_history, which loadHistory
  // does not validate. Anything that is not a real count of goes is "played,
  // not recorded", which is already a state this handles.
  if (tries === null || !Number.isInteger(tries) || tries < 1) return '<p class="stat-hero">Solved!</p>';
  const goes = figure('icon-calculator-check', 'Goes', `${tries} ${tries === 1 ? 'go' : 'goes'}`);
  const time = showTime && seconds !== null
    ? figure('icon-stopwatch', 'Time', formatDuration(seconds))
    : '';
  return `<div class="stat-today">${goes}${time}</div>`;
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

  // Heading. The old subheading is now the figures inside the Today block, so it
  // is cleared rather than left saying the same thing twice.
  if (dom.heading) {
    dom.heading.textContent = isRandom ? 'Puzzle solved!' : `Puzzle #${puzzleNum} solved!`;
  }
  if (dom.subheading) dom.subheading.textContent = '';

  const isArchivedOtherDate =
    !isRandom &&
    typeof opts.activeDate === 'string' &&
    typeof opts.todayLocal === 'string' &&
    opts.activeDate !== opts.todayLocal;

  // Everything is recomputed from history on every render, never kept as a
  // running total — a running total drifts the moment one write is missed
  // (brief 55).
  const stats = computePlayerStats(loadHistory(), todayKey());
  const mode = panelMode(isRandom, isArchivedOtherDate, tries, stats);
  const seconds = validSeconds(opts.seconds);

  if (dom.panel) {
    // Archive replays keep the minimal panel they have today: no streaks, no
    // totals and no timing (brief 54).
    const showTime = showsTime(mode);
    const thisGame = [
      todayFigures(tries, seconds, showTime),
      mode === 'random' ? `<p class="stat-note">${RANDOM_LINE}</p>` : '',
      // Not shown to a saving-off player: with saving off no third game ever
      // accumulates, so it would be a promise we are not going to keep.
      mode === 'new' ? `<p class="stat-note">${NEW_PLAYER_LINE}</p>` : '',
    ].join('');

    // The id stays `this-game` while the heading becomes `Today` (brief 66):
    // every existing locator and the e2e page object key off the id.
    const blocks = [block('this-game', 'Today', thisGame)];

    if (mode === 'full') {
      // Three boxes: your record over where you are now. Today's time appears
      // here as well as in Today, and on a personal-best day the same number
      // appears three times — deliberate, and standing as Jamie's override of
      // Dave's objection to the repeat (brief 71, 73).
      blocks.push(block('best', 'Best',
        `<div class="stat-boxes">
          ${statBox('Time', 'icon-stopwatch',
            statPair('Best', 'Best time', formatDuration(stats.bestTimeSeconds), true) +
            statPair('Current', 'Current time', formatDuration(showTime ? seconds : null)))}
          ${statBox('1-go', 'icon-calculator-check',
            statPair('Best', 'Best 1-go streak', String(stats.bestFirstGoStreak), true) +
            statPair('Current', 'Current 1-go streak', String(stats.firstGoStreak)))}
          ${statBox('Plays', 'icon-gamepad',
            statPair('Best', 'Best play streak', String(stats.bestPlayStreak), true) +
            statPair('Current', 'Current play streak', String(stats.playStreak)))}
        </div>`));

      // Two boxes, one figure each (brief 67, 72). Neither is a record, so both
      // take the player's own accent — "Best" is the only exception to that, and
      // an average is not one.
      blocks.push(block('average', 'Average',
        `<div class="stat-boxes stat-boxes--two">
          ${statBox('Time', 'icon-stopwatch',
            statPair('Avg.', 'Average time', formatDuration(stats.avgTimeSeconds)))}
          ${statBox('Goes', 'icon-calculator-check',
            statPair('Avg.', 'Average goes', stats.avgGoes ?? '—'))}
        </div>`));

      const firstGo = stats.firstGoPercent === null
        ? String(stats.firstGoWins)
        : `${stats.firstGoWins} (${stats.firstGoPercent}%)`;

      blocks.push(block('all-time', 'All time',
        `<dl class="m-0">
          ${statRow('Plays', String(stats.plays), NOTES.plays)}
          ${statRow('First-go wins', firstGo, NOTES.firstGoWins)}
          ${statRow('Average goes', stats.avgGoes ?? '—', NOTES.avgGoes)}
          ${statRow('Average time', formatDuration(stats.avgTimeSeconds), NOTES.avgTime)}
          ${statRow('Fastest first-go win', formatDuration(stats.fastestFirstGoSeconds), NOTES.fastest)}
        </dl>
        ${goesChart(stats.goesDistribution)}`));
    }

    dom.panel.innerHTML = blocks.join('');
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
    const text = formatCountdown(isRandom);
    dom.countdown.textContent = text ?? '';
    dom.countdown.classList.toggle('hidden', !text);
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
