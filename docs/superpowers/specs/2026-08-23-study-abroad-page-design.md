# Study Abroad (Malaysia) Page — Design

**Date:** 2026-08-23
**Status:** Approved for planning

## Context

CERTA& Advisory is documented in `PRODUCT.md` as an accounting-only BPO ("This is an accounting BPO, not a general-purpose BPO... the site must not imply otherwise") serving finance decision-makers in the UK, USA, Canada, and Europe. The user has confirmed, via brainstorming, that CERTA& Advisory also operates a genuine second service line — a Study Abroad (Malaysia) consultancy, with a real agent relationship to EMGS (Education Malaysia Global Services, the Malaysian government body that handles international student visa/pass processing) and to a defined list of partner universities — and wants this represented on the site as a distinct, clearly-scoped addition rather than blended into the accounting narrative.

This is architectural, not a copy tweak: it introduces the site's first second page (today the site is a single `index.html` with anchor-only navigation), a new unrelated business vertical's worth of content, and real named third-party institutions whose logos require genuine sourcing — all constraints the brainstorming session surfaced and confirmed before any design work began.

**Confirmed facts (from brainstorming, not to be re-litigated):**
- Real, existing relationship — not illustrative, not aspirational. Safe to name the specific institutions.
- Framed as a second service line of CERTA& Advisory itself (same brand), not a separately-branded spinoff.
- New static page, no build step, sharing `index.html`'s header/nav/footer and design tokens.
- Logos sourced from each institution's own official site by the implementer, stored locally (not hotlinked), with a text-chip fallback (matching the site's existing FreeAgent-fallback precedent) for any institution where a clean official mark can't be found — and the implementer must report which ones needed the fallback.
- Services offered (user-supplied, verbatim): University Selection, Course Selection, Counselling, Legal Documents Processing, Accommodation Solutions, Air Ticketing, Airport Pickup & Dropoff at Malaysia.
- University showcase layout: a hybrid the user approved after visual-companion review — story-rail avatars for fast browsing at the top, with all universities' full detail cards always present below (not hidden behind JS), grouped by category. Clicking a rail avatar smooth-scrolls to and highlights the matching card.
- EMGS relationship is described by what CERTA& Advisory *does* ("we handle your EMGS visa/pass processing") rather than asserting a specific formal status like "authorized agent," since that exact legal wording hasn't been confirmed — the user can correct this in spec review if stronger language is accurate and wanted.

**Full university list (14), as supplied by the user, grouped:**

*International branch campuses (5):*
- Monash University Malaysia — Bandar Sunway, Selangor
- University of Nottingham Malaysia — Semenyih, Selangor
- University of Southampton Malaysia — Iskandar Puteri, Johor
- Heriot-Watt University Malaysia — Putrajaya
- Curtin University Malaysia — Miri, Sarawak

*Malaysian public universities (6):*
- Universiti Malaya (UM) — Kuala Lumpur (oldest, top-ranked research university)
- Universiti Kebangsaan Malaysia (UKM) — Bangi, Selangor (national university)
- Universiti Putra Malaysia (UPM) — Seri Kembangan, Selangor (agriculture/research)
- Universiti Sains Malaysia (USM) — George Town, Penang (science)
- Universiti Teknologi Malaysia (UTM) — Skudai, Johor (engineering/tech)
- Universiti Teknologi MARA (UiTM) — Shah Alam, Selangor (largest public university system)

*Malaysian private universities (3, the original three named in the request):*
- Taylor's University — Subang Jaya, Selangor
- UCSI University — Kuala Lumpur
- University of Cyberjaya — Cyberjaya, Selangor

(Exact city/state for Taylor's, UCSI, and Cyberjaya to be confirmed against each university's own site during logo/content sourcing — the user gave these three by name only, without location detail, unlike the other 11.)

## Scope

Two files touched on the existing site (`index.html`, `assets/styles.css`), plus two new files (`study-abroad.html`, and logo image assets under `assets/study-abroad/logos/`), plus a small new block in `assets/script.js`. No build step introduced. No changes to any other existing page content beyond adding nav links and the new homepage teaser section.

Out of scope: a CMS or data-driven university list (14 static entries is small enough to hand-maintain, matching this site's existing "hand-edit `index.html`" convention established for the Careers job list); a booking/lead-capture form (the CTA is a `mailto:` link, matching the rest of the site); translating/localizing the page; SEO landing-page optimization beyond the standard `<title>`/meta description every page gets.

## 1. Homepage teaser section

**Placement:** new `<section id="study-abroad">` between Careers and Contact, matching `index.html`'s existing section structure (`.container`, `.section__head` with h2 + subhead `p.prose`).

**Content:**
```
H2: Study in Malaysia.
Subhead: A second service from CERTA& Advisory — university placement, EMGS visa processing, and on-the-ground support for students heading to Malaysia.
```

**CTA:** a button styled like the site's existing `.btn` variants, reading **"Study in Malaysia"** with an inline SVG Malaysia flag icon before the text (14×14 or 16×16, simple two-color rectangle-based flag — not the 🇲🇾 emoji character, matching the site's zero-emoji, hand-drawn-SVG-only icon convention established across every other icon on the site). Links to `study-abroad.html` (same-tab, standard internal navigation — no `target="_blank"`, since it's a page on the same site, not an external link).

**Nav:** "Study Abroad" added to both `.primary-nav` and `#mobileNav`, positioned after "Careers" (matching the new section's position in the page), linking to `study-abroad.html`.

## 2. New page: `study-abroad.html`

Same `<head>` boilerplate as `index.html` (charset, viewport, theme-color, font preconnects, favicon) but its own `<title>` (e.g. "Study in Malaysia — CERTA& Advisory") and meta description. Same header markup (logo, primary nav, mobile nav, header CTA) — but every homepage-anchor link (`#services`, `#why-us`, etc.) becomes `index.html#services`, `index.html#why-us`, etc., since this page isn't `index.html`. The nav's own "Study Abroad" entry on this page points to `#top` (top of this same page) rather than back to itself via a homepage anchor.

### 2a. Hero
"Study in Malaysia" heading, a short framing paragraph (what CERTA& Advisory's Study Abroad service is, honestly scoped — a consultancy service, not the universities themselves), and a CTA button reusing the `mailto:info@certaadvisory.com` pattern already established for "Book a discovery call," but with a distinct subject line — `?subject=Study%20Abroad%20-%20Malaysia` — so these inquiries are distinguishable from accounting ones in the inbox.

### 2b. About / Services
Intro paragraph on what the service covers end-to-end. Then the 7 services, each as an icon + h3 + short description row, in the same visual grammar as the homepage's `.service-row` pattern (hand-drawn 24×24 SVG icon matching the established stroke-width/line-cap convention, not a new icon style):

- University Selection
- Course Selection
- Counselling
- Legal Documents Processing
- Accommodation Solutions
- Air Ticketing
- Airport Pickup & Dropoff at Malaysia

(Body copy for each is written during implementation, grounded only in this service name — no invented specifics like turnaround times or guarantees that haven't been confirmed.)

### 2c. EMGS
A short section explaining what EMGS is (Education Malaysia Global Services — the Malaysian government body responsible for international student visa/student pass processing) and CERTA& Advisory's role: "we handle your EMGS visa/pass processing on your behalf" (see the Context section above on why this phrasing, not "authorized agent," is used unless corrected). Includes the EMGS logo, sourced per the Assets section below.

### 2d. Universities

**Rail:** a horizontal, scrollable row of circular logo avatars (one per university, 14 total), each an anchor link (`href="#uni-{slug}"`) to its full card below — functional with no JS (native anchor jump), enhanced by JS to `scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' })` and a brief highlight class on the target card, matching the site's existing `reducedMotion` guard pattern in `script.js`.

**Full cards (always visible, below the rail):** grouped into three subsections with their own small heading, in this order — International Branch Campuses (5), Malaysian Public Universities (6), Malaysian Private Universities (3) — each card showing: logo, name, location, and the one-line descriptor already given for the 11 universities that have one (the 3 originally-named universities get a comparably short, honest descriptor written during implementation, not fabricated beyond what's publicly verifiable — e.g. "Malaysia's largest private university" is the kind of claim that needs a real source, not an assumption).

### 2e. Closing CTA
Same `.cta-band` pattern as the homepage's Contact section (dark background, heading, CTA button) — reusing the same `mailto:` + distinct subject-line convention as the hero CTA.

## 3. Assets — logo sourcing

For EMGS and all 14 universities: the implementer fetches each institution's official logo directly from that institution's own website (never a third-party aggregator, never an AI-generated approximation), downloads it, and stores it under `assets/study-abroad/logos/` with a clear filename (e.g. `emgs.svg`, `universiti-malaya.png`). If no clean, appropriately-usable official mark can be found for a given institution, that institution falls back to a text/wordmark chip — the same treatment already established for FreeAgent in the credential strip — and the implementation report must explicitly list which institutions (if any) used the fallback, rather than silently shipping a low-quality or watermarked image.

## 4. Styling & scripting

All new CSS lives in `assets/styles.css` under a new `/* ---------- Study Abroad ---------- */` block (matching the file's existing single-stylesheet, commented-block convention) — no second stylesheet. Reuses existing design tokens exclusively (no new colors). The rail→scroll-and-highlight behavior is a new, self-contained block in `assets/script.js`, guarded on the relevant elements' existence (matching every other feature in that file) and respecting the existing `reducedMotion` flag.

## Testing

No automated test framework exists for this static site (unchanged from every prior plan on this repo). Manual verification: both nav menus link correctly to the new page and back to homepage anchors; the flag-icon CTA on the homepage opens `study-abroad.html`; all 14 rail avatars jump to and highlight the correct card; every logo (or its text fallback) renders correctly with no broken images; both `mailto:` CTAs open with the correct, distinct subject lines; the page holds up at mobile width (rail scrolls horizontally, grouped cards stack to one column, matching the site's existing responsive conventions).
