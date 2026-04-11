# External Integrations

**Analysis Date:** 2026-04-11

## APIs & External Services

**Feedback Submission:**
- Google Forms API (Google Sheets-backed form submission)
  - Endpoint: `https://script.google.com/macros/s/AKfycbxSnk8QFvjnh9Bmk0kv6I7xacnvDvcw_lgM_gBF6TzvPtqNvAlnxM7UJi-sjMku8bSQKw/exec`
  - Use: Collects user feedback via modal form
  - Integration point: `src/modals.ts` (POST request, CORS-enabled)
  - Payload: form category, message text, puzzle metadata (date, number)

**Analytics Engine (Cloudflare):**
- Purpose: Query analytics data for /stats dashboard
- SDK/Client: Native fetch to Cloudflare API
- Auth: `CF_API_TOKEN` (Bearer token)
- Endpoint: `https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/analytics_engine/sql`
- Integration point: `src/worker/stats.ts`
- Use case: SQL queries on puzzle_start, puzzle_complete, incorrect_guess, and other events

## Data Storage

**Databases:**
- Cloudflare KV (key-value store)
  - Binding: `PUZZLES` (configured in `wrangler.jsonc`)
  - ID: `d07cfc9a455943e3839967475925a468`
  - Purpose: Cache daily puzzles by date string (YYYY-MM-DD)
  - Stored data: `{ answer: number; clues: ClueData[]; puzzleNumber: number }`
  - TTL: Indefinite (no expiration set)
  - Integration point: `src/worker/index.ts` (getDailyPuzzle function)

**File Storage:**
- Local filesystem only (static assets served via Cloudflare ASSETS binding)
- Assets directory: `public/` (icons, sprites, manifest, Service Worker)

**Client-Side Storage:**
- localStorage (browser storage)
  - Keys: `dlng_history` (game history), `dlng_prefs` (user preferences), `dlng_theme` (light/dark)
  - Purpose: Persist user's game history and settings locally
  - Integration point: `src/storage.ts`, `src/theme.ts`

**Caching:**
- Cloudflare Cache API (HTTP caching via Headers)
  - `/stats` and `/api/stats` endpoints: `Cache-Control: max-age=300` (5 minutes)
  - Puzzle pages: Default caching rules

## Authentication & Identity

**Auth Provider:**
- Custom (no external auth service)

**Approach:**
- Random puzzles signed with HMAC-SHA256 token
- Token structure: AES-GCM encrypted seed + IV
- Secret: `HMAC_SECRET` environment variable
- Implementation: `src/worker/crypto.ts` (signToken, verifyToken)
- Client never sees seed or answer for random puzzles; token is opaque

## Monitoring & Observability

**Error Tracking:**
- Not integrated (no Sentry, Rollbar, etc.)
- Manual error handling only

**Logs:**
- Cloudflare Worker logs (available in Cloudflare Dashboard)
- Server-side errors returned as plain text or JSON responses
- No structured logging service

**Analytics:**
- Cloudflare Analytics Engine
  - Dataset: `clumeral` (configured in `wrangler.jsonc`)
  - Binding: `ANALYTICS`
  - Events tracked: puzzle_start, puzzle_complete, incorrect_guess, htp_opened, htp_dismissed, feedback_submitted, theme_toggle, colour_change, tooltip_opened
  - Integration point: `src/worker/index.ts` (POST /api/event)
  - Data written via `env.ANALYTICS.writeDataPoint()` with indexed/blob/double fields

## CI/CD & Deployment

**Hosting:**
- Cloudflare Pages (primary)
- Cloudflare Workers (API backend)

**CI Pipeline:**
- GitHub Actions (implicit, configured in Cloudflare Pages settings)
- Trigger: Push to `main` branch
- Build command: `npm run build`
- Deployment: Automatic to `https://clumeral.com`

**Repository:**
- GitHub: https://github.com/jevawin/clumeral-game

## Environment Configuration

**Required env vars (Worker Secrets):**
- `HMAC_SECRET` - Secret key for HMAC token signing (random puzzle authentication)
- `CF_ACCOUNT_ID` - Cloudflare Account ID for Analytics Engine queries
- `CF_API_TOKEN` - Cloudflare API token (with analytics read permission)

**Note:** Environment variables are not stored in .env files. Secrets are managed via Cloudflare Workers Secret management in the dashboard or wrangler CLI.

## Webhooks & Callbacks

**Incoming:**
- POST `/api/event` - Analytics event collection from client
- POST `/api/guess` - Game guess submission for validation
- POST `/api/event` (feedback) - User feedback submission forwarded to Google Forms

**Outgoing:**
- GET requests to Google Forms API (one-way feedback submission)
- GET requests to Cloudflare Analytics Engine API (dashboard queries only)

## Cron Jobs

**Scheduled Tasks:**
- Daily cron: `0 0 * * *` (midnight UTC)
  - Purpose: Pre-generate today's puzzle to warm up KV cache
  - Trigger: Cloudflare Workers scheduled event
  - Integration point: `src/worker/index.ts` (scheduled handler)

---

*Integration audit: 2026-04-11*
