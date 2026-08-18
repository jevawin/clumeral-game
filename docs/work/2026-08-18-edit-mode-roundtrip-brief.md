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
Settled: pending Jamie's confirmation of items 24-29 · Ack: pending (Dave)
