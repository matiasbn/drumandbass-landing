# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Landing + community site for **Drum and Bass Chile** (`drumandbasschile.cl`). Next.js 16 App Router, React 19, TypeScript, Tailwind v4. Beyond the public landing it hosts three distinct app surfaces: an **admin panel**, artist **press kits** (`pk`), and a 3D multiplayer **club** (react-three-fiber). Everything lives in Supabase: auth, chat, profiles, scores, newsletter, press kits, and the site content (events/streamings, managed from the admin's own CMS — Contentful was fully replaced); transactional email via Resend.

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
- **CMS propio** (`lib/cms.ts`, replaced Contentful) — events and streamings in Supabase tables `cms_events` / `cms_streamings` (public-read RLS, admin-write), flyers in the public `flyers` Storage bucket. Read via a cookie-less anon `@supabase/supabase-js` client (safe inside ISR; home is `revalidate = 3600`, `/api/live` 60s). Managed from `/admin/eventos` and `/admin/streamings`; their API routes (`api/admin/events|streamings`) call `revalidatePath` after every mutation, so changes go live immediately. Dates are stored as TEXT `'YYYY-MM-DDTHH:mm'` (local wall time, the format the whole pipeline assumes — don't switch to timestamptz). `description_html` is plain HTML from the admin's tiptap editor. **Ticket links are multi-value:** `tickets` is the **active** URL (what the public button uses), and `ticket_links TEXT[]` keeps the **full history** of every sale URL the event has used (nothing is ever removed). The admin editor (`EventosClient`) lets you add URLs and pick which is active (new one active by default); the API guarantees the active URL is always in `ticket_links`. This exists so analytics never loses ticket clicks when a sale link changes — see the analytics outbound-click section. Added via `supabase/migrations/20260720000000_add_cms_events_ticket_links.sql` (apply manually in the SQL Editor). `api/revalidate` (guarded by `REVALIDATION_SECRET`) still exists for manual revalidation. `scripts/migrate-contentful.mjs` was the one-shot Contentful import: it downloads every flyer from ctfassets into the `flyers` bucket and upserts the rows directly (needs `SUPABASE_SECRET_KEY`), so **no asset points at images.ctfassets.net** — the bucket is the only allowed remote image host in `next.config.ts`.
- **Supabase (dynamic)** — auth, realtime chat, user profiles, club scores, newsletter subscribers, press kits. Two clients: `lib/supabase.ts` (`createClient`, browser, via `@supabase/ssr`) and `lib/supabase-server.ts` (`createSupabaseServer`, cookie-based, for server components / route handlers). Schema in `supabase-schema.sql` + `supabase/migrations/`.
- **Static JSON** (`src/data/*.json`) — seed lists of artistas, productores, organizaciones, eventos.

**Club multiplayer:** presence and movement broadcast over **Supabase Realtime channels** (`MultiplayerContext`, plus `Live/Score/Playback/Auth` contexts under `components/club/`). Player state (position, dance move, costume, face) is ephemeral channel data, not DB rows — scores/profiles are the persisted part. `ROADMAP_CLUB.md` tracks planned gamification.

**Contexts pattern:** each surface has an isolated React context provider — `club/AuthContext` (players), `admin/AdminAuthContext`, `pk/PkAuthContext`. They are separate on purpose; don't cross-wire them.

**Date-dependent UI must be client-computed (ISR gotcha).** The home is ISR-cached (`revalidate = 3600`), so anything derived from "now" would freeze at cache-generation time and go **stale in prod** (e.g. a `PRÓXIMA SEMANA` badge that never updates). The event proximity badge lives in `src/components/ProximityBadge.tsx` (client, `useEffect` + `dayjs()`) using pure logic from `src/lib/eventBadge.ts`; `EventItem` (server) just renders `<ProximityBadge date endDate />`. It renders `null` until mount (no hydration mismatch, nothing baked into cached HTML). The static event date box stays server-rendered. Follow this pattern for any new now-relative UI.

## Conventions

- **Imports use the `@/src/...` alias** (note the `src` segment — e.g. `@/src/lib/date`, `@/src/components/...`), not `@/...`. Match existing files.
- `lib/date.ts` re-exports a configured **dayjs** — import from there, not `dayjs` directly.
- Icons come from `@remixicon/react`. Fonts are Space Grotesk / Space Mono via `next/font`.
- `src/constants.ts` centralizes socials, WhatsApp link, `BASE_URL`, team.
- UI copy and commit messages are in **Spanish** — follow suit.

## Analytics — consider tracking on every change

The site uses **GA4** (`NEXT_PUBLIC_GA_ID`, currently `G-E32DT19ZDQ`), a hand-rolled setup: `src/components/GoogleAnalytics.tsx` loads gtag **only in production** and sends SPA page views on route change (it skips the first effect run so the initial `gtag('config')` pageview isn't double-counted — don't reintroduce that). Custom events go through the `event(action, params)` helper in `src/lib/gtag.ts` (no-op unless `window.gtag` exists, i.e. prod).

**Tracking philosophy — track everything, show only what's useful.** Fire an event for every meaningful action even if nobody looks at it yet; the data accumulates in GA and may matter later. But the **admin dashboard displays only the actions worth deciding on today**: `admin/analytics/AnalyticsClient.tsx` renders `CORE_ACTIONS` (from `src/lib/analyticsLabels.ts`), while `HIDDEN_ACTIONS` are still tracked but not shown. To surface a hidden action later, move its name from `HIDDEN_ACTIONS` to `CORE_ACTIONS` — its full history is already there. Don't stop tracking something just because it isn't displayed.

**MANDATORY: every new component or feature must ship with its tracking.** Whenever you build a new user-facing component, page, or meaningful user action, you MUST add the analytics event(s) for it in the same change — don't leave it for later. Fire a `event(...)` for the signal worth measuring (CTA clicks, conversions, form submits, feature usage, page/section views). Use descriptive GA4-style names and stable params, add the event to the admin dashboard's label/tip maps and to `SITE_EVENT_ORDER` in `admin/analytics/AnalyticsClient.tsx` so it shows in "Acciones clave del sitio", and mirror the name into `SITE_EVENT_NAMES` in `src/lib/ga.ts` (used by the monthly view). For server-rendered pages, fire on mount with `TrackOnMount` (see the presskit and club pages). Existing events to follow as examples: `junglist_signup`, `event_link_click` (`TicketButton`, keyed on unique `event_title`), `sotano_video_click`, `release_click`, `presskit_view`, `login` (`method`, `source`).

Gotchas: the helper only fires in prod (dev has no `gtag`). Server components can't call `event()` directly — wrap the interactive element in a small `'use client'` component (see `src/components/TicketButton.tsx`). GA aggregates custom events by **param value**, not by any DB entry id, so edited/reused event rows measure fine as long as `event_title`/`event_url` stay unique per occurrence.

**Auto-tracking (new sections track themselves):** `src/components/ClickTracker.tsx` (mounted in the root layout, prod only) listens for every `<a>`/`<button>` click and sends a `ui_click` event with `label` (the element text), `link_url`, and `section` — the section is read from the nearest `[data-section]` attribute or the closest `<section>`'s heading. **So any new section/button is tracked without extra code.** Add `data-section="…"` on a wrapper for a clean section name, or `data-track="…"` on the element for an explicit label. Prefer this for generic UI; keep dedicated `event()` calls (like `event_link_click`) for signals you want named/segmented specifically.

**Admin analytics dashboard:** `/admin/analytics` (`admin/analytics/AnalyticsClient.tsx`) renders a native dashboard from the **GA4 Data API** (`src/lib/ga.ts` + `api/admin/analytics`, admin-gated) — scorecards, daily active users, top pages, events, channels, and ticket clicks per event. Credentials: `GA_SERVICE_ACCOUNT_KEY` (service-account JSON, base64) + `GA_PROPERTY_ID`. Falls back to a Looker Studio embed (`NEXT_PUBLIC_LOOKER_STUDIO_URL`) when the service account isn't configured.

**Outbound-click metrics (the reliable source — read this before touching ticket/WhatsApp/social/El Sótano numbers).** Our custom `event()` calls on links that **navigate away** (tickets, WhatsApp, YouTube, social, Instagram) are **mostly lost**: the page unloads before gtag delivers the event (e.g. `event_link_click` recorded 4 of ~116 real clicks; `whatsapp_click`/`sotano_video_click` were 0). So the dashboard does **not** trust those custom events for outbound actions. Instead it reads GA4's **automatic enhanced-measurement `click` event** (always reliable, full history, no custom dimensions), which carries the built-in `linkDomain` and `linkUrl` dimensions. `ga.ts` returns `outboundByUrl` + `outboundByDomain`; `api/admin/analytics/route.ts` cross-references them with the CMS and overrides `topEvents` for `event_link_click` / `whatsapp_click` / `social_click` / `sotano_video_click` with the real numbers:
- **Tickets per event** — `TicketButton` appends a unique marker `?dnbt=<cms_events.id>` to the ticket URL (harmless query param; the destination ignores it). Each outbound click's `linkUrl` carries that marker, so a ticket click is attributed to its **event id** exactly — even when the ticket link is a shared/non-ticketera URL (e.g. an Instagram page used as the sale link) or changes over time. The marker is **not retroactive**, so pre-marker clicks fall back to matching the click's URL (host+path, query stripped) against the event's **`ticket_links`** (the CMS keeps the full history of every sale URL an event used — see the CMS multi-link section). The panel lists only **vigent events**, so past occurrences' clicks never leak into a current same-title event. Per-event counts fill going forward via the marker; the total (`event_link_click`) already reflects history via `ticket_links`.
- **WhatsApp** = outbound clicks to `chat.whatsapp.com` (by domain). **Redes** = social domains (instagram/soundcloud/spotify/tiktok/x/facebook) + all YouTube minus El Sótano.
- **El Sótano** = outbound clicks to YouTube **video** URLs whose title contains "El Sótano" — the route extracts each clicked video id and looks the title up via the **YouTube Data API** (`YOUTUBE_API_KEY`). This is robust to the section moving pages (matches by title, not by `pagePath`) and excludes the channel button and presskit/artist videos.

The old title+`event_date` and title+click-day schemes were dropped (custom dims aren't retroactive; the events were mostly dropped anyway). The **root fix** (send events with `transport_type: 'beacon'` and/or open external links in a new tab so they aren't lost on navigation) is a separate, optional improvement — not needed for these four metrics since they read GA's outbound data.

## Audience lists (junglists / ravers / DJs)

Three **separate** audience tables, kept intentionally disjoint. Know which owns what before touching any of them:

| List | Table | Source | Managed by |
|---|---|---|---|
| **Junglists** | `junglists` | Voluntary self-registration via Google login | The user (self-service) + admins |
| **Ravers** | `newsletter_subscribers` | Manual import from another DB | Admins only |
| **DJs** | `pk_profiles` | Presskit registration | The DJ |

Invariants (encoded in DB + API — don't reintroduce overlaps):
- **A DJ is always a junglist, but a junglist isn't always a DJ.** DJs are *not* duplicated into `junglists`; they're counted as junglists via **email union** when building the audience (the pattern `api/admin/ravers` already uses). `pk_profiles` keeps the heavy presskit fields junglists don't need.
- **Ravers and junglists are disjoint, both directions.** Registering as a junglist fires a DB trigger (`junglists_dedupe_ravers`, `AFTER INSERT`, `SECURITY DEFINER`) that deletes the matching row from `newsletter_subscribers`. The admin ravers import (`api/admin/ravers` POST) skips emails already in `junglists` (`status: 'skipped'`).
- **`junglists` is a lean, extensible table** — expect new columns over time.

Junglist registration (`src/app/api/junglist/route.ts`, `Junglist` type in `src/lib/supabase.ts`):
- Self-service `GET`/`POST`/`PUT`/`DELETE`, all scoped to `auth.uid()`. RLS: own row + admins can see/edit all; user can self-delete (unsubscribe).
- Fields `name`, `last_name`, `instagram` are all **required** and entered by the user; `email` comes from the Google token. One row per account (`user_id` unique, `email` unique).

**Privacy invariant (hard rule):** a junglist must NEVER learn their email was already in the DB (e.g. previously imported into ravers). So: the endpoint never reads `newsletter_subscribers`, never pre-fills the form with prior data, and no response mentions a prior presence; the ravers dedup is the silent DB trigger only. Preserve this when building the UI — do not pre-populate the "complete your data" form with anything the user didn't provide.

**Schema is applied manually** in the Supabase SQL Editor (no CLI/service-role in the repo). Migrations live in `supabase/migrations/` and are mirrored into the consolidated `supabase-schema.sql`; add new tables to both.

**RLS gotcha — per-command policies are easy to miss.** Because the schema is applied by hand, a table can end up with a SELECT/INSERT/UPDATE policy but **no DELETE policy** (or vice-versa). With RLS enabled, a missing policy means the command is **silently denied**: the client call returns **success with zero rows affected and no error**, so the UI looks like it worked but the DB never changed (rows "reappear" on reload). This bit us on `newsletter_subscribers` deletes (the "Admins can delete" policy was missing in the live DB). **Debugging rule: when a Supabase mutation succeeds but nothing changes, add `.delete()/.update()...select()` and check the affected-row count first — 0 rows + no error = a missing/blocking RLS policy.** Fix it by creating the missing `FOR DELETE/UPDATE ... USING (...)` policy (root fix), not a `SECURITY DEFINER` workaround. Related: admin mutations run through the cookie client, which is subject to RLS — `verifyAdmin` passing (a SELECT) does **not** guarantee a DELETE/UPDATE policy exists.

### Junglist registration UI & session states

The junglist join flow lives in the home **community zone** and the dedicated `/junglist` view — both are **session-aware** and decide what to show by querying the current user's state:

- `src/components/CommunityZone.tsx` — the "¡Únete a la comunidad!" three-column block (Junglist · Presskit · WhatsApp). **Home page only** (`(main)/page.tsx`), not in the layout, so it doesn't leak onto other pages. It's a client component that reads the session and, on mount, calls `/api/pk/profile` + `/api/junglist` to branch:
  - **DJ** (has `pk_profile`) → junglist column is **hidden** (a DJ already has junglist benefits), presskit column says "Editar presskit" (→ `/pk/edit`).
  - **Junglist** (row, not DJ) → junglist column shows "member / Ver mi perfil", presskit column invites "¿También eres DJ?".
  - **Guest** → both columns are register CTAs.
- `src/app/(main)/junglist/JunglistClient.tsx` — the `/junglist` page, same three-state logic (`anon` / `form` / `profile` / `dj`). Determines state from `supabase.auth.getUser()` + `/api/junglist` + `/api/pk/profile`. The form pre-fills `name`/`last_name` from **Google metadata only** (`given_name`/`family_name`) — never from our DB (privacy invariant). Unsubscribe (`DELETE`) hard-deletes the row, **signs the user out, and redirects home**.

Enforce **DJ ⊃ junglist** in the UI: a DJ never sees the junglist registration form; a junglist always sees the "become a DJ / create presskit" CTA. The junglist profile also shows the registration date (`created_at`, "Junglist desde el …") and a WhatsApp CTA. Unsubscribe uses an **inline two-step confirmation** (BrutalistButton), NOT `window.confirm` — the native dialog is unreliable on mobile.

**Admin & campaigns:** `/admin/junglists` (`api/admin/junglists`, GET list + DELETE, admin-only) — table with search, sort, CSV export, and per-row delete; linked from the admin menu. Junglists are also a selectable **email-campaign audience** (`api/admin/campaigns`, audience key `junglists`), unioned and **deduplicated by email** with ravers/registered/DJs, so an email in several lists is sent once. The campaign step-1 UI shows a live "total correos únicos" as audiences are toggled.

### Supabase browser client & auth gotchas

- **`createClient()` in `src/lib/supabase.ts` is a memoized singleton** — do NOT create multiple browser clients. Multiple `GoTrueClient` instances contend on the Web Locks API and make `getUser()`/`getSession()` **hang forever** (blank loading screens). Every component must reuse `createClient()`.
- OAuth uses `signInWithOAuth({ provider: 'google', options: { redirectTo: \`${origin}/auth/callback?next=...\` } })`; `/auth/callback/route.ts` exchanges the code and honors `next`.
- **Supabase Auth → URL Configuration → Redirect URLs** must include the dev origin **`http://localhost:3600/**`** (wildcard, to cover the `?next=` query) alongside the prod domains. Missing it makes Supabase fall back to the Site URL (prod) and drop you at `https://…/?code=…` where the code is never exchanged. Always browse dev via `http://localhost:3600` (not the LAN IP) so the origin matches the session.
- `src/components/DevLogout.tsx` — a **dev-only** floating "force logout" button (guarded by `NODE_ENV === 'development'`, mounted in the root layout). Clears the `sb-*` localStorage/cookies even if `signOut()` hangs. Useful to escape a stuck cross-origin session. Never renders in production.

## Mock data for local testing (dev only)

To exercise UI states that depend on live CMS data (event proximity badges, past-event filtering) without touching the production tables, the home page injects **synthetic events in development only**.

Pattern (`src/lib/mockEvents.ts` + `src/app/(main)/page.tsx`):
- Mocks are plain `CmsEvent[]` — the **exact shape `getEvents()` returns after mapping the Supabase rows**. They flow through the *same* `sort` + `filter` + `EventItem` + `getProximityBadge` pipeline, so what you see locally is what real CMS data will produce.
- Dates are computed **relative to `dayjs()`** (now ± offsets) so each event lands in a distinct state: `AHORA`, `HOY`, `MAÑANA`, `ESTA SEMANA`, `PRÓXIMA SEMANA`, sin-badge (>2 weeks), and one past event (to confirm it gets filtered out).
- **Opt-in, off by default**: gated by `MOCK_EVENTS_ENABLED = process.env.NODE_ENV === 'development' && process.env.MOCK_EVENTS === '1'`. **Never renders in production.** Enable for a session with `MOCK_EVENTS=1 npm run dev`, or add `MOCK_EVENTS=1` to `.env.local`. Leaving the code in place with the flag off keeps mocks available without deleting them.
- In `page.tsx` mocks are **concatenated** with real events (`[...cmsEvents, ...getMockEvents()]`), never replace them — real CMS data still loads normally.

When adding a new CMS-driven UI state, extend `getMockEvents()` with a case that hits it (relative dates, realistic `venue`/`flyer`/`description` HTML) rather than editing production data. Titles are prefixed `TEST · <state>` so they're obvious on screen. Note: on weekends `ESTA SEMANA` (now+2 days) rolls into `PRÓXIMA SEMANA` — that's correct calendar behavior, not a bug.

### Session indicator in the header

`src/components/SessionMenu.tsx` (mounted inside `HeaderNav`, so it shows on all `(main)` and `pk` pages — the ones with `Header`) tells the user **which account is logged in** and gives a fixed place to log out. The site lets you sign in from several surfaces (junglist, presskit, club), so without this it's easy to lose track of your session. It reads the real Supabase session via the memoized `createClient()` and listens to `onAuthStateChange`, so it's a **production** feature, not a dev tool. When there's no session it renders nothing (login stays contextual — there's no generic "entrar"). Two variants: `desktop` (a square initial chip at the far right of the nav → dropdown with email + "Mi perfil" + logout) and `mobile` (a block at the top of the popover). Logout fires `event('logout', { source: 'header' })` and redirects home. Admin has its own no-access/account UI (`CampaignsClient`), and the dev-only `DevLogout` force-logout button is separate.

## El Sótano videos (YouTube)

`src/lib/youtube.ts` `getSotanoVideos(n)` lists the channel's latest uploads (@drumandbasschile — uploads playlist `UUa93ljufgJ4Wdryd8FUFZnQ`) and filters by title containing **"El Sótano"** (accent/case-insensitive), cached with ISR (`fetch(..., { next: { revalidate: 3600 } })`) so it costs almost no quota and **updates itself** when a new chapter is uploaded. Rendered on the **home only** (`(main)/page.tsx`) via `src/components/YoutubeVideos.tsx` — 2 videos in one row, thumbnails that link out to `youtube.com/watch?v=…` + a channel button. Uses `YOUTUBE_API_KEY`; returns `[]` (and the section hides) if the key is missing or the API fails. To change the series, edit `TITLE_MATCH`; reads one page (50 uploads) so if the channel ever exceeds that, add pagination.

## Working with this file

Whenever you edit `CLAUDE.md`, commit it yourself right after (`git add CLAUDE.md && git commit -m "docs: update CLAUDE.md"`). Do it as an explicit step — do not rely on an automated hook.

## Deployment & domains

Hosted on **Vercel**. Two domains point at the **same site**: `drumandbasschile.cl` and `dnbchile.cl` (short alias) — same deployment, same app, not separate projects. Note `src/constants.ts` `BASE_URL` uses `www.drumandbasschile.cl` as canonical.

The **admin panel is a route, not a subdomain**: it lives at `<domain>/admin` (`src/app/(admin)/admin/`). There is **no `middleware.ts`** and no host/subdomain routing, so a bare subdomain like `admin.dnbchile.cl` will **not** serve `/admin` — it returns Vercel's `DEPLOYMENT_NOT_FOUND` unless that subdomain is attached to the project in Vercel *and* a `middleware.ts` rewrites by host. Use `/admin` on a working domain instead.

## Release (git-flow)

`scripts/release.sh` (run via `npm run release`) must be run **from a `feature/*` branch**. It: finishes the feature, starts a git-flow release bumping the **minor** version (`X.Y.0`), commits the bump, finishes the release, and pushes all branches + tags. Default branch is `develop`. The repo requires `git flow` to be installed.

Manual release flow (when committing on `develop` directly, as during pair sessions): commit the work → `git flow release start X.Y.Z` → `npm version X.Y.Z --no-git-tag-version` → commit `version bump` → `git flow release finish X.Y.Z` (macOS `getopt` rejects `-m "…"` with spaces; pass the tag message via `GIT_MERGE_AUTOEDIT=no GIT_EDITOR='cp /tmp/tagmsg' git flow release finish X.Y.Z`) → `git push origin main develop --tags`. This repo bumps the **minor** per release (2.17 → 2.18 → …). Tags use the **`v` prefix** (`gitflow.prefix.versiontag = v`).

**Release gate must be `npx tsc --noEmit`, NOT `next build`.** `next build` writes to `.next` (the same dir a running `next dev` uses) and appends paths to `tsconfig.json` — running it mid-release dirties the working tree, which makes `git flow release start` abort, and it corrupts/kills an active dev server. Never `pkill` the user's dev server and never start a background `next dev` on port 3600 (causes `EADDRINUSE` for the user). To verify runtime behavior, curl the user's already-running dev server instead of spawning one.

## Environment

`.env.local` keys (not committed): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `REVALIDATION_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_GIPHY_API_KEY`, `YOUTUBE_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Supabase clients fall back to placeholders if unset (auth/chat silently disabled), so a missing key fails soft, not loud. `CONTENTFUL_SPACE_ID`/`CONTENTFUL_ACCESS_TOKEN` are no longer used by the app — only by the one-shot import script `scripts/contentful-to-sql.mjs`.

**Dev-only flags** (never set in production): `MOCK_EVENTS=1` injects synthetic events on the home (gated on `NODE_ENV === 'development'`).
