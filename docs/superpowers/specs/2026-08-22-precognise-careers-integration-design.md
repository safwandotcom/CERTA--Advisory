# PreCognise Careers Integration — Design

**Date:** 2026-08-22
**Status:** Approved for planning

## Context

CERTA& Advisory's Careers section (`index.html#careers`) is currently a static block: hardcoded role-name chips and a generic "send your CV" note — no real job listings. Separately, the user has a recruiter account on **PreCognise** (`https://precognise.co`), their own recruiting platform (source at `E:\PreCognize\frontend`, Next.js + Prisma + Supabase), and already posts CERTA& Advisory roles through it. Three are live today:

- `https://www.precognise.co/j/6tt8u7ag`
- `https://www.precognise.co/j/wejpef2s`
- `https://www.precognise.co/j/k4tjg37j`

Goal: show these (and future) postings on the CERTA& Advisory Careers section automatically — no manual copy-paste — while reusing PreCognise's existing public job page and apply flow rather than rebuilding one on the CERTA site.

**How PreCognise already works (confirmed by reading the source):**

- Jobs posted through the recruiter flow (`POST /api/recruiter/jobs`, which is what the user's recruiter account already uses) are stored as a `JobPosting` row with `source: RECRUITER`, an auto-generated unique `publicSlug`, and `visibleToCandidates: true` by default.
- Those rows are already servable with no authentication at `GET /api/public/jobs/[slug]` and viewable end-to-end (description + apply form) at `precognise.co/j/[slug]`. This apply flow needs no changes.
- Jobs posted through the separate institution/org flow (`POST /api/institution/[id]/jobs`) do **not** get a `publicSlug` and are invisible to the public endpoint — that flow is not used here.
- There is currently no endpoint that lists *multiple* public jobs (only single-job-by-slug). One needs to be added.
- `JobPosting.company` is free text; there is no stable per-employer identifier on recruiter-authored rows.

**Explicit decision (from brainstorming):** filter the new list endpoint by an exact (case-insensitive) match on `company = "CERTA& Advisory"` rather than adding a schema field for a stable org identifier. Zero schema migration, ships fastest; the tradeoff — a typo in the `company` field when posting a job silently drops it from the CERTA site — is accepted as low-risk given the user posts these roles personally in small numbers.

**Explicit decision (from brainstorming):** client-side fetch, not a scheduled sync job. The CERTA site's Careers section JS calls the new PreCognise endpoint directly in the visitor's browser on page load. This keeps the CERTA site fully static (no build step, no CI job, no git-write credentials for a bot) and shows new postings within seconds of being created on PreCognise. Accepted tradeoff: if `precognise.co` is briefly unreachable, the section falls back to static copy instead of showing listings — acceptable for a small careers section, not worth the added infrastructure of baking a static snapshot into the repo on a cron.

## Scope

Two repos, one new contract between them:

- **PreCognise** (`E:\PreCognize\frontend`): one new API route, no schema change, no changes to the existing apply flow.
- **CERTA& Advisory** (`E:\CERTA ADVISORY\index.html`, `assets/script.js`, `assets/styles.css`): replace the static role-chip content in `#careers` with live-fetched listings; keep the existing "don't see your role — send your CV" block as-is beneath it.

Out of scope: any change to how jobs are posted on PreCognise, the `/j/[slug]` apply page/flow, the CERTA `portal/` subapp, or any new build step for the CERTA site.

## 1. PreCognise: new public list endpoint

**New route:** `src/app/api/public/jobs/route.ts` — `GET` only, no authentication (mirrors the existing no-auth pattern of `GET /api/public/jobs/[slug]`).

**Query:** `?company=<string>` — required. Example: `/api/public/jobs?company=CERTA%26%20Advisory`.

**Filter (Prisma):**
```
where: {
  source: "RECRUITER",
  isActive: true,
  visibleToCandidates: true,
  company: { equals: company, mode: "insensitive" },
}
orderBy: { firstSeenAt: "desc" }
```

**Response shape:** an array of the same `PublicJobView` shape the single-slug endpoint already builds and returns today (`id`, `slug`, `title`, `company`, `location`, `remote`, `compensation`, `description`, `responsibilities`, `workEnvironment`, `keySkills`, `aspirations`, `postedAt`) — reused as-is so the full job detail is available in the list response and the CERTA site never needs a second round-trip to show a description.

```json
{ "jobs": [ { "id": "...", "slug": "6tt8u7ag", "title": "...", "company": "CERTA& Advisory", "location": "...", "remote": false, "compensation": null, "description": "...", "postedAt": "2026-08-20T..." } ] }
```

**CORS:** respond with `Access-Control-Allow-Origin: *` on this route. The data is already fully public with no auth gating the existing `/j/[slug]` pages, so there's no confidentiality reason to restrict the origin — restricting it would only add a maintenance point (keeping an allow-list in sync with CERTA's domain/subdomains) for no security benefit.

**Not recorded as a `public_job.viewed` event** (unlike the single-slug endpoint) — this is a list fetch, not a candidate viewing one specific posting; the existing per-job view event still fires normally when someone actually opens `/j/[slug]`.

## 2. CERTA& Advisory: live Careers listings

**Markup (`index.html#careers`):** replace the current `.careers-roles` chip row with a new container, e.g. `<div id="careers-jobs" class="careers-jobs" data-reveal>`, left empty in the HTML — populated by JS. The heading/intro paragraph above it, and the "Don't see your role listed? Send your CV" block below it, stay exactly as they are today.

**Behavior (`assets/script.js`):**
1. On page load, `fetch('https://precognise.co/api/public/jobs?company=CERTA%26%20Advisory')`.
2. On success with ≥1 job: render one row per job — job title as a clickable button, plus location/remote badge if present. A short "Apply through PreCognise" note sits above the list once, not per row.
3. Clicking a title expands that row inline (accordion — one open at a time) to show the full description text, followed by an **"Apply via PreCognise ↗"** link (`target="_blank" rel="noopener"`) pointing at `https://precognise.co/j/{slug}`. No apply form is built on the CERTA site.
4. On fetch failure, non-OK response, or an empty `jobs` array: leave `#careers-jobs` empty/hidden and show nothing extra — the existing "We hire on a rolling basis, send your CV" block already covers this case, so no separate error message is needed.
5. No polling/auto-refresh — a fresh page load is the refresh mechanism, matching a marketing site's normal caching expectations.

**Styling (`assets/styles.css`):** new `.careers-jobs`, `.careers-job`, `.careers-job__title`, `.careers-job__body` rules matching the existing card/chip visual language already defined for this section (`credential-chip`, `careers-note`) — no new color tokens or components, per `DESIGN.md`'s established system.

## Data flow

```
Visitor loads certaadvisory.com
  → browser JS: GET precognise.co/api/public/jobs?company=CERTA%26%20Advisory
  → PreCognise queries JobPosting (source=RECRUITER, isActive, visibleToCandidates, company match)
  → JSON array of jobs back to the browser
  → CERTA renders title list
  → visitor clicks a title → expands description (already in the payload, no extra request)
  → visitor clicks "Apply via PreCognise" → opens precognise.co/j/{slug} in a new tab
  → existing PreCognise apply flow handles the rest (unchanged)
```

## Error handling

Read-only in both directions — the CERTA site never writes anything to PreCognise, and no PII crosses the boundary (job postings are already public marketing content). The only failure mode is "listings don't show," which degrades to the pre-existing static fallback copy. A CORS misconfiguration or PreCognise outage both surface the same way: a console error on CERTA's side and the static fallback rendering, never a broken/empty box.

## Testing

Manual, since both sides are small and this has no automated test suite today:

1. Load the CERTA site and confirm all 3 live postings render, in the right order (newest first).
2. Click each title, confirm the full description expands correctly and only one row is open at a time.
3. Click "Apply via PreCognise" on each and confirm it opens the correct `precognise.co/j/{slug}` page.
4. Temporarily post a job on PreCognise under a different company name and confirm it does **not** appear in the CERTA list (filter correctness).
5. Temporarily point the fetch URL at an unreachable address and confirm the section falls back to the existing static copy instead of erroring visibly.
