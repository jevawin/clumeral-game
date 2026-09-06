# Brief — the dev server command is /devstart now

Date: 2026-09-05 · Branch: `dev/jamie-controlled-dev-server` · Raised by Jamie,
2026-09-05: "New dev command is now devstart can you update docs? Then I'll start
and run your test."

**Short form: sections 1, 3, 8, 11 — approved by Jamie 2026-09-05.** This is a
rename with one real decision in it (section 8). Sections 2, 4, 5, 6, 7, 9 and 10
have no content: nothing is built, no maths, no state, no new module, no pixels,
no accessibility surface, no event.

**Closed: Jamie 2026-09-05** — asked whether the five in-app strings changed too
or docs only, he answered "Everything". Every recommendation accepted as written.

---

## 1. What it is
Settled: Jamie 2026-09-05 (accepted all recommendations) · Ack: n/a

1. The Telegram command that starts the dev server has been renamed from `/dev`
   to `/devstart`. The rename happened on the pi bot's side; this branch only has
   to stop telling Jamie to type a command that no longer exists.
   (assumed — it is what he reported)
2. `/devstop` is unchanged. (assumed — he named only the start command. Say so if
   that is wrong and both change together.)
3. It lands on `dev/jamie-controlled-dev-server`, the branch already open as
   PR #314, because the strings involved are ones that PR just wrote.
   (assumed — a second branch touching the same five lines would conflict with
   itself)

## 3. How it works
Settled: Jamie 2026-09-05 (accepted all recommendations) · Ack: n/a

4. `docs/EDIT-MODE.md` names `/dev` in five places. All become `/devstart`.
   (assumed — the whole request)
5. `edit-mode/shutdown-route.ts` and `src/edit-mode/overlay.ts` each name it once
   in a code comment. Both become `/devstart`. (assumed — same reason; a stale
   comment is how the next reader learns the wrong command)
6. `/api/dev/answer` is a URL in the game's own worker and has nothing to do with
   the Telegram command. Untouched. (assumed — a rename there would break the
   game)
7. `CLAUDE.md` and the other repo docs do not name the command at all. Nothing to
   do. (checked)

## 8. Copy & wording
Settled: Jamie 2026-09-05 (accepted all recommendations) · Ack: n/a — Jamie's own

8. **Five user-facing strings in `src/edit-mode/copy.ts` say `/dev`**, and Jamie
   asked only for the docs. They are what the page says on the phone at the
   moment the server stops, and two of them are the LAST thing that page will
   ever say — the server that served it has gone, so there is no next screen to
   correct them.
   **My rec: change all five to `/devstart`.** Why: a closing message that names
   a dead command is worse than no instruction at all, and this is precisely the
   moment there is no way to recover from it in the app.
9. The five: `stopped`, `stoppedNothing`, `stoppedNothingSaved`, `discarded`,
   `discardedWithSaved`. Nothing else about their wording changes.
   (assumed — the rename is the only thing that moved)
10. Three of the five are pinned in `tests/edit-mode-safety.spec.ts`, which
    asserts them ABSENT from the production build. The pins follow `COPY`
    automatically, so they need no edit. (checked)

## 11. Done / test plan
Settled: Jamie 2026-09-05 (accepted all recommendations) · Ack: n/a

11. `npx vitest run` green, and `tests/edit-mode-safety.spec.ts` green against a
    real `dist/` — the strings change, and that spec is what proves they never
    reach production. (assumed)
12. `grep -rn '/dev\b'` finds no remaining Telegram-command reference outside
    `/api/dev/answer` and `/dev/null`. (assumed)
13. Jamie's own check is the one that matters and he has already named it: start
    the server with the new command and run the acceptance test on his phone.
    (assumed)


---

## Built, same day

One commit. `/dev` → `/devstart` in thirteen places: six in
`docs/EDIT-MODE.md`, five user-facing strings in `src/edit-mode/copy.ts`, and one
code comment each in `edit-mode/shutdown-route.ts` and `src/edit-mode/overlay.ts`.

`/devstop` untouched, and `/api/dev/answer` untouched — that is the game's own
worker route and has nothing to do with the Telegram command. The replacement was
written to match `/dev` only at a word boundary and not before a slash, so
neither could be caught by accident.

No `da-build` review: this is a copy fix with no logic in it, which
[CLAUDE.md](../../CLAUDE.md) exempts. `npx vitest run` and the safety spec against
a real `dist/` are the check that the strings still never reach production.
