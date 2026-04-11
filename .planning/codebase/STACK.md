# Technology Stack

**Analysis Date:** 2026-04-11

## Languages

**Primary:**
- TypeScript 6.0.2 - Application logic, both client and worker code
- HTML5 - Game shell and server-rendered pages
- CSS3 - Styling with light/dark themes and accent colour system

**Secondary:**
- JavaScript (ES2022) - Compiled output target

## Runtime

**Environment:**
- Cloudflare Workers - Server-side execution for API routes, puzzle generation, analytics queries, cron jobs
- Web Browsers - Client-side application (ES2022 target)

**Package Manager:**
- npm 10+ (inferred from package-lock.json)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Vite 8.0.3 - Build tool and dev server
- @cloudflare/vite-plugin 1.31.0 - Cloudflare Workers integration for Vite

**Testing:**
- Not detected

**Build/Dev:**
- TypeScript 6.0.2 - Compiler
- @cloudflare/workers-types 4.20260403.1 - Worker type definitions
- wrangler 4.80.0 - Cloudflare CLI for Worker management and local runtime

## Key Dependencies

**Critical:**
- @cloudflare/vite-plugin 1.31.0 - Bridges Vite with Cloudflare Workers build system
- wrangler 4.80.0 - Local Worker runtime (dev environment) and deployment CLI

**Infrastructure:**
- @cloudflare/workers-types 4.20260403.1 - TypeScript types for Workers APIs (KV, Analytics Engine, ScheduledEvent, etc.)

## Configuration

**Environment:**
- Secrets managed via Cloudflare Workers secrets (environment variables injected at runtime)
- Required secrets: `HMAC_SECRET`, `CF_ACCOUNT_ID`, `CF_API_TOKEN`
- Environment file: Not detected (secrets injected by platform)

**Build:**
- `tsconfig.json` - TypeScript configuration (ES2022 target, strict mode, DOM types)
- `wrangler.jsonc` - Cloudflare Workers configuration including KV bindings, Analytics Engine dataset, cron triggers
- `vite.config.ts` - Vite build configuration with custom cache-busting plugin for Service Worker

## Platform Requirements

**Development:**
- Node.js (version unspecified, but compatible with npm workspaces)
- Cloudflare Workers local runtime (provided by wrangler)

**Production:**
- Cloudflare Workers platform (edge computing)
- Cloudflare Pages (static asset hosting and auto-deployment)
- Cloudflare KV (global key-value store for puzzle caching)
- Cloudflare Analytics Engine (analytics dataset)

**Deployment:**
- Git repository at GitHub (jevawin/clumeral-game)
- Cloudflare Pages connected to GitHub (builds and deploys on merge to `main`)
- Build command: `npm run build`
- Output directory: `dist/client` (served by Workers)

## Build Process

**Dev Server:**
```bash
npm run dev
# Runs Vite dev server + Cloudflare Worker runtime locally
# Worker APIs (KV, Analytics) work identically to production
```

**Production Build:**
```bash
npm run build
# Vite bundles src/ into dist/client/ and dist/clumeral_game/ (Worker)
# Cache bust hash generated at build time for Service Worker
```

**Deployment:**
```bash
wrangler deploy --config wrangler.json
# Pushes Worker code to Cloudflare
# Automatic on merge to main via GitHub Actions (in Cloudflare Pages)
```

---

*Stack analysis: 2026-04-11*
