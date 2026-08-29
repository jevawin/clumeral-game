# Edit mode — first real use, Jamie 2026-08-24

Jamie ran edit mode on the iPhone for the first time. Nine items. Recorded here
rather than in chat because chat is lost across a context clear.

**What worked:** back undoes one step at a time and does not wipe the page —
acceptance check 1 from brief item 90 **passes on a real device**. That is the
one the identity bug sat closest to.

Jamie: *"if it's not finished yet you can ignore or bank these for actual
finished build."* So nothing here is being fixed in a rush; it is triaged and
waiting.

---

## Defects — the tool does not do what the brief already agreed

**F1. The selected element is not highlighted.** Brief item 61 says the selected
element gets an outline plus a label. It was never built — the panel shows the
breadcrumb and the chips, but nothing on the page says which element you are on.
Straightforwardly missing, not a design question.

**F2. Search is barely usable, and traps you.** Jamie: *"tiny, barely tappable,
too close to above and below, and doesn't activate the keyboard when tapped,
breaks functionality (can't get out)."*

Three separate faults in one control:
- the input has no sizing of its own, so it renders at the browser default while
  every button next to it is 44px
- tapping it does not focus it, so the keyboard never opens
- and because the collapse-to-search-only behaviour (item 33) keys on the focus
  event, no focus means the sheet collapses with no way back — **this is the
  "can't get out" and it is the worst of the three.**

**F3. The font steppers do nothing.** Confirmed as a real bug, and it is mine.
`scale.ts` groups a scale by NAME PREFIX, and `text-sm`, `text-2xl` and
`text-accent` all have the prefix `text` — so the font-size scale is polluted
with several hundred colours. Worse, ordering calls `parseFloat` on the suffix,
and `parseFloat('2xl')` is **2**, so `text-2xl` sorts as if it were the number
two while `text-sm` sorts as text.

The fix is to group a scale by the FAMILY MAP (the CSS properties a class
declares) and only then by prefix — which is the rule already used everywhere
else and should have been used here. Answering Jamie's question: yes, font size
is meant to be steppable, and this is why it is not.

**F4. Leaving Safari and coming back resets everything.** Brief item 52 exists
precisely for this: *"Safari discards backgrounded tabs, the screen locks, a
notification pulls him out."* `session-store.ts` is built and tested, so this is
a wiring fault rather than a missing feature — most likely the overlay restores
the patch set but never re-applies it to the page, or the restore races the
catalogue fetch. Needs reproducing on the device.

**F5. No way to close edit mode.** The pencil is supposed to toggle (item 30).
Either it is being covered by the sheet, or the sheet's own layout is sitting on
top of it. Needs looking at on the device.

## New asks — not in the brief, need deciding

**F6. Forward does not work.** Back undoes; there is no redo. The brief only ever
specified back (items 66-70), so this is a new feature rather than a defect. It
is cheap while the undo stack exists, but it changes what the back-stack means
and would want its own thinking.

**F7. Scroll the page while the sheet is enlarged.** Currently the sheet takes
the scroll and the page underneath is stuck. Sensible, and it interacts with F2 —
both are about the sheet's size and position.

**F8. Colour on chips and buttons.** Jamie: *"not fancy design just some colours."*
Worth noting the constraint: the panel is a SEALED SHADOW ROOT (item 65), so it
cannot use the project's Tailwind classes or theme tokens. Every colour is
hand-written in `panel.ts`. That was the accepted cost of Jamie's edits never
being able to make the tool unreadable.

**F9. Chips: deselect rather than remove.** Jamie: *"tap chip to deselect, keep in
list but greyed out, tap again to reapply. Then I can easily see what I removed
and put it back."* And if that is the behaviour, the `×` is redundant.

This is a genuinely better idea than what is there, and it is not just cosmetic:
it makes a removal reversible without reaching for undo, and it keeps the
element's original class list visible while you work. It does need a decision
about what a greyed-out chip means in the SESSION FILE — a removed class is
absent from `after`, and a chip that is greyed out is exactly that, so probably
nothing changes in the contract.

**Confirming what Jamie asked:** yes, tapping a chip currently removes the class
immediately — that was the brief's item 33 (*"tap a chip to remove it"*). His
proposal replaces it.

---

## Suggested order, if this is picked up

F2 first — it is the one that makes the tool hard to use at all, and F5 may
share a cause with it. Then F3 and F4, both plain bugs with the fix understood.
Then F1, which is small and makes everything else easier to judge.

F6 to F9 are product decisions and want a short round with Jamie before any
code. F9 in particular changes an interaction the brief settled.
