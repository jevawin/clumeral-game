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
Settled: pending · Ack: pending

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
