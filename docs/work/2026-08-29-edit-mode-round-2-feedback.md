# Edit mode — round 2, and the first Playwright run

2026-08-29. Jamie on an iPhone in Safari, the bot driving Chromium through
Playwright at the same time. Written down because the chat it came from is gone.

Branch `dev/edit-mode-roundtrip`. Companion to
[the handover](2026-08-29-edit-mode-handover.md) and
[the open ideas](2026-08-29-edit-mode-open-ideas.md).

---

## The shadow root is now OPEN

`src/edit-mode/panel.ts` used `attachShadow({ mode: 'closed' })`. A closed root is
invisible to Playwright: no selector reaches it, so not one control in the panel
could be clicked or read. The first run had to tap screen coordinates and judge
the result from screenshots.

Jamie approved opening it on 2026-08-29. Nothing is lost by it — edit mode is
dev-only, so there is no untrusted page to seal against, and the real protection
against a bad edit bleeding into the panel is `all: initial` on the shadow
content, which is unchanged and still asserted.

`tests/edit-mode-panel.spec.ts` now asserts the root is open and still isolated.

## What Playwright proved WORKS

Mobile Chromium, one worker, against `vite dev` on 5199.

- **The class picker round trip.** Add class, type, tap a result: the class lands
  on the element that was still selected and the picker closes.
- **Undo** takes back exactly one change.
- **Scrolling never moves the selection.**
- **A chip toggles a class off and back on** rather than deleting it.

## Bugs it found, and what was done

**1. Edits were not kept per branch. FIXED.** The store key was
`clumeral_edit_unknown` on every branch, so two branches would restore each
other's edits — the exact thing keying it to the branch was meant to prevent.
`overlay.ts` read `document.currentScript`, which is **always null in a module
script**. Now reads `script[data-branch]`.

**2. The pencil was on screen before it worked. FIXED.** It is drawn when the
panel mounts, but its tap handler was attached only after two fetches, one of
them the whole 23,037-class catalogue. A tap in that gap did nothing, silently.
This is very likely Jamie's "seems functionally flakey" from 2026-08-27, and it
is far worse on a phone over Tailscale than on the Pi. The tap is now taken
immediately and honoured once the catalogue lands.

**3. The class list jumped about. FIXED.** Jamie, 2026-08-29: "really jumpy and
janky, especially plus minus". Three separate causes, all now closed:

- `onStep` did `applyClass(removeClass(classes, name), next)`. `applyClass`
  deliberately puts a replacement in the slot the old class held — but
  pre-removing it left nothing to collide with, so **every − or + sent the class
  to the end of the row**. It no longer removes first.
- Switching a class back on appended it. It now goes back in the slot it left.
- A switched-off chip jumped to the end of the chip row. `ControlsState` now
  takes an `order`, and the overlay holds off-classes in place.

## Still open

- **The Safari discard-and-reload.** Jamie, 2026-08-29: "I'm convinced the Safari
  refresh isn't right, other web pages don't seem to refresh the same way, this
  completely kills the editor." Not reproducible in Chromium and not yet
  diagnosed. Worth checking whether something in the app makes iOS *more* willing
  to discard the tab than a normal page — memory held by the 5 MB dev stylesheet
  and the 23,037-class catalogue are the obvious suspects.
- **"Add class still pulls me out of the editor and back to no selected
  element."** The round trip PASSES in Chromium, so this is either iOS-specific
  or was the pencil race (bug 2) all along. Re-test on the phone after these
  fixes before digging further.
- **Wasted space on the right.** Classes that would fit wrap to the next line.
- **A drag in edit mode smears text selection** across the page. On iOS that is
  the copy/paste popup. Wants `user-select: none` while editing.
- **The breadcrumb calls the visible Play section `section.hidden`.** Either the
  path is built from the wrong node or the class is genuinely there and inert.

## How the run was done

There is still **no Playwright project for edit mode**. The existing suite serves
the production build, which deliberately has no edit mode in it. This run used a
throwaway config pointed at the dev server, and it was deleted afterwards, so CI
is unchanged. Brief item 88 proposed a real project and Jamie cut it on
2026-08-18; opening the shadow root has made it worth asking again.
