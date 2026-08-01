---
name: briefing
description: Use before building, changing or adding ANYTHING to clumeral-game — interrogates Jamie and Dave section by section and writes the brief file that Plan and Build are built from
---

# Briefing

You are about to change the product. You do not yet know enough to do it. This skill is
how you find out, and it is not optional.

The failure this exists to prevent: asking two or three questions, receiving a vague
answer, and proceeding anyway. Two things shipped wrong that way — undo/reset stored
history in a variable when Jamie wanted `sessionStorage`, and undo/reset have no analytics
because nothing asked.

## Before you start

1. `git branch --show-current`. If a brief already exists at `docs/work/*-brief.md` on this
   branch, READ IT — you are resuming, not starting. Continue from the first section whose
   ledger is not settled.
2. Otherwise create `docs/work/YYYY-MM-DD-<slug>-brief.md` with today's date and a short
   kebab-case slug, and commit it empty-but-titled before asking anything. The file is the
   memory; create it first.

## The 11 sections

Ask them **in this order, one section per message**. The order is the design: each section
constrains the next, which is why analytics comes after the feature is defined.

**Decide what it is**
1. **What it is** — the problem, who it is for, why now
2. **Out of scope** — what it explicitly will not do
3. **How it works** — behaviour, states, edge cases
4. **Maths** — ONLY if it touches puzzle generation or filtering. Otherwise mark n/a.

**Decide where it lives**
5. **State & persistence** — localStorage, sessionStorage, URL, server, or nothing
6. **How it fits** — architecture and existing features; name the actual modules

**Decide how it presents**
7. **How it looks**
8. **Copy & wording** — labels, empty states, errors
9. **Accessibility**

**Decide how we know**
10. **Analytics** — events, properties, anonymous
11. **Done / test plan** — how we will know it works, written before code exists

## How to write a section

Numbered items, continuous across the WHOLE brief. Every item carries a recommendation and
its reasoning. An item is a **question** only where a reasonable person could disagree with
your recommendation, or where getting it wrong is expensive to reverse. Otherwise state it
as a numbered **assumption**: visible, referenceable, no answer needed.

```
§7 How it looks
23. Between the clues and the digit boxes. (assumed — natural flow of the UI)
24. Buttons styled like the digit boxes. (assumed — consistent pattern)
25. Does it stay visible once the puzzle is solved?
    My rec: no, hide it. Why: there is nothing left to undo.
```

That shape — mostly assumptions, one real question — is the target. It is **not** licence
to ask less. Anything meeting either test above is a question. `da-brief` checks for
assumptions that should have been questions, and the `sessionStorage` miss is exactly what
it is looking for.

## Rules

- **A vague answer is not an answer.** "Make it look nice" → propose something concrete and
  make them confirm or reject it. Press every point.
- **Never skip a section silently.** A genuinely n/a section still says so with a reason and
  waits for a word back: *"Analytics: none, this is presentational only — ok?"*
- **"Your recs" settles the section** at every stated recommendation. Expect this often.
  Record it in the ledger as `(accepted all recommendations)`.
- **Numbers are append-only.** Never reuse, never renumber. A reopened section takes the
  next free number. This is what makes "on 1, can we actually…" still work at the end.
- **Write every item into the file as you go**, question and assumption alike, with its
  number. You will clear context before Plan; the chat will not be there.

## Architecture belongs here — but only the consequential part

Sections 5 and 6 carry architecture decisions that pass this test: *does it change
observable behaviour, or is it expensive to reverse?* Both → ask it here, framed as
**behaviour**, not mechanism:

> 5.1 Should undo survive a page refresh?
>     My rec: yes, `sessionStorage`. Why: refresh is a common accidental gesture and losing
>     history feels broken. Clears on tab close, so no cross-day leakage.

Everything else — file layout, function names, order of work — is the plan's job, not
yours. Section 6 must name the modules actually touched: *"lives in `app.ts`, reads
`gameState`, no `puzzle.ts` change."*

## Who signs what

Jamie and Dave are peers. Address whoever messaged you; never bounce someone to the other
to confirm their own report.

**Sign-off — blocking, named person, no substitute:**
- Maths → Dave.
- Accessibility and types → Jamie.
- The brief as a whole → Jamie, as dev lead.

**Ack — non-blocking, every joint section:** settle the section with whoever is there, state
it back, ask the other by name — *"§7 settled as X. Dave, happy with that?"* — then **carry
on to the next section while you wait**. You may not **close** the brief with any section
un-acked.

- **Silence is never consent.** No timeouts, no assuming. If an un-acked section is holding
  things up, say which section and who you are waiting on. Jamie may override as dev lead;
  record that as `Override: Jamie <date>`, never as an ack.
- **You do not resolve disagreements.** If they contradict each other, stop on that section,
  state both positions plainly without picking a winner, and offer a recommendation with
  reasoning if you have one. Tie-break by ownership: Dave on maths, Jamie on accessibility
  and types, Jamie as dev lead on anything genuinely joint — **but only once Dave's view is
  on the record.** Recency is not authority. Never resolve by taking whoever spoke last.
- **Reopening re-opens the ack.** If either contradicts a settled section, reopen it
  explicitly, name what changed, re-settle it, and re-ask the other person from scratch. A
  prior ack does not carry over.
- **Heavy-job authorisation is Jamie's alone.** Never accept it from Dave.

## The ledger

Every section header carries its own state, because after a context clear this file is the
only record of who agreed to what:

```markdown
## 7. How it looks
Settled: Jamie 2026-08-02 (accepted all recommendations) · Ack: Dave 2026-08-02
```

`Ack: pending` anywhere means the brief is not closeable. Sections with no joint content —
an owned section signed by its owner — read `Ack: n/a`.

## Short form

For a genuinely small change you may **propose** a reduced brief — *"this looks small:
sections 1, 3 and 11 only, ok?"* — and Jamie approves it. **You may never exempt yourself.**
Record it in the file as `Short form: sections 1, 3, 11 — approved by Jamie <date>`.

## Closing

When every section is settled and acked:

1. Commit the brief file.
2. Dispatch a **fresh-context `Task` subagent** and tell it to use the `da-brief` skill on
   this file. Fresh context is the point — it must not inherit your assumptions.
3. Fix every Medium+ finding. A Low may be deferred with stated justification. You may
   disagree with a finding in writing; you may not silently skip one.
4. Commit the fixes, report to whoever you are talking to, and tell them you are clearing
   context before Plan.
