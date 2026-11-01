# Canvas notes, verbatim

Exported 2026-11-01 from the Clumeral design canvas, version 1793547022-0828
(artifact `4b012cca-d7a9-4c39-a7d2-bf74d68f8c76`, `project/canvas.json`).

The companion to the four exported boards:

- `2026-11-01-Idea-O-Time-vs-Everyone.dc.html`
- `2026-11-01-Idea-P-First-Plays.dc.html`
- `2026-11-01-Idea-R-Log-Positions.dc.html`
- `2026-11-01-Idea-N-Copy-States.dc.html`

**Note text is reproduced unaltered**, including figures that later decisions
have since overridden. Where a note and the brief disagree, the brief wins; the
note records what was decided at the time and why, which is what survives a
context clear. Each heading gives the canvas note key, so anything quoted in the
brief stays traceable.

The canvas also carries three pasted screenshots (`image-04egdw`, `image-3q0iu4`,
`image-5otfgt`) which hold no text, and seven one-line row labels: 
`row-box` "Results — Dave's box plot", `row-dark` "Dark — Lime, and the two overlays", `row-f2` "Results — F2", `row-ideas` "Results — three directions", `row-light` "Light — Lime", `row-stats` "Results — three stats layouts", `row-today` "Results — today vs everyone".


---

# The design that was chosen


## time-note — the design (Idea-O)

O is the daily leaderboard. N is the same card at the six points your dot can land on.

THE LAYOUT THAT FINALLY WORKS: you ABOVE the axis, the three references BELOW it. The two groups are on opposite sides of the line, so they cannot collide with each other wherever your dot lands — the problem the rotated version solved by turning the text, solved instead by using the other side. Only the three below have to be resolved against one another, and at twenty finishers they never come close.

Within every label the TIME is the line nearest the axis and the WORD is the line further from it. That holds on both sides, which is why "You / 2m 28s" reads downward and "41s / Fastest" reads upward.

It grew, as expected: 1245 against 1184 for the legend version. The cost buys every mark named where it stands, with nothing rotated and nothing in a key.

LEADER LINES, AND THE CORNER RULE. The label is placed to FIT, the line marks the TRUE position. State 4 on N is the case they exist for — second fastest, where your label cannot sit over its own dot.

Where the line MEETS the box is what decides the text alignment inside it, because a box is as wide as its widest line. Fastest aligns left, slowest aligns right, median stays centred, and your label takes whichever corner it is clamped against. Centring all of them left "41s" sitting 25px from the line that was pointing at it, and your own label 13px adrift when you were fastest and 25px when you were slowest. Measured across all six states, every leader now lands within 0.1px of its label's corner.

THE MEDIAN IS AN ORDINARY DISC AGAIN. The word below it names it now, so it needs no style of its own. Still appended rather than merged, because the midpoint of the day is usually a second nobody actually finished on.

LOG SPACING, KEPT. Measured linear with the same data: 17 of 18 dots inside the left 101px of a 319px track, because one 14m 52s day is 21x the fastest. The trade stands — distance across the track is not seconds.

TWO BUGS THE STATE SHEET CAUGHT, neither visible in the default view:

1. The label-placement loop used `var i`. Harmless in O; lifted into the state sheet, where it sits inside a function whose parameter is the state index `i`, it shadowed that parameter and every state wrote its data into the slot named after its LABEL COUNT instead of its own index. Three states overwrote each other and three rendered as raw holes. The loop variables are k and n now, with the reason in a comment that travels with the code.

2. "You're in the X solve times" only parses when X is a percentile. The two states that are not kept producing "You're in the 2nd fastest solve times". They have their own frame now: "You're 2nd fastest", and "You're first to finish today" at n = 1.

LABEL WIDTHS ARE ESTIMATED, because renderVals cannot measure text. Calibrated at 12px Quicksand: "41s" 16.3, "1m 40s" 37.7, "2m 28s" 39.6, "14m 52s" 43.6, "Fastest" 39.9, "Median" 40.7, "Slowest" 42.1, "You" 20.3. Letters are the loosest class so they get the most generous figure, and every width carries 3px of flat slack on top — slack can only space labels further apart, never overlap them. LIVE THIS SHOULD MEASURE; it is the one mock-only part of the card.

STILL UNRESOLVED, state 6: the slowest player reads "top 100%". "Quicker than 6 of 20" never sounds absurd but lands on "quicker than 0 of 20" for the same person, and capping at 90% would be a lie told to the people least able to check it.

THE DATA IS NOT THERE YET. Production holds FIVE puzzle_time rows, all from today — the timer sat on staging from 11 Aug and reached main today (#347). A month and this is real.

A named leaderboard is still blocked: uid is a crypto.randomUUID() in localStorage, and POST /api/event (worker/index.ts:424) takes any uid with no auth.

MEASURED: O 1245 in a 1260 frame, N 1663 in 1680. Across all six states, zero label collisions and zero text outside the track.

OPTICAL ALIGNMENT, 1 Nov. The share buttons were NOT the problem — every one of them sits exactly on the 18px padding line, as does every paragraph and the chart track. The SECTION ICONS were the ones out of place: each SVG's path is drawn inside its own viewBox, so the box was on the line but the ink was not — the leaderboard icon 2.63px in, the trophy 3.06, the flame 3.50. Three different amounts.

That is what made the heading look indented against the body copy below it and the share button's hard border look like it was sticking out past everything. Each icon now carries a negative margin-left equal to its own measured inset, so the leading INK lands on the padding line rather than the box. Applied to K, L, M and O. Measured after: icon ink 19.5, body text 19.5, share border 19.5, on every card of all four boards.

In the real codebase the fix belongs in the sprite sheet — tight viewBoxes — not in per-icon margins.

The low-n rules and the log-scale label have notes of their own, beside P and Q.


## pos-note — where the axis label goes (Idea-R)

R — the three that are left. Always "— log time", never the bare words: the dash makes it read as an aside about the chart rather than as another of the chart's own labels, which is what it would be mistaken for sitting among Fastest and Median.

THE FLIP RULE (Jamie, 1 Nov): the label takes the corner FURTHEST from your dot. Right of centre puts it top left, left of centre top right. Cards 1 and 2 are the same card on two different days.

It costs NO height — 235px, against 253px for the caption — because it sits in space the chart already reserves above the axis for your label. And it cannot collide: your label's near edge is at worst half its own width from the midpoint, so the two are always most of a half-track apart. Measured here, 106px clear and 186px clear; across the wider set it tested before this board was cut down, never under 119px.

It carries the same 14px leader every other label on the chart has, dropped to the axis at its own corner. Without it the tag read as floating text rather than as an annotation OF the axis.

THE COST, and it is the only one: the label lives in two places depending on the day. It is a static descriptor so it misleads nobody, but two people comparing yesterday's card with today's will find it has moved corners.

BOTTOM CENTRED is the fixed alternative. 253px, 18px more, and it can never collide because nothing else lives on that line. It carries no leader on purpose — it is a caption for the chart rather than an annotation of a point in it, so it should not appear to be pointing anywhere.

WHAT WAS CUT from this board, all of it measured first: fixed top-left and top-right (both collide with your own label when you are the fastest or the slowest — 26px and 45px of overlap, rendering "Moug time" and "log tYoue"), bottom-left and bottom-right, and the bare "log time" wording.

MEASURED: flip cards 235px, caption card 253px. No overlaps, nothing outside the track, every leader still landing on its label's corner.


## first-plays-note — the low-data states (Idea-P)

P — THE FIRST FEW PLAYS. What the card does before there is anything to compare against.

HOW MANY REFERENCES EXIST DEPENDS ON HOW MANY HAVE FINISHED:
  1 finisher  -> Fastest only. You are it, and Fastest and Slowest are equally
                 true of one person — only one of them is kind.
  2 finishers -> Fastest, Slowest. Still no median: at two it is a number
                 sitting between the only two dots and describing neither.
  3 or more   -> Fastest, Median, Slowest. At three the median is a real
                 person rather than a midpoint.

Your own label is separate and always drawn, above the axis, tracking your dot wherever it lands. When you ARE the fastest or the slowest, your label and that reference name the same dot from opposite sides of the line — which is the whole reason the two groups were split.

n = 10 IS THE BOUNDARY the board exists to show: the sentence stops counting places ("You're 3rd fastest") and starts giving a percentile ("top 70%").

A BUG THE BOARD FOUND, now fixed everywhere: the median marker disc was appended whenever there was any spread at all. At two finishers it drew a third dot for a median that has no label, and at an ODD count it stacked a second dot on the person who already WAS the median — three finishers drew four dots. It is now drawn only from three finishers, and only when nobody actually finished on that second. Measured after: 1, 2, 3 and 11 dots, the eleventh at n = 10 being the real median marker since 1m 44s is nobody's time.

DECIDED: at n = 1 your time prints twice on the same dot, as "You" above and "Fastest" below. Jamie, 1 Nov: leave it.


## log-note — the log axis (Idea-Q)

DAVE, 1 Nov: "Just needs to have an axis label to show it's the log of the time being displayed, rather than time." He is right, and it is the one thing on this card that could actually mislead — spacing across the track is not seconds, and nothing on the card admitted it.

A — CORNER OF THE CARD. Dave's own wording, "— log time", right-aligned under the chart. Nothing in the chart moves and the dots keep the full 319px. Costs 16px of height. Card 256px.

B — ON THE AXIS. Dave's first suggestion. The label sits at the right end of the axis line, so it reads as a unit with the thing it describes. The track shortens to make room: 277px instead of 319, so the dots lose 13% of their range and the slowest no longer reaches the card edge. Costs no height — card 235px, the SHORTEST of the three, because A's extra line costs more than B's narrower track.

C — IN THE HEADING. Mine, and it FAILS. Measured at 390px the title, the suffix and the Share button do not fit, so "Daily leaderboard" wraps to two lines. Left on the board as the evidence rather than quietly dropped.

RECOMMENDATION: B. An axis label belongs on the axis, where nobody has to go looking for it, and 13% costs less than it sounds — the dots are log-spaced, so the squeeze is even rather than concentrated at the crowded end. Take A instead if full width matters more; A is also the one that survives if the chart ever gets narrower.

MEASURED: A 256px, B 235px, C 251px but wrapping. Across all three every leader still lands on its label's corner and nothing crosses the card padding.

NOTE TO SELF: canvas notes cap at 5000 characters and silently truncate. The long note lost a section this way.


---

# The paths that were not taken


## today-note — today vs everyone, the goes version (Idea-M)

M is F4 with ONE card added and ONE chart removed. It visualises GOES, and O supersedes it with time. Kept so the step is visible. N has been rewritten for O.

WHY A SENTENCE AND NOT A CHART. Measured on production, 1 Nov: a median of 20 people finish a day, 88.1% of all 3,757 completions are one-go, and on 5 of the last 30 days NOT ONE finisher guessed wrong. Drawn as six bars that is one bar and five empty rows, half the time — the same empty picture we spent the morning trying to stop. Drawn as six figures it is legible at any n, including n = 1, which is what the first player of every day sees.

THE SPLIT OF LABOUR. The sentence never points at you when you did badly; it names the room instead ("17 of 20 got it first go"). The tally always says exactly where you are. So the kind sentence costs no information — see states 5 and 6 on N.

THE ATTEMPTS CHART IS CUT FROM ALL TIME. Not because it was badly drawn — Dave's live one works, the grey track holds each row open and the count is pinned right, which is better than the columns I built. It is cut because it never changes. Dave is 237 of 239 in one; tomorrow he is 238 of 240. The new card is different every single morning.

GOES IS THE WRONG VARIABLE, LONG TERM. 88% of people tie on 1, so no chart of goes can rank anyone. TIME can — nobody ties on 2m 28s. This card is the honest placeholder until the timer has a few weeks in it, and then Dave's whisker chart goes in the same slot with no layout change.

LEADERBOARD: BLOCKED, and not on taste. uid is a crypto.randomUUID() in localStorage — no name, no account, per-device. And POST /api/event (worker/index.ts:424) accepts any uid with no auth at all. Publishing a rank is the first reason anyone would have to forge events, on an endpoint that cannot tell them apart. Accounts first.

OWED BEFORE ANY OF THIS: track("puzzle_complete", tries) fires for daily, archive AND random from one call site, so a query windowed on today mixes all three into today's puzzle. The `source` column already exists and other events use it.

MEASURED: M natural 1257 against a 1270 frame; N natural 1332 against 1345. Tally cells 17 / 2 / 1(you) / dash / dash / dash, the marked cell on --accent-soft, no new shades anywhere.


## box-note — the box plot (Idea-D)

THE NUMBERS ON THIS BOARD DO NOT EXIST YET.

The game has no timer. dlng_history stores { date, tries, answer } and computeStats returns played, avgTries, streak, bestStreak. Nothing anywhere records how long a solve took.

A box plot also needs EVERY player's times, not just yours, so it needs a server read as well as a client timer. Three pieces of work, not one.

Reachable without a new client timer: analytics already logs puzzle_start and puzzle_complete per uid with ts in epoch ms, so the delta is a duration. It over-counts anyone who left the tab open, and misses anyone who resumed mid-game without a fresh puzzle_start. Good enough for a median, not for a "fastest".

Drawing rules used here: horizontal, because 390px has width and no height. YOU sits above the plot as a labelled accent pin so it is never confused with the median bar. The five numbers repeat as a dl, which is what a screen reader gets. Axis clipped at p95 and said so in words.


## f3-note — Idea-J

F4 and its dark pass.

A DAY PAST THE CAP IS A BROKEN COLUMN: three blocks at the bottom, a bolt for everything elided, the solid cap for the go that landed, and the true figure in foreground above it. No join lines — they read as noise at this size.

The figure lives on the column because a player with 6, 8, 9, 31 and 42 has five broken days and one axis label could only name one. The mock carries 8, 42 and 31 at once.

THE Y AXIS NAMES THE QUANTITY, NOT THE SCALE: "Goes", rotated, 13px regular in the foreground colour, identical to the "243 days" hint so the chart's annotations read as one family. Numbering it had nowhere to land — 1..5 contradicted the 42 on the broken column, and 1..42 would have labelled a top row that an ordinary column uses for five goes. The quantity label disagrees with nothing.

MEASURED: label 13px / 400 / rgb(38,38,36) light and rgb(250,248,244) dark, matching the hint byte for byte; no tick or rule elements left. Rows 1 to 3 faded, row 4 bolt, row 5 solid accent. Figures 8, 42, 31. Frame 1160 against 1149 of content, both boards.

RESULTS DISTRIBUTION, THE LOPSIDED CASE (240 in one, 2 in two, nothing else). Measured before the fix: the 2 scaled to 0.55px, and because the bar has a 1.5px border top and bottom its box cannot render under 3px — so the 2 and the four zeros all drew at exactly 3px. Twice and never looked the same.

Two rules now: a zero draws NOTHING and shows no count (the streak strip's rule for unused cells, so the two charts agree), and any non-zero floors at 8px. The peak is read from the data instead of the hard-coded 12 it used to divide by. The floor bends proportion at the bottom of the scale on purpose — the counts above the bars carry the precision, the heights carry the shape, and "some" never reads as "none". No third shade needed.

On the sample data the only change is the two count-of-1 bars, 6px to 8px.

STILL OPEN: for a player who is 99% one-go, the chart is one full bar and an empty row. That is a true picture and arguably the flattering one, but counts may read better as percentages at that skew.

NOT DONE, as asked: no baseline, no inverted stack. Share is on all three cards.


## f2-note — Idea-I

F2 and F3 kept as they were so each step is visible. F4 is the current one.


## onego-note

DECIDED 1 Nov. Three tiers, by how hard they are to hold.

1. PLAY STREAK — easy, daily, everyone has one. Gets the live chase on H.
2. ONE-GO PERCENTAGE — the one you aim at when you have no run going. Always non-zero once you have solved one in a single go, moves slowly, never resets. This is why it is now the FIGURE on all three boards (23%) and the raw count dropped to the note (7 of 30).
3. ONE-GO STREAK — the trophy. Consecutive days solved in one go. A MISSED DAY BREAKS IT. Hard on purpose.

Display rule that follows from tier 3 being rare: show BEST EVER, never a live counter. At a 23% one-go rate the current run is zero on 77% of days, two-in-a-row is 5%, three is 1.3%. A trophy that reads "0" most days is not a trophy. So all three boards show "Best one-go run: 3 days" and say what breaks it. A live run only earns screen space at 2 or more.

Data: all of this computes from dlng_history today, every entry already carries `tries`. Same two rules as the play streak — skip archived: true, apply the WR-01 recency gate. The "up from 20%" delta is first-half versus second-half of the same history, so it needs nothing new either. Only the time figures wait on the timer feature.


## rec-note — Idea-E

E is A's spine with Dave's comparison in the slot above the fold, and EVERY NUMBER ON IT EXISTS TODAY.

Four sections, in order: the result, everyone else, share, your record. The comparison sits second because "was that good?" is the question the screen is there to answer.

Phase one is goes, not time. analytics-db.ts:174 already groups puzzle_complete by guess count, so the distribution is a read endpoint, not a feature. Your record uses exactly the four fields computeStats returns: played, avgTries, streak, bestStreak. No invented figures.

Phase two drops D's time box plot directly under the goes chart, inside the same section. The heading ("Everyone else today") and the caption already cover both, so nothing above or below moves.

One line of code owed first: track("puzzle_complete", tries) fires for daily, archive AND random solves from a single call site, so a ts-windowed query mixes all three into today's puzzle. Pass a source — the column exists and other events already use it.


## stats-note

Worked from your inspiration board. Taken: the big figure with a small unit suffix, the delta line under the figure, the mini bar strip with one bar picked out, two related numbers in one card, and the "996 of 10,000" progress bar.

Left alone: the colour-blocked tiles (magenta/blue/teal break the one-accent AA rule) and the nested inner tiles (a card inside a card).

All three carry the same three blocks you asked for: today's goes AND time, active streak, all-time records. Average time is dropped everywhere. Solved-in-one leads the records on every board.

F — cards, today leads. Closest to your busy-but-informative version, minus the box count.
G — no containers at all. Rules and scale do the work, records read as a ledger.
H — streak is the page, today shrinks to a strip, and the one-go record gets a live chase.

ONE THING TO SETTLE: "1-go streak" is ambiguous. F, G and H all read it as consecutive days solved in a single go, and show a best run of 3. If you meant the plain count of one-go solves, that is the separate "Solved in one: 7" figure and the run can come out.

Time figures assume the timer feature you are adding separately. Nothing else on these boards needs new data.


## ideas-note

All three drop to one accent, stop colouring labels, use one container language, cut the three ways of saying "solved in one", drop the watermarks, and add a share.

They differ in what the screen is FOR.

A — the solve is the headline, stats stay.
B — the screen exists to make something you send.
C — the screen answers "how did I do, for me?".

Share text is spoiler-free: clue types, never the answer. Adding share is a product decision, so whichever wins goes through a brief first.


## results-note

Results is the one we are redesigning. All four accents are on it at once: solved line Lime, streaks Cherry, records Blueberry, all-time Grape. Change the theme and the four rotate together.


## source

Traced from the live app at 390px, 31 Oct 2026. Puzzle #238, a 30-day solve history, Lime accent.

/stats is the internal analytics dashboard. It has its own look and sits outside the design system on purpose.
