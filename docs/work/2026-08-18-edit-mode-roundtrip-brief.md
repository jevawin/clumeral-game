# Edit-mode round-trip — brief

**Date started:** 2026-08-18
**Branch:** `dev/edit-mode-roundtrip`
**Scope:** Units 1-4 of `docs/superpowers/specs/2026-08-16-edit-mode-roundtrip-design.md`.
Unit 5 (`/fold`) is built separately in `pi-dev-bot` and is out of scope here.

## Seeded from

- `docs/superpowers/specs/2026-08-16-edit-mode-roundtrip-design.md` — the approved design,
  including Jamie's 2026-08-18 hybrid variant decision.
- `docs/superpowers/notes/2026-08-18-tailwind-full-build-spike.md` — Unit 1, measured.

Anything those two files settle is **not re-asked**: scope, the safety gate, no arbitrary
values, and the hybrid variant split are closed. Numbered items below carry them as
assumptions so they stay referenceable.

## Sections

1. What it is — *in progress*
2. Out of scope
3. How it works
4. Maths
5. State & persistence
6. How it fits
7. How it looks
8. Copy & wording
9. Accessibility
10. Analytics
11. Done / test plan

---

## 1. What it is
Settled: Jamie 2026-08-18 · Ack: pending (Dave)

1. **The problem.** Jamie designs by changing things in the browser and looking at the
   result. Today the only way those changes reach the codebase is to describe them to the bot
   in Telegram, which is lossy in both directions — precise descriptions are tedious, vague
   ones get guessed at. (assumed — the design doc's opening)

2. **Who it is for.** Jamie edits. Dave looks, using the per-branch preview URL exactly as he
   does now. Nothing in Units 1-4 changes Dave's route. (assumed — the design doc)

3. **Why now.** The one unverified thing, Unit 1, was measured on 2026-08-18 and works. The
   fallback was not needed. Nothing else in Units 1-4 depends on an unknown. (assumed)

4. **What we are building here.** Units 1-4: the full-Tailwind dev build, the class
   catalogue, the overlay, and the middleware that writes the session file. The deliverable
   ends when `.edit-sessions/<timestamp>.json` exists in the working tree with a well-formed
   patch set in it. (assumed — Jamie's scope boundary, 2026-08-18)

5. **Not our problem here.** Whether `/fold` correctly locates an element in source, or
   normalises it to house conventions, is `pi-dev-bot`'s job. What *is* our problem is that
   the JSON contract is exact enough for that half to be written against it without guessing.
   (assumed)

6. **Where can edit mode actually run?**
   My rec: **the Pi's dev server only — not preprod.** Why: the design says "dev/preprod",
   but preprod is a deployed Worker version with no filesystem and no Vite. Tapping Done
   there cannot write a session file, so edit mode would look available and then fail at the
   last step. Preprod is also Dave's route, and he only looks. Gating to dev alone makes the
   safety test simpler too — the overlay is absent from every deployed artefact, not just
   production.

7. **The safety test is now stronger, so it must assert more.** Edit mode must be absent from
   **every deployed artefact — preprod as well as production** — and that is asserted against
   the built output, never a config flag. It covers all three parts: the overlay code, the
   dev-server middleware, and the edit-mode stylesheet, plus the edit-mode-only utilities the
   spike proved can leak into the CSS. Concrete assertions land in §11. (Jamie 2026-08-18)

8. **How Jamie reaches the dev server, which is now the only route.** Over Tailscale from his
   phone, or a cloudflared tunnel if a public link is ever wanted. The server accepts POSTs
   that write files into the working tree, so it is **never exposed unauthenticated**. This is
   a constraint on the design, not an implementation detail. (Jamie 2026-08-18)

## 2. Out of scope
Settled: pending · Ack: pending

9. **Unit 5, `/fold`.** Lives in `pi-dev-bot` and is being built separately. We own the file
   format it reads; we do not own what it does with it. (assumed — Jamie's boundary)

10. **Arbitrary values.** `mt-[13px]` is not offered and cannot be typed. Hitting the edge of
    the scale is information: Jamie says so in words and the token set gets discussed.
    (assumed — closed in the design, not reopened here)

11. **Any change to preprod or production behaviour.** Both stay exactly as they are today.
    (assumed — follows from item 6)

12. **Fixing the docs class-scanning leak.** That is issue #312 and a separate branch. This
    work must not make it worse, but does not fix it. (assumed — Jamie 2026-08-18)

13. **Screenshots and computed CSS.** The patch carries class lists and identifying context,
    nothing rendered. (assumed — the design rejected both)

14. **Build-time source stamping.** No Vite plugin writing `data-src` onto elements. The bot
    greps and asks when ambiguous. A clean later addition if real use needs it. (assumed —
    rejected in the design)

15. **The desktop panel is IN scope**, including its raw class field and free-CSS box. It is
    part of Unit 3 as designed. Note the consequence for §3 and the contract: a free-CSS entry
    is not a class change, so the session file has to carry more than one kind of patch.
    (assumed — the design specifies it)

16. **Can Dave ever view an uncommitted edit session, or only the PR preview?**
    My rec: **only the PR preview — out of scope.** Why: an uncommitted session exists only on
    the Pi's dev server behind Tailscale, so letting Dave see it means either adding him to
    the tailnet or standing up a tunnel to a server that accepts file-writing POSTs. And what
    he would be looking at is a draft the bot is about to rewrite — the overlay's output is
    deliberately not code anyone would keep. The cost of saying no: Dave cannot weigh in until
    the PR exists, so a change he dislikes costs one extra round trip.

### Item 16 reopened — Jamie 2026-08-18, 22:07

Jamie asked for the simplest way to give Dave a view-only link, ideally showing "the version
in editing". That contradicts the recommendation in item 16, so the item is reopened rather
than amended. Items 17-20 replace it.

17. **A link alone does not show Dave anything.** This is the part that is easy to miss.
    Jamie's edits live in the DOM of Jamie's browser and nowhere else until he taps Done. If
    Dave loads the same URL he gets a fresh page with none of them. So "give Dave a link" and
    "let Dave see the edits" are two separate pieces of work, and only the first is network
    plumbing. (established — follows from Unit 3's design)

18. **Getting Dave a link — recommendation: share the Pi with Dave's own Tailscale account.**
    Why: no public exposure at all, he authenticates as himself, it works on his phone, and
    we add no infrastructure. Fallback if that is friction: a named Cloudflare Tunnel behind
    Cloudflare Access restricted to Dave's email — we already have the Cloudflare account.
    Rejected: dynamic DNS and a port forward (opens the home network, no auth, changing IP),
    and a bare `trycloudflare.com` quick tunnel (a public unauthenticated URL to a server that
    writes files, which item 8 forbids).

19. **Whichever route, the write guard is app-level, not network-level.** The middleware
    refuses POSTs that do not come from localhost, so "view only" is enforced by the server
    rather than by who was given the link. Cheap, and it makes item 8 true by construction
    instead of by promise. Needs a test. (assumed)

20. **How much of the edit does Dave see — replayed, or live?**
    My rec: **replay the saved session on load.** When Jamie taps Done the session file
    already exists; the dev server hands it to any page load and the overlay re-applies it. So
    Dave sees the edit one beat later, after Done, on his own refresh. The alternative is live
    mirroring — a socket broadcasting class changes from Jamie's browser to Dave's — which is
    real-time but is a whole extra mechanism, a new failure mode, and the only thing it buys
    is watching the edit happen rather than seeing the result.

### Item 16 resolved — Jamie 2026-08-18, 22:13: "After I press done is fine. Cloudflare
tunnel also fine. No tailscale."

21. **Dave sees a replayed session, not a live one.** Item 20 accepted: the dev server hands
    the saved session to any page load and the overlay re-applies it, so Dave refreshes after
    Jamie taps Done. Live mirroring is not built. (settled — Jamie 2026-08-18)

22. **Dave's route is a Cloudflare tunnel. Tailscale is not used at all.** This supersedes the
    Tailscale half of item 8 and the recommendation in item 18. (settled — Jamie 2026-08-18)

23. **Dropping Tailscale collides with the write guard, and something has to give.** Item 19
    said the middleware refuses writes from anywhere but localhost. That was safe while
    Tailscale carried Jamie and the tunnel carried nobody. With no Tailscale, if Jamie edits
    *through the tunnel* then a localhost-only guard refuses Jamie too, and edit mode cannot
    write anything. The two ways out:

    - **(a) Jamie edits on the home network.** His phone reaches the Pi directly, the guard
      stays "local network only", and the tunnel is read-only by construction — no Cloudflare
      Access, no allowlist, nothing to configure. Costs: editing only works at home.
    - **(b) Jamie edits through the tunnel too.** Then the server cannot tell Jamie from Dave
      by address, so it needs identity: a named tunnel behind Cloudflare Access with both
      emails allowed, and the middleware permitting writes only for Jamie's. Costs: a one-off
      Cloudflare Access setup, and every edit depends on it working.

    My rec: **(a)**, with (b) as a later addition if editing away from home turns out to
    matter. Why: it needs no new configuration, it keeps item 8's "never exposed
    unauthenticated" true without an auth layer to get wrong, and the failure mode is
    "edit mode is unavailable" rather than "the write guard is misconfigured".

### Item 23 resolved — Jamie 2026-08-18, 22:17

"I edit on the same network via tailscale. The tunnel is read only always, hence it being
fine to be a public url like the previous links."

24. **Jamie reaches the dev server over Tailscale; Dave reaches it over a Cloudflare tunnel;
    the tunnel is read-only always.** Item 22's "no Tailscale" meant *Dave* does not go on the
    tailnet — Jamie still does. Item 8 stands as originally written. A public tunnel URL is
    acceptable, on the same footing as the existing preview links, **because it is read-only.**
    Everything therefore rests on the read-only half actually being true. (settled — Jamie)

25. **A tunnel makes Dave's traffic look local, so an address-based write guard fails open.**
    This is the trap and it is worth stating flatly: `cloudflared` connects to the dev server
    as a normal local client, so requests that started at Dave's phone arrive from
    `127.0.0.1`. A guard reading "allow writes from localhost and the tailnet" would therefore
    **allow Dave and no-one else would notice.** Item 19's guard as written is not merely
    insufficient, it is inverted. (established)

26. **How the read-only half is enforced.**
    My rec: **point the tunnel at a second port that has no write handler at all.** A small
    read-only proxy listens on its own port, forwards GET and HEAD to the dev server, and
    answers everything else with 405. Jamie keeps using the dev server's own port over
    Tailscale. Why this rather than inspecting headers: nothing reaching the tunnel port can
    write, whatever it claims to be, so the guarantee is structural rather than a matter of
    trusting `cf-connecting-ip` — which anything able to reach the port could set. Cheap
    fallback if the proxy proves annoying: reject writes on any request carrying
    `cf-connecting-ip` or `x-forwarded-for`. Weaker, and it needs its own test.

27. **Test it as a positive.** Assert that a POST to the tunnel port is refused, not merely
    that a POST to the dev port succeeds. Per the project rule: remove the guard and watch
    that test go red. (assumed)

### Jamie 2026-08-18, 22:26 — tunnel versus nginx and a DNS record

28. **These are two separate decisions and only one of them is a choice.** The exposure route
    (how Dave's request reaches the Pi) and the write guard (what stops him writing) are
    independent. The second port from item 26 is wanted either way.

29. **Exposure route — recommendation: `cloudflared` tunnel, not DNS to the home IP.** Why it
    is genuinely easier, not just different:

    - **Nothing is opened on the home router.** The tunnel dials *out* from the Pi. An `A`
      record pointing at the home address means a permanently open inbound port, and that port
      reaches a machine holding the repo and a bot token.
    - **No certificate to obtain or renew**, because TLS terminates at Cloudflare.
    - **No nginx**, so nothing to configure or keep patched.
    - **No changing-IP problem**, which is the only thing the DNS-API idea solves — and the
      tunnel does not have it, so the API updates are work that buys nothing.
    - `dev.clumeral.com` is still available: a *named* tunnel creates that record once and it
      never needs touching. clumeral.com is already on Cloudflare.

    A quick tunnel (one command, no account, a throwaway `trycloudflare.com` address that
    changes each run) is the zero-setup start; the named tunnel is the tidy version. Both
    point at the read-only port, so both are safe by construction.

## 2. Out of scope — status
Settled: Jamie 2026-08-18 (items 9-15, 21-29) · Ack: pending (Dave)

---

## 3. How it works
Settled: Jamie 2026-08-18 (items 30-46) · Ack: pending (Dave)

Behaviour taken straight from the design doc, recorded so it survives the context clear.

30. **Mode toggle.** A floating pencil button, bottom-right, flips play mode and edit mode. In
    edit mode every pointer event is intercepted at the document level in the capture phase,
    so no tap reaches the game. Flipping back restores normal play, so a change can be tried
    in use. (assumed — the design; load-bearing, because taps are gameplay)

31. **Selection.** A tap selects the topmost element under the point. A horizontally
    scrollable breadcrumb reaches any ancestor in one tap, and thumb-sized arrows step to
    parent, first child and siblings for elements whose boxes are identical. (assumed)

32. **The selection label cannot show a source location, and the design says it does.** This
    is an internal contradiction in the design, not a new decision: build-time source stamping
    was rejected, so nothing in the browser knows which file an element came from.
    My rec: the label shows the tag, the breadcrumb path and the first few words of visible
    text. Why: that is exactly what the design tells the bot to grep on, so the label shows
    the operator the same evidence the bot will use. Two identical boxes are told apart by
    their path, which is what the breadcrumb already gives.

33. **Panel, phone.** Collapsible bottom sheet: breadcrumb, nav arrows, class chips (tap to
    remove, `+` opens search), steppers, then undo / reset element / Done. When search is
    focused the sheet collapses to search and results only and the selected element is
    scrolled above it, so the keyboard cannot cover the thing being edited. (assumed)

34. **Panel, desktop.** The same panel docked right, plus a raw class field and a free-CSS
    box. (assumed — see item 15 for the consequence on the file format)

35. **Search.** Prefix match only. Matches the segment after the last `:`, so `mt` finds
    `md:mt-4`. Strips a leading `-`, so `mt` finds `-mt-4`. Groups by family and caps results,
    because `bg` and `text` run to thousands. (assumed)

36. **Steppers walk the scale**; search picks the utility. Two jobs, which is why search never
    has to enumerate every step. (assumed)

37. **JS-controlled classes.** Some classes are set at runtime by theme or game state. The
    overlay notices when the class list changes after an edit and flags it in the patch rather
    than losing the change silently. (assumed)

38. **Replace, do not append — and the two awkward cases.** Adding `mt-6` to an element that
    has `mt-4` must remove `mt-4`, or CSS order decides the winner and the tap looks broken.
    The design calls the family map the single most likely source of silent wrongness. Two
    cases it leaves open:

    **(a) `p-4` versus `px-4`.** Three options: treat all padding as one family, so setting
    left-and-right silently drops top-and-bottom; treat them as unrelated and let both sit
    there, which is correct CSS but leaves a chip list nobody can read; or **expand on
    conflict** — adding `px-6` to `p-4` rewrites the element to `py-4 px-6`.
    My rec: **expand on conflict.** Nothing is lost, the chips show exactly what is applied,
    and `/fold` receives an unambiguous statement of intent.

    **(b) `text-sm` versus `text-text`.** The same prefix carries size and colour, so a prefix
    map cannot tell them apart.
    My rec: **classify by what the value is, using Tailwind's own data rather than a
    hand-written list.** The design system knows which utilities take a colour — they are the
    ones carrying opacity modifiers — so the split comes from the same source as the
    catalogue and cannot drift from it. The same rule covers `border-2` against
    `border-accent`, which has the identical shape.

39. **Where the pre-built / on-demand line falls.** Open — asked next, after 38 settles.

### Jamie 2026-08-18, 22:36 — three corrections

40. **Item 38(a) was wrong: padding needs no special handling at all.** Jamie: "why do you
    need to add top and bottom padding if I say inline only?" Correct, and the CSS backs him
    up. Tested on this Tailwind build by compiling the shorthand and the axis utility together
    and reading the output order:

    ```
    .m-2@5309  .mx-8@5360  .p-4@5564  .px-6@5616  .py-2@5676  .pt-1@5735
    ```

    Tailwind always emits the shorthand **before** the more specific utility, so `p-4 px-6`
    resolves to "6 left and right, 4 top and bottom" whatever order the class attribute is in.
    Keeping both is not a mess, it is the correct answer, and it is exactly what "inline only"
    means. **No cross-family rule for padding, margin or inset.** Only a genuine same-family
    collision — `px-4` against `px-6` — replaces.

41. **The overlay records the viewport width it was edited at.** Jamie cannot see clamp or
    responsive behaviour on one device, so the width is the missing context. It goes in the
    patch, and the conversation about other widths happens with the bot afterwards — Jamie
    confirms or changes the suggestions. The overlay does not try to offer them itself.
    (settled — Jamie 2026-08-18)

42. **The session is a starting point for design iteration with the bot, not a patch to
    apply.** Jamie: "all of this goes back to you for design iteration. Not direct to the
    build." This is the principle that settles item 40 and several like it: the overlay should
    record what Jamie did, plainly and losslessly, and must not be clever on his behalf. He is
    looking at the result while he works, so a change that looks wrong is caught by his eyes,
    not by our rules. (settled — Jamie 2026-08-18)

43. **Item 38(b) accepted** — text size against text colour is split using Tailwind's own
    data, and the same rule covers `border-2` against `border-accent`. (settled — Jamie)

44. **Where the pre-built / on-demand line falls — measured, 2026-08-18.**

    | pre-built set | classes | stylesheet |
    |---|---|---|
    | stepper families only (spacing, size, radius, text size, position) | 4,399 | **0.43 MB** |
    | everything that is not a colour | 8,397 | **1.16 MB** |
    | everything | 23,031 | 4.99 MB |

    My rec: **pre-build everything that is not a colour.** Why: at 1.16 MB it is a quarter of
    the full build and the unmeasured phone-parse risk stops mattering, while the rule itself
    is one sentence rather than a curated family list that will drift. Colours are the genuine
    explosion — shade times opacity — and they are also where a one-beat rebuild is least
    annoying, because picking a colour is a considered act rather than a stepper tap.

### Jamie 2026-08-18, 22:52 — "iPhone 16 Pro. Will it choke?"

45. **Almost certainly not, but this is judgement, not measurement.** Nothing here has been
    run on an iPhone — the Pi cannot, and CI's WebKit is not an iPhone either. What is
    measured: the non-colour set is 1.16 MB and about 8,400 rules; the full set is 4.99 MB and
    about 23,000. What is judgement: parsing a megabyte of CSS is milliseconds on an A18 Pro,
    and unmatched rules cost almost nothing to match because browsers index selectors by their
    class, so the cost is close to linear in *file size* rather than in rules considered per
    element. The larger real cost is transfer, and the dev server currently sends it
    uncompressed (spike note, cost 1).

46. **The on-demand half exists to hedge a risk nobody has confirmed, and the hedge can be
    dropped in a minute of testing.** Jamie has the phone. Once the pre-built stylesheet
    exists he can load it and know. So:
    My rec: **build the pre-built half first, have Jamie load it on the iPhone, and only build
    the on-demand rebuild machinery if that measurement says we need it.** If the full 4.99 MB
    is comfortable, the on-demand mechanism, its rebuild wait and its failure modes all
    disappear, and the class catalogue becomes simply "everything". If it is not, we already
    know the line at 1.16 MB works and we build the tail as designed. Either way the answer
    arrives before the expensive half is written, not after.
    Note this **re-sequences** Jamie's hybrid decision of 2026-08-18 rather than reversing it:
    the hybrid stays the plan of record unless the phone says otherwise.

47. **Item 46 accepted — "build it that way".** The pre-built stylesheet ships first, Jamie
    loads it on the iPhone 16 Pro, and the on-demand rebuild machinery is built only if that
    measurement calls for it. The hybrid remains the documented fallback. (settled — Jamie
    2026-08-18)

---

## 4. Maths
Settled: pending · Ack: n/a (Dave owns maths; nothing here touches it)

48. **Nothing.** Edit mode does not touch puzzle generation, clue selection, filtering or
    seeding. It changes class attributes in a browser and writes a JSON file. No `puzzle.ts`
    change, no generator change, no archive implication. Marked n/a with that reason, and
    flagged to Dave in case he disagrees. (assumed)

---

## 5. State & persistence
Settled: Jamie 2026-08-18 (items 49-54) · Ack: pending (Dave)

49. **The finished session file.** `.edit-sessions/<timestamp>.json` in the game working tree,
    gitignored, one file per tap of Done. (assumed — the design)

50. **Files are not cleaned up by us.** They accumulate until `/fold` consumes them, which is
    the other repo's business. Nothing here deletes a session it did not write. (assumed)

51. **What Dave's replay applies.** Every session file that `/fold` has not yet consumed, in
    timestamp order — not just the newest. Why: Jamie can tap Done several times before
    anything is folded, and replaying only the last one would silently drop every earlier
    element he touched. (assumed, but it is the kind of thing that fails quietly, so §11 gets
    a test for it)

52. **Does an unfinished edit survive the tab going away?**
    My rec: **yes — keep the working patch set in `sessionStorage`, keyed to the branch.**
    Why: this is phone editing. Safari discards backgrounded tabs, the screen locks, a
    notification pulls him out. Losing twenty minutes of tweaks to an accidental app switch
    would make edit mode untrustworthy, and the fix is a few lines. `sessionStorage` rather
    than `localStorage` so it clears with the tab and cannot resurrect a stale edit days
    later against different source. The alternative — hold it in memory only — is simpler and
    is exactly the mistake undo/reset made once already.

53. **Edit mode itself is remembered the same way**, so a reload does not silently drop Jamie
    back into play mode with his selection lost. (assumed — follows from 52)

54. **Item 52 accepted, on the phone not the server** — Jamie 2026-08-18: "keep it on my phone
    not on the server." `sessionStorage` in Jamie's browser. Nothing unfinished is sent to the
    Pi, so the server holds only what Done produced. This also keeps item 51 honest: Dave can
    only ever see finished sessions, because unfinished ones do not exist outside Jamie's
    phone. (settled — Jamie)

---

## 6. How it fits
Settled: Jamie 2026-08-18 (items 55-60, injected by the plugin) · Ack: pending (Dave)

55. **All new code, in its own place.** Edit mode is new files under `src/edit-mode/` plus a
    Vite plugin in `vite.config.ts`. No existing game module changes behaviour. (assumed)

56. **The dev-only wiring is the plugin's job, not `index.html`'s.** The plugin swaps the
    stylesheet link and injects the overlay when serving, so the committed `index.html` has no
    edit-mode markup in it at all. (assumed)

57. **What it reads from the existing app.** `theme.ts` toggles `.dark` and several modules
    toggle `.hidden`; those are the runtime-controlled classes behind item 37. Edit mode
    observes them and never writes them. (assumed)

58. **`shortcuts.ts` must be suspended in edit mode.** Keyboard shortcuts are gameplay, and
    edit mode already intercepts pointer events for the same reason. Play mode restores them.
    (assumed — same logic as item 30, which the design made explicit only for taps)

59. **The generated class list is never committed.** It is produced when the dev server starts
    and written somewhere gitignored. Why this matters beyond tidiness: a committed file of
    23,031 class names is 386 kB of source that Tailwind's automatic scan would read, which is
    issue #312's failure mode at full volume — every class in the project would land in the
    production stylesheet. (assumed, and it needs the §11 assertion to catch a regression)

60. **How does the overlay get into the page — imported by the app, or injected by the
    plugin?**
    My rec: **injected by the plugin, with zero references from game code.** The obvious
    alternative is an import in `app.ts` wrapped in a dev-only condition, which the bundler
    strips for production. It works, but it makes the safety guarantee depend on
    tree-shaking behaving — a bundler upgrade or a stray re-export could quietly put the
    overlay back in a deployed artefact, and the only thing standing between that and
    production is a test we hope still runs. If no game module ever names edit mode, there is
    nothing to strip and nothing to get wrong. Cost: the plugin has to do a little HTML
    rewriting that an import would not.

---

## 7. How it looks
Settled: Jamie 2026-08-18 (items 61-64, sealed) · Ack: pending (Dave)

61. **Layout comes from the design and is not re-litigated:** pencil button bottom-right,
    collapsible bottom sheet on phone, the same panel docked right on desktop, selected
    element outlined with a label. (assumed)

62. **Bottom-right is free, but the overlay has to clear what is already there.** `index.html`
    has a fixed bottom-centre stack at `z-[300]`. The overlay sits above everything the game
    uses, and the pencil must not cover the bottom-centre stack on a narrow screen. (assumed)

63. **The panel never becomes selectable.** Tapping the overlay adjusts the overlay; only the
    page underneath can be selected. (assumed — otherwise the tool can select itself and the
    breadcrumb becomes nonsense)

64. **Should the panel be immune to Jamie's edits, or should it change with them?**
    My rec: **immune — the overlay renders in a shadow root with its own hand-written CSS.**
    Why it matters: Jamie can select `<body>` and add a text size or a colour, and by design
    that inherits into everything, including the panel. A bad edit could then make the panel
    unreadable — and the only way out of an unreadable panel is the panel. Worse, an edit that
    quietly restyles the tool makes it impossible to judge what the edit did to the *game*,
    which is the entire point of looking.
    The cost is real and Jamie should weigh it: inside a shadow root the panel **cannot use
    the project's Tailwind classes or tokens**, so its styling is written by hand and will not
    follow the app's own look. The alternative — a scoped class prefix and hard-coded values,
    no shadow root — is quicker to write and looks more native, but inherited properties still
    reach it, so the failure it is meant to prevent is only made less likely, not impossible.

65. **Item 64 settled: seal it.** The panel renders in a shadow root with hand-written CSS and
    Jamie's edits cannot reach it. (settled — Jamie 2026-08-18)

66. **The back gesture undoes an edit.** Jamie 2026-08-18: "log changes to history so back
    button undoes. If I ever accidentally fuck anything I can use back button to undo." Each
    committed change pushes a history entry; going back applies its inverse. The panel keeps
    its undo button too — back is the gesture, the button is the visible affordance.
    (settled — Jamie)

67. **This collides with the game's router, and getting it wrong destroys edits rather than
    undoing them.** `src/router.ts:199` listens for `popstate` and re-renders the screen. A
    re-render rebuilds DOM, which would throw away exactly the class changes back was supposed
    to step through — the failure is silent and looks like "back wipes everything". So while
    edit mode is on, **edit mode owns back**, intercepting it before the router in the same
    way and for the same reason it already intercepts taps. Leaving edit mode hands it back.
    The plan must establish *how* that interception is guaranteed given the router registers
    its listener at boot, and §11 needs a positive test: back undoes one step and the screen
    does not re-render. (established — needs a mechanism decided in planning)

68. **One entry per settled change, not per increment.** Holding `+` on a stepper walks the
    scale; each tap should not become its own history entry, or backing out of a ten-tap
    adjustment takes ten swipes. Rapid steps on the same property collapse into one entry once
    they stop. (assumed)

69. **What does back do when there is nothing left to undo?**
    My rec: **it leaves edit mode and returns to play mode, and one more back leaves the page
    as normal.** Why: back always doing *something* is the expectation on a phone, and
    "exit the tool" is the natural next step outwards. The alternative is to swallow it so the
    page never escapes mid-edit, which is safer against accidental exits but means back
    silently does nothing, which reads as broken.

70. **Item 69 settled: back out.** Once every edit is undone, back returns to play mode; one
    more back leaves the page as normal. (settled — Jamie 2026-08-18)

---

## 8. Copy & wording
Settled: Jamie 2026-08-18 (accepted all recommendations) · Ack: pending (Dave)

The only reader is Jamie, so the register is terse. Two moments earn full sentences because
getting them wrong loses work.

71. **Controls.** Pencil button announces "Edit mode" and "Exit edit mode". Panel footer:
    **Undo**, **Reset element**, **Done**. Search placeholder: "Search classes". (assumed)

72. **Search finds nothing.** Not a bare "no results" — the design treats the edge of the
    scale as information, so it says so: *"Nothing on the scale matches. Describe what you
    want in words instead."* (assumed — it turns a dead end into the intended next step)

73. **A class was overwritten by the game.** The item 37 flag needs to be visible, not just
    recorded in the file: *"The game reset this class after your change. It is set in code, so
    the bot will need to change a condition rather than a class."* (assumed)

74. **Done could not reach the server.** This is the one that loses work, so it is explicit
    about the fact that nothing is lost yet: *"Could not save. Your changes are still here —
    check the dev server is running and tap Done again."* (assumed — follows from item 54,
    the edit lives on the phone until Done succeeds)

75. **What happens after Done succeeds?**
    My rec: **confirm, name the next step, and stay in edit mode.** Something like *"Saved.
    Tap /fold in Telegram to turn this into a pull request."* Why: Done is the seam between
    the two halves of this system, and the second half is a command in a different app that
    nothing on screen would otherwise mention. Staying in edit mode matters because a session
    is often "save what I have, keep going" rather than "I am finished". The alternative —
    close the panel and drop to play mode — reads as more final than it is, and makes a
    second round of edits start from scratch.

---

## 9. Accessibility
Settled: Jamie 2026-08-18 (owner's call) · Ack: n/a (owned section)

76. **Edit mode must not damage the game's accessibility, in either direction.** It intercepts
    pointer events at the document level and suspends `shortcuts.ts`; if the teardown is
    incomplete, play mode comes back with keyboard control quietly broken and nothing says so.
    §11 tests the restore, not just the intercept. (assumed — non-negotiable whatever else is
    decided)

77. **The overlay is inert in play mode** — not merely invisible, but not reachable by
    keyboard and not announced by a screen reader, apart from the pencil button itself.
    (assumed)

78. **Focus is never trapped.** The bottom sheet takes focus while open and gives it back; the
    Escape key and the back gesture both leave. (assumed — a dev tool that traps focus is
    unrecoverable without closing the tab)

79. **The shadow root must not disturb the page's own structure** — no extra landmarks, no
    heading levels injected into the game's outline. (assumed)

80. **What accessibility bar does the tool itself hold to?**
    My rec: **"does not break the game, is operable by keyboard on desktop, and is not audited
    further."** Why: edit mode never reaches a player, so its own contrast and semantics are
    not a product obligation, and item 64's sealed shadow root means its colours are
    hand-written and outside the palette guarantees the project relies on — auditing it would
    mean maintaining a second contrast story for a tool one person uses.
    The honest cost of that: Jamie is the person who uses it, and if the panel is hard to read
    on a bright day, that is a real problem for the one user it has. The alternative is to
    hold it to the same AA bar as the game, which is maybe half a day of work and a second set
    of contrast tests to keep passing forever.
    **This is Jamie's to decide and it blocks the section.**

81. **Item 80 settled — Jamie 2026-08-18: "Only me using it. No accessibility needs.
    Prioritise simplicity of code and testing."** The overlay is not audited, not held to AA,
    and items 77-79 drop from requirements to "if it falls out for free". **Item 76 stands
    and is not part of that concession**, because it is about the *game's* accessibility, not
    the tool's: leaving play mode with keyboard control broken is a defect in the shipped
    product, and it fails silently.

82. **"Prioritise simplicity of code and testing" is a standing instruction, not a §9
    footnote.** It applies to every section below and to planning. Where two designs both
    work, the simpler one wins even if it does less. (settled — Jamie 2026-08-18)

---

## 10. Analytics
Settled: Jamie 2026-08-18 (n/a, no objection) · Ack: n/a

83. **None.** Edit mode never reaches a player, never reaches production, and has one user who
    is in the room. There is no question about it that a number would answer. Marked n/a with
    that reason, and consistent with item 82. (assumed)

---

## 11. Done / test plan
Settled: Jamie 2026-08-18 · Ack: pending (Dave)

84. **The existing end-to-end suite structurally cannot test edit mode, and that is a
    feature.** `playwright.config.ts` builds the app and serves the *built* output
    (`npm run e2e:serve`, `reuseExistingServer: false`). Edit mode is absent from that build
    by design, so the suite as it stands can prove edit mode is **gone** and can never prove
    it **works**. Both halves of that matter. (established — read from the config)

85. **So the split, chosen for item 82's simplicity:** put the logic in plain functions tested
    in vitest, and add **one** Playwright project pointed at the dev server for the few things
    only a browser can settle.

    **vitest — cheap, fast, most of the value:**
    - the replace map: same-family replacement happens; appending `mt-6` to `mt-4` would have
      been a no-op and the overlay does not do it; padding shorthand and axis coexist (item 40)
    - text size against text colour, and border width against border colour (item 43)
    - the catalogue holds every spacing step and all six component classes
    - a patch round-trips to JSON and back with the before-class list intact
    - replay applies every unconsumed session in timestamp order, not just the newest (item 51)

    **Playwright against the dev server — only what needs a real browser:**
    - back undoes one step **and the screen does not re-render** (item 67 — the silent one)
    - play mode restores taps and keyboard after edit mode (item 76 — the other silent one)
    - a POST to the read-only port is refused (item 26, asserted positively)

    **Playwright against the built output, in the existing suite:**
    - no overlay code, no middleware, no edit-mode stylesheet, no edit-mode-only utility, in
      **production and preprod** builds alike (items 7 and 59)

86. **Every one of these is reverted and watched go red** before it counts, per the project
    rule. A test that passes without its fix pins nothing. (assumed)

87. **Done means:** Jamie opens the dev server on his phone, taps the pencil, changes a class,
    sees it apply, taps Done, and `.edit-sessions/<timestamp>.json` is on disk with the before
    and after class lists and the viewport width in it. Plus the iPhone measurement from item
    46, which decides whether the on-demand half gets built at all.

88. **Is one new Playwright project acceptable, or should the browser half be cut entirely?**
    My rec: **keep the three browser tests.** Why: all three cover failures that are invisible
    when they happen — back wiping edits, keyboard staying broken after play mode returns, and
    a read-only port that quietly is not. Item 82 says prefer simplicity, and these are the
    three where simplicity would cost real safety. The cost is a second Playwright project
    with a different web server command, and CI time.

89. **Item 88 settled — Jamie 2026-08-18: "Cut. I will be the tester."** No second Playwright
    project. The automated suite is the vitest list in item 85 plus the built-artefact
    assertions, both of which run in CI as now.

90. **The three cut tests become a written acceptance checklist Jamie runs once, by hand.**
    They are not dropped, because two of them cannot be caught by using the tool normally.
    Recorded here so they survive the context clear:

    1. **Back undoes one step and does not wipe the page.** Make three changes, press back
       three times, check each one reverses in turn and the screen does not reload.
    2. **Play mode comes back intact.** Leave edit mode, then play the game with a keyboard on
       desktop — arrow keys, digit entry, submit. This is the one that fails silently, and it
       is a defect in the shipped game, not in the tool (item 76).
    3. **The public link cannot write.** Open the tunnel URL, make a change, tap Done, and
       confirm it is refused. **This one cannot be found by normal use** — a broken write guard
       looks exactly like a working one from Jamie's side, because his own saves come in over
       Tailscale and succeed either way.

91. **Consequence, recorded rather than argued.** With no browser regression test, the three
    above are verified once and then only by whoever happens to notice. Item 90.3 in particular
    will not resurface on its own if a later change breaks it. Jamie's call, made knowing that;
    the cost is a real one and it is written here so a future reader knows it was chosen, not
    overlooked.

---

## Sign-off

| Section | Settled | Ack |
|---|---|---|
| 1. What it is | Jamie 2026-08-18 | Dave 2026-08-19 |
| 2. Out of scope | Jamie 2026-08-18 | Dave 2026-08-19 |
| 3. How it works | Jamie 2026-08-18 | Dave 2026-08-19 |
| 4. Maths | n/a, nothing touched | Dave 2026-08-19 (owner confirmed n/a) |
| 5. State & persistence | Jamie 2026-08-18 | Dave 2026-08-19 |
| 6. How it fits | Jamie 2026-08-18 | Dave 2026-08-19 |
| 7. How it looks | Jamie 2026-08-18 | Dave 2026-08-19 |
| 8. Copy & wording | Jamie 2026-08-18 | Dave 2026-08-19 |
| 9. Accessibility | Jamie 2026-08-18 (owner) | n/a |
| 10. Analytics | n/a, none | n/a |
| 11. Done / test plan | Jamie 2026-08-18 | Dave 2026-08-19 |

**Dave acked every joint section on 2026-08-19**, after a plain-language summary of what the
tool is, that he gets a read-only link showing only saved work, that nothing about
clumeral.com changes, that maths is untouched, that the tool itself gets no accessibility
work, and that testing is Jamie by hand. He confirmed §4 as n/a as its owner.

---

# da-brief review, 2026-08-18 — findings and fixes

Fresh-context review of this file. Five High, twelve Medium, five Low. Items 92-113 below are
the fixes. Numbers stay append-only, so the original items stand as written and are corrected
here rather than edited in place.

## H2 — "unconsumed" was undefined, and it is the cross-repo interface

92. **`/fold` renames; the game reads only bare `.json`.** When `/fold` has taken a session it
    renames `<ts>.json` to `<ts>.json.folded`. Replay (item 51) reads `*.json` and ignores
    `*.json.folded`. Item 50 stands unchanged — we still never delete a session we did not
    write. Without this the two items contradict: replaying everything forever re-applies
    patches on top of source that already carries them, which for a stepper walk compounds
    invisibly, and replaying nothing makes Dave's entire route deliver an unedited page.
    This is a **contract with `pi-dev-bot`** and goes in the schema below, not just here.

## H3 — the session file schema, which is this brief's stated deliverable

93. **The contract.** `/fold` is written against this and nothing else. One file per Done.

    ```json
    {
      "version": 1,
      "createdAt": "2026-08-18T23:41:07.221Z",
      "branch": "dev/edit-mode-roundtrip",
      "sha": "2896500c1d0e...",
      "viewport": { "width": 402, "height": 874, "dpr": 3 },
      "theme": { "mode": "dark", "name": "Lime" },
      "patches": [ { "...": "see 94-96" } ]
    }
    ```

    `branch` and `sha` are the fix for a failure nobody had noticed: `/fold` locates elements
    by grepping the before-class string, so if the tree moves between Done and `/fold` the
    grep silently finds nothing, or finds the wrong element. `viewport` is item 41. `theme` is
    finding M6 — an edit made in dark mode changes light mode too, invisibly, and `/fold`
    currently receives no indication which one Jamie was looking at when he judged it right.
    `version` is there so the other repo can refuse a file it does not understand.

94. **Patch kind `classes`** — the ordinary case.

    ```json
    { "kind": "classes",
      "breadcrumb": "main > .card > .row > button",
      "tag": "button",
      "text": "Submit",
      "before": ["rounded-lg", "bg-bg", "px-4", "mt-4"],
      "after":  ["rounded-lg", "bg-bg", "px-4", "mt-6"],
      "flags": ["runtime-controlled"] }
    ```

95. **Patch kind `css`** — the desktop free-CSS box (item 15, which said the file must carry
    more than one kind of patch and then never resolved it).

    ```json
    { "kind": "css",
      "breadcrumb": "main > .card", "tag": "div", "text": "",
      "declarations": "margin-top: 1rem;",
      "note": "not applied literally - the bot converts it" }
    ```

96. **Patch kind `raw`** — the desktop raw class field, where Jamie typed a string rather than
    picking from search. Same shape as `classes`, plus `"typed": "<what he typed>"`, because
    what he typed may not be a class the build contains (see item 99).

97. **Item 87's Done criterion is corrected** to require all three patch kinds and the
    round-trip test in item 85 to cover all three. As written, §11 could go green with the
    free-CSS box entirely unbuilt.

## H4 and M3 — classes that do not exist in the build, and fail silently

98. **The stylesheet is a closed set, and the brief never said so.** All three measured options
    in item 44 are base utilities with **no variants at all** — `md:mt-4` and `dark:bg-accent`
    are not in any of them. But item 35 has search offering `md:mt-4`, because the catalogue
    can compose it from `getVariants()`. So Jamie taps a chip and nothing moves. That is
    exactly the "the tap looks broken" failure item 38 exists to prevent, arriving by a
    different door.

99. **Two fixes, both cheap.**
    - **Search offers only what the current stylesheet actually contains.** The catalogue is
      filtered against the built set, not composed freely. No variants are offered unless the
      on-demand half exists.
    - **The overlay checks the class did something.** After applying, compare computed style
      before and after; if nothing changed, say so: *"That class is not in this build."* This
      also covers the raw class field and any typo, which search cannot protect.
    §8 gains that message. This is the general property the brief never stated and it needs
    stating: **anything outside the built set fails silently unless we look.**

## H5 and M1 — the safety assertion cannot use a sentinel class

100. **A named sentinel fails the moment it is named.** `mt-11` is in production *today*,
     because the spike note writes it in prose and Tailwind scans markdown. Pick a fresh
     sentinel, write it in the plan, commit the plan on the branch, and it ships too. The
     assertion eats itself.

101. **Assert the general property instead:** every class selector in the built stylesheet
     must appear literally in `src/` or `index.html`. That is one assertion, it needs no
     sentinel, it cannot be defeated by writing a class name in a document, and it catches
     an edit-mode leak and issue #312's leak with the same test.

102. **This branch has made #312 measurably worse and it is recorded, not argued.** Production
     CSS was 50,555 bytes before the spike note; it is 51,143 now. Eighteen classes exist in
     the production stylesheet solely because they appear in prose — including `row-7447`,
     which is a table row number from the spike note. Item 12 keeps #312 out of scope, so this
     work accepts ~0.6 kB of dead CSS and the plan file will add a little more. Item 101's
     assertion cannot be switched on until #312 is fixed, so it lands **red** and is the first
     thing #312's branch turns green.

## M4 — Dave gets a pencil button that can never work

103. **The read-only origin serves the overlay in replay-only mode: no pencil, no panel.**
     Otherwise Dave edits, taps Done, and receives item 74's message — *"check the dev server
     is running and tap Done again"* — which is wrong in every particular and tells him to
     retry forever. The one message written carefully because it loses work is the one the
     wrong person sees.

## M5 — back after returning to play mode

104. **Edit mode keeps owning back until its own entries are exhausted, even in play mode.**
     Item 30 makes flipping to play mode normal — that is how a change gets tried in use. If
     back is handed straight back to the router at that moment, the first press re-renders the
     screen and destroys every edit. So the interception outlives the mode, and only lifts
     when the last edit entry has been popped.

105. **The undo stack persists alongside the patch set** (item 52). They are different objects
     and only one was covered: after a reload the browser still holds the pushed history
     entries, and without the inverses the overlay cannot honour them.

## M7 — the dev stylesheet is served uncompressed

106. **Gzip it in the dev server.** The design named two costs planning must carry; this brief
     carried the phone-parse one into items 45-47 and left this one in a subordinate clause.
     At 1.16 MB per page load over Tailscale to a phone it is, in the design's own words, the
     dominant cost of edit mode, and it is a few lines.

## M8 — the read-only proxy has no home

107. **It is part of edit mode's dev tooling and starts with the dev server**, not a separate
     thing anyone has to remember. §6's "new files plus a Vite plugin" (item 55) is corrected:
     there is also a second listener, started and stopped by the same plugin, and it refuses
     anything that is not GET or HEAD. If the dev server is not up it serves 503 rather than
     failing to start.

## M9 — two paths are asserted gitignored and neither is

108. **Adding `.edit-sessions/` and the generated class list to `.gitignore` is a task, not an
     assumption.** Item 59 already spells out the consequence of forgetting: 386 kB of class
     names committed is #312's failure mode at full volume, with every class in the project
     landing in the production stylesheet. Item 101's assertion catches it.

## M10 — the runtime-class detector may be unable to fire

109. **Give it a stated observation window.** Item 30 stops the game rendering while edit mode
     is on, so a class the game would reset on its next render never gets reset, and item 37's
     detector never fires for the `.hidden` game-state case — the case it was written for.
     The check therefore runs **across a play-mode round trip**: on returning from play mode
     the overlay re-reads the class lists of every edited element and flags what moved. That
     is the only moment the game has actually rendered.

## M11 — the six component classes

110. **Hand-listed in the generator, not converted to `@utility`.** The spike preferred
     converting, but that edits `src/tailwind.css`, which item 55 forbids and which is the file
     that produces the production stylesheet. Six strings in a dev-only generator is the
     simpler thing and it touches nothing that ships (item 82).

## M2 and M12 — scope, and four recommendations recorded as settled without an answer

111. **Four items were written as "My rec:" and then counted as settled with no reply
     recorded.** Correcting that rather than leaving it: **items 26** (the second port — the
     mechanism the whole read-only guarantee rests on), **27** (test it as a positive),
     **29** (the tunnel, including a `dev.clumeral.com` record on the production zone), and
     **32** (the selection label drops the source location, which *contradicts the approved
     design*). Item 16 shows the right handling — recommend, get an answer, reopen if the
     answer differs. These four need a word.

112. **The on-demand half's scope is genuinely unresolved.** Item 4 says the deliverable is
     Units 1-4; item 47 makes the on-demand rebuild conditional on a measurement that happens
     *during* the build; item 87 puts that measurement inside Done. So the plan cannot know its
     own scope. And if the answer turns out to be "we need it", it arrives with no §7 (what is
     on screen during a 0.3-1.9 s rebuild), no §8 (no "rebuilding" and no "rebuild failed"
     copy) and no §11.
     My rec: **out of scope for this brief.** Build the pre-built stylesheet, Jamie measures on
     the iPhone, and if it struggles the on-demand half gets its own short brief with the
     three sections it needs. Consequence, stated plainly: **no variants and no colours in edit
     mode until then** if the non-colour line is taken — item 99 makes that visible rather than
     silent.

## Low findings

113. **Fixed in passing:** item 44's figures came from a script run on 2026-08-18 against
     `getClassList()` and the compiler, and the table used MiB while the spike note used MB —
     4.99 MiB and 5.24 MB are the same number (L1). "Position" in item 44's family list is not
     one of the design's four stepper families and is dropped. Production and preprod are one
     artefact, so item 7's assertion is written once, not twice (L2). `sessionStorage` is keyed
     to a branch name the plugin injects, since the browser cannot know it (L3). Item 26's
     header-sniffing fallback is **rejected outright** rather than called "weaker" — if a
     `cloudflared` change stops setting the header the guard silently stops guarding, and item
     91 says nothing would notice (L4). `dev.clumeral.com` is a new record on the production
     zone pointing at a home Pi; it is unrelated to the `workers.dev` pre-prod decision in
     CLAUDE.md, and that doc should say so when this lands (L5).

## Still open

- **H1 — the brief cannot close.** Eight sections read `Ack: pending (Dave)`, and §4 (maths)
  is Dave's own section marked n/a in his absence. Either Dave acks, or Jamie records an
  override as dev lead. Silence is not consent.
- **Item 111** — four recommendations need a yes or a different answer.
- **Item 112** — the on-demand scope boundary.

## Closing state, 2026-08-19

114. **Item 112 settled — Jamie 2026-08-19: "Yes."** The on-demand half is out of this brief.
     Build the pre-built stylesheet, Jamie measures on the iPhone 16 Pro, and if it struggles
     the on-demand half gets its own short brief carrying the §7, §8 and §11 it would need.
     Until then edit mode offers no colours and no responsive variants, and item 99 makes that
     visible rather than silent.

115. **Item 111 is the only thing still open.** Four recommendations were recorded as settled
     with no answer on record, and the brief's own standard says silence is not consent:

     - **26** — the tunnel points at a second port with no write handler, rather than the
       server sniffing headers. This is the mechanism the entire read-only guarantee rests on.
     - **27** — that guard is tested as a positive: a POST to the read-only port is refused,
       and the test goes red when the guard is removed.
     - **29** — `cloudflared` rather than nginx and a DNS record, optionally with a
       `dev.clumeral.com` record on the production zone.
     - **32** — the selection label shows the tag, the breadcrumb and the first few words of
       text, and **not** the source location. This one **contradicts the approved design**,
       which specifies a source location; nothing in the browser can know it now that
       build-time stamping is rejected.

     **Approved by Jamie, 2026-08-19: "All approved."** Items 26, 27, 29 and 32 stand as
     written, including item 32's departure from the approved design — the selection label
     carries no source location, because nothing in the browser can know one.

116. **The brief is closed.** 2026-08-19. All eleven sections settled by Jamie, all joint
     sections acked by Dave, §4 confirmed n/a by its owner, and every Medium-and-above finding
     from the da-brief review either fixed in items 92-113 or settled in 114-115.

     **What planning inherits, in one place:**
     - Units 1-4, dev server only. Nothing reaches production or preprod (items 6, 7).
     - Pre-built non-colour stylesheet, ~1.16 MB. **No on-demand half** — Jamie measures it on
       the iPhone and it gets its own brief if needed (items 44, 114).
     - **No colours and no variants offered**, and anything outside the built set is caught and
       reported rather than failing silently (item 99).
     - The session file schema in items 93-96 is a **contract with `pi-dev-bot`** and is the
       one thing the plan must not paraphrase.
     - `/fold` renames a consumed session; the game reads only bare `.json` (item 92).
     - The safety assertion is "every class in the built stylesheet appears in `src/` or
       `index.html`" — no sentinel — and it **lands red until #312 is fixed** (items 101, 102).
     - Simplicity is the tie-break, and Jamie is the tester (items 82, 89, 90).
