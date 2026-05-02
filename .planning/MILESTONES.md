# Milestones

## v1.0 Clumeral Redesign (Shipped: 2026-05-02)

**Phases completed:** 9 phases, 12 plans, 24 tasks

**Key accomplishments:**

- Tailwind v4 with 6 semantic colour tokens, three-screen state machine with View Transition API cross-fade, and simplified footer
- Welcome screen with logo, 96px decorative octopus, subtitle, puzzle number, 3-step HTP instructions, and Play button with first-visit/return-visit layout switching
- Complete game screen HTML markup with sticky header, hamburger menu dropdown, skeleton clue loaders, digit boxes, keypad, submit, and all post-game elements — old puzzle card and footer links removed
- Tailwind render functions, exported toggleTheme, and initMenu() make the game screen fully playable — clues, digit elimination, guess submission, feedback, history, stats, and hamburger menu all functional
- Tailwind feedback modal with fade+scale animation, category pills, character counter, and bottom-centre toast
- Compressed octopus celebration from ~6s to ~2.6s with skip-on-tap and onComplete callback, bubble canvas shortened to 3.2s
- Completion screen markup, stats computation module, and correct-answer handler wired to show celebration then cross-fade to completion
- Deleted style.css, converted all BEM wrapper classes to Tailwind utilities, fixed dark mode cascade bug and save score checkbox visibility
- Dead-code removal pass: letter-reveal system deleted, duplicate welcome h1 removed, four unused sprite icons pruned, tailwind.css component classes audited and documented — delivered via direct commit 2e13e2b on 2026-04-21, artifacts authored retroactively 2026-05-02.
- Game header label, replay routing, and modals dead-query removal — closes v1.0 audit gaps GAM-01, GAM-06, FBK-01.
- Retroactive GSD artifacts (SUMMARY, VERIFICATION, VALIDATION) authored for Phase 7 from commit 2e13e2b evidence + v1.0 audit observations; SIMP-01 finalised in REQUIREMENTS.md traceability table — closes the "Phase 7 unverified" v1.0 audit gap with zero source-code changes.

---
