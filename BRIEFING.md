# Clumeral — Project Briefing for Claude Code

This document gives Claude Code full context to set up `chief-clancy` and build
the automation layer for the Clumeral project. Read this entire file before
doing anything else.

---

## What we're building

A two-layer system:

1. **Clancy** (`chief-clancy`) — an npm tool that connects Claude Code to a GitHub
   Issues Kanban board, plans tickets, and implements them autonomously.
   Must be set up and validated manually (Phase 1) before any automation is built.

2. **The automation layer** — a Telegram bot + cron jobs that replace the manual
   steps of creating tickets, triggering clancy commands, and checking GitHub for
   updates. Built in Phase 2 only, after Phase 1 is working.

---

## Repo context

- **Project:** Clumeral (clumeral.com) — a web app built by Jamie with Claude Code
- **GitHub repo:** jevawin/clumeral-game
- **Pi 5 user:** jevawin
- **Single working directory:** ~/clumeral-game — app, clancy, and bot all live here
- **Repo is public** — intentional experiment in documented, fully automated AI
  development. Do NOT commit any secrets. All credentials go in .env files that
  are gitignored.
- **Cloudflare Pages:** already configured, project "clumeral-game", dev and staging
  branch deploy aliases exist
- **Tailscale:** installed and running on the Pi 5

---

## Hardware context (Pi 5)

- Raspberry Pi 5 Model B, 4GB RAM, aarch64, Debian Bookworm
- Currently running: Jellyfin, Sonarr, Radarr, Prowlarr, SABnzbd, qBittorrent,
  Docker, Samba, Tailscale
- Memory at rest: ~1.9GB used, 871MB swap in use, ~2.1GB available
- CPU at rest: ~99% idle
- Hard constraint: never run multiple Claude Code / clancy instances simultaneously.
  The cron runner must use a lock file to prevent this.

---

## The Kanban label flow

| Label   | Set by                    | Triggers              | Result                                                   |
|---------|---------------------------|-----------------------|----------------------------------------------------------|
| ideas   | Human (Telegram or manual)| Nothing automated     | Waiting for human to label as 'plan'                     |
| plan    | Human (Telegram or manual)| Cron -> /plan         | Clancy posts structured plan as issue comment            |
| approve | Human (Telegram or manual)| Cron -> /approve      | Clancy promotes plan comment -> ticket description, re-labels 'build' |
| build   | Clancy (after approve)    | Cron -> /run          | Clancy implements, commits, squash merges, opens PR      |
| review  | Clancy (after build)      | Telegram relay notifies | Human reviews PR on GitHub                             |
| done    | Human (after merging PR)  | Nothing               | Ticket closed                                            |

Cron priority order: build > approve > plan > brief (brief = future clancy feature, add when available)

Important: tickets must be assigned to jevawin or clancy will not pick them up.

---

## Clancy command reference

Installed via: npx chief-clancy
Requires: Claude Code CLI, Node.js 22+, git, jq, curl

| Command              | What it does                                                    |
|----------------------|-----------------------------------------------------------------|
| /clancy:init         | Wizard — configure board, labels, credentials, scaffold .clancy/|
| /clancy:map-codebase | 5-agent parallel scan, writes 10 docs to .clancy/docs/          |
| /clancy:plan         | Planner — refines ideas tickets, posts plan as comment          |
| /clancy:plan 3       | Plans up to 3 tickets in batch                                  |
| /clancy:approve      | Planner — promotes plan comment to ticket description           |
| /clancy:once         | Implementer — picks up one ready-to-build ticket, implements    |
| /clancy:run          | Loop mode — runs until queue empty or MAX_ITERATIONS hit        |
| /clancy:dry-run      | Preview next ticket — no changes, no Claude call                |
| /clancy:status       | Show next tickets without running                               |
| /clancy:review       | Score next ticket readiness (0-100%)                            |
| /clancy:doctor       | Test every integration — run this first if anything breaks      |
| /clancy:logs         | Display .clancy/progress.txt                                    |
| /clancy:settings     | View/change config — model, iterations, board, labels           |
| /clancy:update       | Update clancy to latest version                                 |
| /clancy:help         | Command reference                                               |

Planner role is opt-in. Enable it:
  echo 'CLANCY_ROLES="planner"' >> .clancy/.env
  npx chief-clancy@latest --local

Status transitions (add to .clancy/.env):
  CLANCY_STATUS_IN_PROGRESS="build"
  CLANCY_STATUS_DONE="review"

Built-in notifications (add to .clancy/.env):
  CLANCY_NOTIFY_WEBHOOK=https://your-relay-url/notify
  Posts to a webhook on ticket complete or error. Phase 2 will point this at
  a small Flask endpoint that forwards to Telegram.

Runs with --dangerously-skip-permissions — full filesystem and shell access.
Only run on codebases you own.

---

## Prerequisites — install before anything else

Run these as jevawin on the Pi 5. Check each first; install only if missing.

### 1. Node.js 22+ via nvm

  node -v   # need v22 or higher

  If missing or below 22:
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
    source ~/.bashrc
    nvm install 22
    nvm use 22
    nvm alias default 22

  Verify: node -v && npm -v

### 2. GitHub CLI (gh)

  gh --version   # check first

  If missing (Pi 5 is aarch64 — use official Debian package method):
    (type -p wget >/dev/null || (sudo apt update && sudo apt install wget -y)) \
      && sudo mkdir -p -m 755 /etc/apt/keyrings \
      && out=$(mktemp) && wget -nv -O$out https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      && cat $out | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
      && sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
      && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
         | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
      && sudo apt update \
      && sudo apt install gh -y

  Verify: gh --version

  MANUAL STEP — Jamie must complete this interactively:
    gh auth login
    Choose: GitHub.com -> HTTPS -> Yes (authenticate git) -> Login with browser
  Claude Code cannot complete browser-based OAuth. Stop and ask Jamie to run
  this before continuing.

### 3. Git identity

  git --version || sudo apt install git -y

  git config --global user.name    # check if set
  git config --global user.email   # check if set

  If not set — ask Jamie for the correct email, then:
    git config --global user.name "jevawin"
    git config --global user.email "JAMIE_TO_CONFIRM"

### 4. jq and curl

  jq --version 2>/dev/null || sudo apt install jq -y
  curl --version 2>/dev/null || sudo apt install curl -y

### 5. Python 3 + pip + venv

  python3 --version   # need 3.9+
  pip3 --version

  sudo apt install python3 python3-pip python3-venv -y

### 6. Clone the Clumeral repo

  Requires gh auth login to be complete first.

  ls ~/clumeral-game 2>/dev/null || (cd ~ && gh repo clone jevawin/clumeral-game)
  cd ~/clumeral-game

### 7. GitHub PAT

  MANUAL STEP — Jamie must create this at:
  https://github.com/settings/tokens?type=beta

  Create a fine-grained token with:
  - Repository access: jevawin/clumeral-game only
  - Permissions: Issues (read/write), Contents (read/write), Pull requests (read/write)

  Save it — needed during /clancy:init and in bot/.env.

### 8. Telegram bot setup (Phase 2 only — skip during Phase 1)

  MANUAL STEP — Jamie does this before Phase 2 begins:
  1. Telegram -> @BotFather -> /newbot
  2. Name: e.g. "Clumeral Bot" | Username: e.g. clumeral_dev_bot
  3. Save the BOT_TOKEN from BotFather
  4. Create a Telegram group, add bot as admin, add friend
  5. Get CHAT_ID:
     - Send any message in the group
     - Visit https://api.telegram.org/bot<BOT_TOKEN>/getUpdates
     - Find "chat":{"id":...} — the negative number is the CHAT_ID

---

## Phase 1 — Manual clancy setup (DO THIS FIRST)

Goal: clancy working end-to-end manually. Do not start Phase 2 until validated.

Step 1 — Confirm all prerequisites above are done, then:
  cd ~/clumeral-game

Step 2 — Install clancy
  npx chief-clancy
  - Choose local install (./.claude) — scoped to this project
  - Enable the Planner role when asked

Step 3 — Enable Planner role explicitly
  echo 'CLANCY_ROLES="planner"' >> .clancy/.env
  npx chief-clancy@latest --local

Step 4 — Run init inside Claude Code
  /clancy:init
  During the wizard:
  - Board: GitHub Issues
  - Repo: jevawin/clumeral-game
  - GitHub PAT: the fine-grained token from prerequisite 7
  - Labels: map to the flow above (plan, approve, build, review, done)
  - Status transitions: IN_PROGRESS=build, DONE=review

Step 5 — Protect credentials
  Create/update .claude/settings.json:
  {
    "permissions": {
      "deny": [
        "Read(.clancy/.env)",
        "Read(.env)",
        "Read(.env.*)",
        "Read(bot/.env)",
        "Read(**/*.pem)",
        "Read(**/*.key)"
      ]
    }
  }

Step 6 — Scan the codebase
  /clancy:map-codebase
  Writes 10 docs to .clancy/docs/. Takes a few minutes.
  Re-run only when architecture changes significantly.

Step 7 — Run doctor
  /clancy:doctor
  Fix everything it reports before continuing.

Step 8 — Create test tickets on GitHub manually
  Go to github.com/jevawin/clumeral-game/issues
  Create 2-3 small, well-scoped tickets (copy change, minor UI fix)
  Assign each to jevawin
  Label each: ideas

Step 9 — Test the planner
  /clancy:plan
  Clancy picks up an ideas ticket, posts plan as comment on GitHub.
  Review the comment. If happy:
  /clancy:approve
  Then manually change the label to ready-to-build on GitHub.

Step 10 — Test the implementer
  /clancy:dry-run
  /clancy:once
  Review the commit locally. Push manually if satisfied.

Step 11 — Repeat for 2-3 tickets until output quality is acceptable.

Step 12 — Validate notify webhook
  Set CLANCY_NOTIFY_WEBHOOK=https://webhook.site/YOUR-UUID in .clancy/.env
  Run a ticket, confirm clancy POSTs on completion. Note what the payload looks
  like — Phase 2 will use this.

---

## Phase 2 — Automation layer

Goal: replace all manual steps with Telegram bot + cron jobs.
Location: ~/clumeral-game/bot/ — inside the repo, secrets gitignored.

Before building anything, update .gitignore:
  echo "bot/.env" >> .gitignore
  echo "bot/.venv/" >> .gitignore
  echo "bot/logs/" >> .gitignore
  echo "bot/.relay-state" >> .gitignore
  git add .gitignore && git commit -m "chore: gitignore bot secrets and logs"

--- Component 1: bot/bot.py — Telegram bot ---

Runs as a systemd service. Uses python-telegram-bot library.

Slash commands to implement:

| Command           | Action                                              |
|-------------------|-----------------------------------------------------|
| /idea <desc>      | Create GitHub issue, label ideas, assign to jevawin |
| /plan #n          | Change issue label to plan                          |
| /approve #n       | Change issue label to approve                       |
| /build #n         | Change issue label to ready-to-build                |
| /status           | List open issues grouped by label                   |
| /review #n        | Post PR link for that ticket                        |
| /done #n          | Close issue, set label done                         |

The bot only calls the GitHub API. It never invokes clancy — that is the cron's job.

Environment variables (bot/.env — never commit):
  TELEGRAM_BOT_TOKEN=...
  TELEGRAM_CHAT_ID=...
  GITHUB_TOKEN=...
  GITHUB_REPO=jevawin/clumeral-game

Python dependencies (bot/requirements.txt):
  python-telegram-bot==20.*
  requests
  python-dotenv

Venv setup:
  cd ~/clumeral-game/bot
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt

Systemd service (/etc/systemd/system/clumeral-bot.service):
  [Unit]
  Description=Clumeral Telegram Bot
  After=network.target

  [Service]
  Type=simple
  User=jevawin
  WorkingDirectory=/home/jevawin/clumeral-game/bot
  ExecStart=/home/jevawin/clumeral-game/bot/.venv/bin/python bot.py
  Restart=on-failure
  RestartSec=10

  [Install]
  WantedBy=multi-user.target

Enable:
  sudo systemctl daemon-reload
  sudo systemctl enable clumeral-bot
  sudo systemctl start clumeral-bot

--- Component 2: bot/clancy-runner.sh — Resource-aware cron trigger ---

Runs every 5 minutes. One ticket per tick. Priority: build > approve > plan > brief (add brief when clancy supports it).

Logic:
  1. Lock file check — exit if claude/node already running
  2. Memory check — exit if available < 500MB
  3. Query GitHub API for qualifying tickets in priority order:
     - Label 'build'   → echo "/run" | claude --dangerously-skip-permissions
     - Label 'approve' → echo "/approve" | claude --dangerously-skip-permissions
     - Label 'plan'    → echo "/plan" | claude --dangerously-skip-permissions
     - Label 'brief'   → echo "/brief" | claude --dangerously-skip-permissions (future)
  4. Release lock, exit

Lock:
  LOCKFILE=/tmp/clancy.lock
  if [ -f "$LOCKFILE" ]; then echo "$(date): already running, skipping" && exit 0; fi
  trap "rm -f $LOCKFILE" EXIT INT TERM
  touch $LOCKFILE

Memory check:
  AVAILABLE=$(awk '/MemAvailable/ {print $2}' /proc/meminfo)
  if [ "$AVAILABLE" -lt 512000 ]; then echo "$(date): memory pressure, skipping" && exit 0; fi

Invoking clancy non-interactively (VERIFY this works in Phase 1 step 10 first):
  cd /home/jevawin/clumeral-game
  echo "/clancy:once" | claude --dangerously-skip-permissions

Crontab entry:
  */5 * * * * /home/jevawin/clumeral-game/bot/clancy-runner.sh >> /home/jevawin/clumeral-game/bot/logs/runner.log 2>&1

--- Component 3: bot/relay.py — GitHub -> Telegram poller ---

Runs every 5 minutes via cron. Polls GitHub for new clancy comments and PRs.

Logic:
  1. Read last-seen timestamp from bot/.relay-state
  2. Query GitHub API: issue comments newer than timestamp by jevawin
  3. Post each to Telegram: issue title + excerpt + link
  4. Query GitHub API: PRs opened since timestamp
  5. Post each PR: "PR ready for review: #N [title] [link]"
  6. Update .relay-state to now

Crontab entry:
  */5 * * * * /home/jevawin/clumeral-game/bot/.venv/bin/python /home/jevawin/clumeral-game/bot/relay.py >> /home/jevawin/clumeral-game/bot/logs/relay.log 2>&1

--- Component 4: bot/webhook.py — Optional (build last) ---

If CLANCY_NOTIFY_WEBHOOK is confirmed working in Phase 1 step 12, build a small
Flask endpoint to receive clancy's POST and forward to Telegram. Expose via
Cloudflare Tunnel (already configured on this Pi). Optional — relay polling
works fine at this scale.

--- Build order for Phase 2 ---

1. Update .gitignore, commit
2. Create bot/requirements.txt, set up venv
3. Build and test bot/bot.py — create ticket via /idea, verify on GitHub
4. Build and test bot/clancy-runner.sh — place a ready-to-build ticket manually,
   run script directly, confirm clancy triggers
5. Build and test bot/relay.py — post manual comment as jevawin, confirm it
   appears in Telegram within 5 minutes
6. Install crontab entries
7. Set up systemd service for bot.py
8. Full end-to-end: /idea in Telegram -> auto-plan -> approve -> auto-build ->
   PR notification in Telegram

---

## File structure (end state)

  ~/clumeral-game/
    .clancy/
      clancy-once.js
      clancy-afk.js
      docs/                    10 codebase docs from map-codebase
      .env                     clancy credentials (gitignored)
    .claude/
      settings.json            credential deny list
      commands/clancy/         clancy slash commands
    bot/
      bot.py                   Telegram bot (systemd service)
      relay.py                 GitHub -> Telegram poller (cron)
      clancy-runner.sh         clancy cron trigger
      webhook.py               optional Flask notify endpoint
      requirements.txt
      .venv/                   Python venv (gitignored)
      .env                     secrets: Telegram + GitHub tokens (gitignored)
      .relay-state             last-seen timestamp (gitignored)
      logs/
        runner.log
        relay.log
    [app source files]
    .gitignore                 must include: bot/.env, bot/.venv/, bot/logs/,
                               bot/.relay-state, .clancy/.env

---

## Open questions — verify during Phase 1

- Confirm: echo "/clancy:once" | claude --dangerously-skip-permissions works as
  a non-interactive shell invocation (test in Phase 1 step 10)
- Confirm: what does a clancy plan comment look like on GitHub? Does it have a
  detectable marker the cron runner can filter on? Check after Phase 1 step 9.
  If not obvious, ask Alex Clapperton (@Pushedskydiver on GitHub).
- Confirm: CLANCY_NOTIFY_WEBHOOK posts reliably (Phase 1 step 12)
- Jamie to confirm git email address for git config --global user.email

---

## Key decisions (do not relitigate unless something is broken)

- Cron over webhooks: simpler, no persistent listener, no public endpoint needed,
  5-minute latency acceptable
- Telegram over WhatsApp: WhatsApp Baileys violates Meta ToS, ban risk; Telegram
  has an official stable bot API
- Pi 5 over Pi Zero W: Zero W is ARMv6, Node 22 unavailable; Pi 5 has headroom
- Python for bot/relay: lightweight, no Node version conflicts with clancy
- Single ticket per cron tick: prevents concurrent clancy runs under memory pressure
- Single repo: app + clancy + bot all in ~/clumeral-game; secrets gitignored; public repo
- Phase 1 before Phase 2: clancy is early beta — validate manually first
