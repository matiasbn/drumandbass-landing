# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Landing + community site for **Drum and Bass Chile** (`drumandbasschile.cl`). Next.js 16 App Router, React 19, TypeScript, Tailwind v4. Beyond the public landing it hosts three distinct app surfaces: an **admin panel**, artist **press kits** (`pk`), and a 3D multiplayer **club** (react-three-fiber). Content comes from Contentful; auth, chat, profiles, scores, and newsletter live in Supabase; transactional email via Resend.

## Commands

```bash
npm run dev          # Turbopack dev server on port 3600 (NOT 3000)
npm run build        # next build
npm run lint         # eslint (next lint)
npm run format       # prettier --write over src/**
npm run test:e2e     # Playwright — auto-starts dev server on :3600, reuses if running
npm run test:e2e:ui  # Playwright UI mode
npx playwright test e2e/<file>.spec.ts        # single e2e file
npx playwright test -g "name of test"          # single test by title
npm run release      # git-flow release (see below)
```

Dev/Playwright both bind **port 3600** (`playwright.config.ts` `baseURL`). The README's mention of port 3000 is stale.

## Architecture

**Route groups** under `src/app/` — each group has its own `layout.tsx` and, where relevant, its own auth context:
- `(main)` — public landing: events (home), `artistas`, `organizaciones`, privacy/terms.
- `(admin)/admin/*` — ravers, users, presskits, campaigns. Each page is a server component that renders a `*Client.tsx`. Gated by `AdminAuthContext` (Google OAuth) + the `is_admin` Supabase column, verified server-side via `/api/admin/profile`.
- `(club)/club` — the 3D nightclub (`ClubClient` → `NightclubCanvas`/`NightclubScene`). Heavy `three`/`@react-three/fiber`/`drei` scene under `components/club/`.
- `pk/*` — artist press kits. `/artistas/:slug` **rewrites** to `/pk/:slug` (`next.config.ts`), so the public-facing URL differs from the route. Editor at `pk/edit` uses tiptap. Own auth via `PkAuthContext`.
- `auth/callback/route.ts` — Supabase OAuth code exchange; errors land on `auth/auth-code-error`.
- `api/*` — route handlers; `admin/*` handlers do server-side admin checks.

**Data sources (three, know which owns what):**
- **Contentful** (`lib/contentful.ts`) — events and streamings (`event`, `streaming` content types). Read-only CMS; home is ISR with `revalidate = 3600`. `api/revalidate` triggers on-demand revalidation (guarded by `REVALIDATION_SECRET`).
- **Supabase** — everything dynamic: auth, realtime chat, user profiles, club scores, newsletter subscribers, press kits. Two clients: `lib/supabase.ts` (`createClient`, browser, via `@supabase/ssr`) and `lib/supabase-server.ts` (`createSupabaseServer`, cookie-based, for server components / route handlers). Schema in `supabase-schema.sql` + `supabase/migrations/`.
- **Static JSON** (`src/data/*.json`) — seed lists of artistas, productores, organizaciones, eventos.

**Club multiplayer:** presence and movement broadcast over **Supabase Realtime channels** (`MultiplayerContext`, plus `Live/Score/Playback/Auth` contexts under `components/club/`). Player state (position, dance move, costume, face) is ephemeral channel data, not DB rows — scores/profiles are the persisted part. `ROADMAP_CLUB.md` tracks planned gamification.

**Contexts pattern:** each surface has an isolated React context provider — `club/AuthContext` (players), `admin/AdminAuthContext`, `pk/PkAuthContext`. They are separate on purpose; don't cross-wire them.

## Conventions

- **Imports use the `@/src/...` alias** (note the `src` segment — e.g. `@/src/lib/date`, `@/src/components/...`), not `@/...`. Match existing files.
- `lib/date.ts` re-exports a configured **dayjs** — import from there, not `dayjs` directly.
- Icons come from `@remixicon/react`. Fonts are Space Grotesk / Space Mono via `next/font`.
- `src/constants.ts` centralizes socials, WhatsApp link, `BASE_URL`, team.
- UI copy and commit messages are in **Spanish** — follow suit.

## Mock data for local testing (dev only)

To exercise UI states that depend on live CMS data (event proximity badges, past-event filtering) without touching Contentful, the home page injects **synthetic events in development only**.

Pattern (`src/lib/mockEvents.ts` + `src/app/(main)/page.tsx`):
- Mocks are plain `ContentfulEvent[]` — the **exact shape `getEvents()` returns after mapping Contentful**. They flow through the *same* `sort` + `filter` + `EventItem` + `getProximityBadge` pipeline, so what you see locally is what real Contentful data will produce.
- Dates are computed **relative to `dayjs()`** (now ± offsets) so each event lands in a distinct state: `AHORA`, `HOY`, `MAÑANA`, `ESTA SEMANA`, `PRÓXIMA SEMANA`, sin-badge (>2 weeks), and one past event (to confirm it gets filtered out).
- **Opt-in, off by default**: gated by `MOCK_EVENTS_ENABLED = process.env.NODE_ENV === 'development' && process.env.MOCK_EVENTS === '1'`. **Never renders in production.** Enable for a session with `MOCK_EVENTS=1 npm run dev`, or add `MOCK_EVENTS=1` to `.env.local`. Leaving the code in place with the flag off keeps mocks available without deleting them.
- In `page.tsx` mocks are **concatenated** with real events (`[...contentfulEvents, ...getMockEvents()]`), never replace them — real Contentful data still loads normally.

When adding a new CMS-driven UI state, extend `getMockEvents()` with a case that hits it (relative dates, realistic `venue`/`flyer`/`description` rich-text) rather than editing Contentful. Titles are prefixed `TEST · <state>` so they're obvious on screen. Note: on weekends `ESTA SEMANA` (now+2 days) rolls into `PRÓXIMA SEMANA` — that's correct calendar behavior, not a bug.

## Working with this file

Whenever you edit `CLAUDE.md`, commit it yourself right after (`git add CLAUDE.md && git commit -m "docs: update CLAUDE.md"`). Do it as an explicit step — do not rely on an automated hook.

## Deployment & domains

Hosted on **Vercel**. Two domains point at the **same site**: `drumandbasschile.cl` and `dnbchile.cl` (short alias) — same deployment, same app, not separate projects. Note `src/constants.ts` `BASE_URL` uses `www.drumandbasschile.cl` as canonical.

The **admin panel is a route, not a subdomain**: it lives at `<domain>/admin` (`src/app/(admin)/admin/`). There is **no `middleware.ts`** and no host/subdomain routing, so a bare subdomain like `admin.dnbchile.cl` will **not** serve `/admin` — it returns Vercel's `DEPLOYMENT_NOT_FOUND` unless that subdomain is attached to the project in Vercel *and* a `middleware.ts` rewrites by host. Use `/admin` on a working domain instead.

## Release (git-flow)

`scripts/release.sh` (run via `npm run release`) must be run **from a `feature/*` branch**. It: finishes the feature, starts a git-flow release bumping the **minor** version (`X.Y.0`), commits the bump, finishes the release, and pushes all branches + tags. Default branch is `develop`. The repo requires `git flow` to be installed.

## Environment

`.env.local` keys (not committed): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `CONTENTFUL_SPACE_ID`, `CONTENTFUL_ACCESS_TOKEN`, `REVALIDATION_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_GIPHY_API_KEY`, `YOUTUBE_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Supabase clients fall back to placeholders if unset (auth/chat silently disabled), so a missing key fails soft, not loud.
