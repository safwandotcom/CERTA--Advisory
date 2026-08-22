# PreCognise Careers Integration — Design

**Date:** 2026-08-22
**Status:** Approved for planning

**Revision note:** an earlier version of this spec proposed a new public list endpoint on PreCognise plus a client-side fetch from the CERTA site. The user asked to exclude the PreCognise repo from this change entirely. This version replaces that design — see "Why this changed" below.

## Context

CERTA& Advisory's Careers section (`index.html#careers`) is currently a static block: hardcoded role-name chips and a generic "send your CV" note — no real job listings. Separately, the user has a recruiter account on **PreCognise** (`https://precognise.co`), their own recruiting platform, and already posts CERTA& Advisory roles through it. Three are live today:

- `https://www.precognise.co/j/6tt8u7ag`
- `https://www.precognise.co/j/wejpef2s`
- `https://www.precognise.co/j/k4tjg37j`

Each of these is already a fully working public page on PreCognise — full job description and a working "Apply" flow — with no CERTA-side changes needed to use it.

Goal: show these (and future) postings on the CERTA& Advisory Careers section, linking out to PreCognise to view/apply, **without touching the PreCognise repo**.

## Why this changed

The first version of this spec needed a PreCognise-side change for two reasons: (1) there's no existing endpoint that lists "all jobs for CERTA& Advisory" (only a single-job-by-slug lookup), and (2) a browser fetch from `certaadvisory.com` to `precognise.co` is blocked by CORS unless PreCognise's API explicitly allows it — true even for the *existing* single-job endpoint, since it currently returns no CORS headers.

With PreCognise off-limits, both of those move to the CERTA side:

- **No list endpoint anywhere** → the CERTA repo has to know which job slugs are its own. There's no way around this without asking PreCognise for a list, so it becomes a small hand-maintained list of `{title, slug}` pairs in the CERTA repo, updated when a role is posted or closed on PreCognise. This is a real, accepted manual step — far lighter than today's problem (copy-pasting full listings), but not fully automatic.
- **No CORS-safe fetch to PreCognise** → rather than add a proxy/serverless function to work around it (which would add a backend to what's currently a pure static site), the user chose the simpler path: **no fetch at all.** Each job title on CERTA links straight out to its existing `precognise.co/j/{slug}` page, which already shows the full description and handles applying. CERTA never needs to know or display the description itself.

Net effect: this is now a **CERTA-repo-only, fully static change** — no API, no fetch, no CORS, no new infrastructure anywhere, and zero changes to PreCognise.

## Scope

`E:\CERTA ADVISORY\index.html` (and `assets/styles.css` for supporting styles) only. No changes to `assets/script.js` (no fetch logic needed), no changes to the PreCognise repo, no changes to the CERTA `portal/` subapp.

## Design: static job-link list

**Markup (`index.html#careers`):** replace the current `.careers-roles` chip row with a small static list of real openings, hand-authored directly in the HTML — one row per live PreCognise posting:

```html
<div class="careers-jobs" data-reveal>
  <a class="careers-job" href="https://precognise.co/j/6tt8u7ag" target="_blank" rel="noopener">
    <span class="careers-job__title">{{ role title }}</span>
    <span class="careers-job__cta">View &amp; apply on PreCognise ↗</span>
  </a>
  <!-- one .careers-job per open role -->
</div>
```

Each `<a>` points directly at the role's existing `precognise.co/j/{slug}` page (`target="_blank" rel="noopener"`, matching the site's existing external-link convention). The heading/intro paragraph above this block, and the "Don't see your role listed? Send your CV" note below it, stay exactly as they are today.

**Styling (`assets/styles.css`):** new `.careers-jobs` / `.careers-job` / `.careers-job__title` / `.careers-job__cta` rules, matching the visual language already established for this section (`credential-chip`, `careers-note`) — no new color tokens or components, per `DESIGN.md`'s established system. Each row reads as a clickable card/link (hover state matching the site's existing link/button hover conventions).

**Maintenance step (manual, by design):** when the user posts a new CERTA& Advisory role on PreCognise or closes an existing one, they add/remove one `.careers-job` block in `index.html` (title text + `precognise.co/j/{slug}` URL) and push — Vercel auto-deploys on push to `main`, per the site's existing deploy model. No slug list file, no build step, no JSON — the HTML itself is the list, kept as small and inspectable as the rest of the page.

## Data flow

```
Visitor loads certaadvisory.com
  → sees static job title list already baked into the page (no fetch)
  → clicks a title → opens precognise.co/j/{slug} in a new tab
  → existing PreCognise public job page shows the full description
  → visitor applies there via PreCognise's existing apply flow (unchanged)
```

## Error handling

None needed beyond what already exists: this is static HTML linking to pages PreCognise already serves reliably today. The only failure mode is a stale entry (a role closed on PreCognise but not yet removed from `index.html`) — visiting it shows PreCognise's own "posting closed" state, which is an acceptable, self-explanatory result rather than something CERTA needs to detect or guard against.

## Testing

Manual:
1. Load the CERTA site and confirm all 3 current postings render as rows with correct titles.
2. Click each row and confirm it opens the correct `precognise.co/j/{slug}` page in a new tab.
3. Confirm the existing "Don't see your role listed? Send your CV" block still renders correctly beneath the new list.
4. Confirm the section's responsive layout (mobile stacking) matches the rest of the page's card patterns.
