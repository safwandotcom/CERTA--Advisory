# Study Abroad (Malaysia) Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build CERTA& Advisory's first second page, `study-abroad.html` — a real second service line (Study Abroad / Malaysia consultancy, with a genuine EMGS agent relationship and 14 named partner universities) — plus a homepage teaser section that links to it.

**Architecture:** Vanilla HTML/CSS/JS, no build step, matching the existing site exactly. `study-abroad.html` is a new static file reusing `index.html`'s header/nav/footer markup and `assets/styles.css`/`assets/script.js` (same design tokens, same reveal/nav-toggle/reduced-motion systems) — with every homepage-anchor href rewritten to `index.html#anchor` since it's no longer the file being anchored into. All new CSS is appended to `assets/styles.css` under one new commented block; one new self-contained JS block is appended to `assets/script.js` for the university-rail interaction. Real institution logos are sourced from each institution's own official website during Task 7 and stored locally.

**Tech Stack:** Static HTML5, CSS custom properties (existing tokens in `assets/styles.css:2-37`), vanilla JS (matching `assets/script.js`'s existing patterns: `reducedMotion` guard, element-existence guards, no framework).

**Spec:** `docs/superpowers/specs/2026-08-23-study-abroad-page-design.md`

## Global Constraints

- **Scope:** `index.html`, `assets/styles.css`, `assets/script.js`, new file `study-abroad.html`, new asset directory `assets/study-abroad/logos/`. No other file changes.
- **No build step, no new dependencies.** Every file stays hand-editable static HTML/CSS/JS.
- **No em dashes and no "outsourcing" wording anywhere** — standing site-wide copy rules (see `docs/superpowers/specs/2026-08-23-study-abroad-page-design.md`'s Context section and prior commits). Use a period, comma, or colon instead of a dash in any new copy.
- **No fabricated claims.** Every sentence of new copy must be either a plain description of a named service (no invented turnaround times, guarantees, or statistics), a location/fact already supplied in this plan (sourced from the user or verified via the university's own site — see Task 5), or the EMGS phrasing specified in Task 4 ("we handle your EMGS visa and pass processing on your behalf" — not "authorized agent" or any other specific legal status).
- **Brand tokens only.** Reuse existing custom properties from `assets/styles.css:2-37` (`--ink`, `--ink-muted`, `--certa-green`, `--certa-green-deep`, `--certa-green-tint`, `--surface-tint`, `--border`, `--white`, `--radius-sm`, `--radius-md`, `--space-*`, `--ease-standard`). No new colors.
- **Icon convention:** every new icon is a hand-drawn inline SVG, `viewBox="0 0 24 24"`, `fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"` for line icons (sized via the containing `.service-row__mark` class, matching every existing service icon on the site) — never an emoji, never an icon font. The one exception is the Malaysia flag icon (Task 2), which is a small multi-color flag glyph, not a line icon, and is sized as its own inline SVG next to the button text.
- **No test framework exists for this static site.** Every verification step is a manual browser check with an explicit pass/fail criterion, run by opening the relevant HTML file directly (`file://` URL) — no server required.

---

## Task 1: `study-abroad.html` page shell (head, header, mobile nav, footer, hero, closing CTA)

**Files:**
- Create: `study-abroad.html`

**Interfaces:**
- Produces: the file `study-abroad.html` with `<main id="top">` containing the hero (`.sa-hero`) as its first section and the closing CTA band as its last section — Tasks 3, 4, and 5 each insert one new `<section>` between those two, inside `<main>`.
- Consumes: nothing from other tasks (this is the first task).

- [ ] **Step 1: Create `study-abroad.html`**

Create the file with this exact content:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="theme-color" content="#00753E" />
<title>Study in Malaysia: CERTA& Advisory</title>
<meta name="description" content="CERTA& Advisory's Study Abroad service: university and course selection, EMGS visa processing, accommodation, and airport pickup for students studying in Malaysia." />
<link rel="icon" href="assets/favicon.ico" sizes="any" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="assets/styles.css" />
<script>document.documentElement.classList.add('js');</script>
</head>
<body>

<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <symbol id="certa-mark" viewBox="0 0 100 100">
    <path class="certa-mark__ring" pathLength="1" d="M 81.93 66.62 A 36 36 0 1 1 81.93 33.38" fill="none" stroke="var(--certa-green)" stroke-width="12" stroke-linecap="round"/>
    <rect class="certa-mark__dash" x="80" y="44" width="17" height="12" rx="6" fill="var(--signal-coral)"/>
  </symbol>
</svg>

<div class="preloader" id="preloader" role="status" aria-live="polite">
  <div class="preloader__inner">
    <svg class="preloader__mark" viewBox="0 0 100 100" aria-hidden="true">
      <path class="certa-mark__ring" pathLength="1" d="M 81.93 66.62 A 36 36 0 1 1 81.93 33.38" fill="none" stroke="var(--certa-green)" stroke-width="12" stroke-linecap="round"/>
      <rect class="certa-mark__dash" x="80" y="44" width="17" height="12" rx="6" fill="var(--signal-coral)"/>
    </svg>
  </div>
  <span class="preloader__sr">Loading CERTA&amp; Advisory…</span>
</div>

<header class="site-header">
  <div class="container site-header__bar">
    <a class="brand" href="index.html" aria-label="CERTA&amp; Advisory home">
      <img src="assets/certa-lockup.png" alt="CERTA&amp; Advisory" />
    </a>

    <nav class="primary-nav" aria-label="Primary">
      <a href="index.html#services">Services</a>
      <a href="index.html#why-us">Why Us</a>
      <a href="index.html#team">Team</a>
      <a href="index.html#clients">Clients</a>
      <a href="index.html#faq">FAQ</a>
      <a href="index.html#careers">Careers</a>
      <a href="#top">Study Abroad</a>
      <a href="index.html#contact">Contact</a>
    </nav>

    <div class="header-cta">
      <a class="btn btn-primary" href="index.html#contact">Get a Quote</a>
      <button class="nav-toggle" id="navToggle" aria-label="Open menu" aria-expanded="false" aria-controls="mobileNav">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
    </div>
  </div>
  <span class="nav-progress" aria-hidden="true"></span>
</header>

<div class="mobile-nav" id="mobileNav">
  <div class="mobile-nav__top">
    <svg class="certa-mark-use" viewBox="0 0 100 100" aria-hidden="true" style="height:32px;width:32px"><use href="#certa-mark"></use></svg>
    <button class="nav-toggle" id="navClose" aria-label="Close menu" style="display:inline-flex">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="4" x2="20" y2="20"/><line x1="20" y1="4" x2="4" y2="20"/></svg>
    </button>
  </div>
  <ul class="mobile-nav__links">
    <li><a href="index.html#services">Services</a></li>
    <li><a href="index.html#why-us">Why Us</a></li>
    <li><a href="index.html#team">Team</a></li>
    <li><a href="index.html#clients">Clients</a></li>
    <li><a href="index.html#faq">FAQ</a></li>
    <li><a href="index.html#careers">Careers</a></li>
    <li><a href="#top">Study Abroad</a></li>
    <li><a href="index.html#contact">Contact</a></li>
  </ul>
  <a class="btn btn-primary" style="margin-top: 32px; justify-content: center;" href="index.html#contact">Get a Quote</a>
</div>

<main id="top">

  <section class="section sa-hero">
    <div class="container">
      <div class="sa-hero__inner" data-reveal>
        <h1>Study in Malaysia.</h1>
        <p class="lede">A second service from CERTA&amp; Advisory: university placement, EMGS visa processing, and on-the-ground support for students heading to Malaysia.</p>
        <a class="btn btn-coral" href="mailto:info@certaadvisory.com?subject=Study%20Abroad%20-%20Malaysia">Talk to a counsellor</a>
      </div>
    </div>
  </section>

  <section class="section" id="sa-contact">
    <div class="container">
      <div class="cta-band" data-reveal>
        <div>
          <h2>Ready to talk about studying in Malaysia?</h2>
          <p>Tell us your target course and intake, and we'll walk you through university options, timelines, and what EMGS processing involves.</p>
          <svg class="cta-mark" viewBox="0 0 100 100" aria-hidden="true">
            <path class="certa-mark__ring" pathLength="1" d="M 81.93 66.62 A 36 36 0 1 1 81.93 33.38" fill="none" stroke="var(--certa-green)" stroke-width="12" stroke-linecap="round"/>
            <rect class="certa-mark__dash" x="80" y="44" width="17" height="12" rx="6" fill="var(--signal-coral)"/>
          </svg>
        </div>
        <div class="cta-band__actions">
          <a class="btn btn-coral" href="mailto:info@certaadvisory.com?subject=Study%20Abroad%20-%20Malaysia">Talk to a counsellor</a>
          <a class="btn btn-ghost-onlight" href="index.html#contact">Back to CERTA&amp; Advisory</a>
        </div>
      </div>
    </div>
  </section>

</main>

<footer class="site-footer">
  <div class="container">
    <div class="footer__top">
      <div class="footer__brand">
        <img src="assets/certa-lockup-white.png" alt="CERTA&amp; Advisory" />
        <p>Accounting, bookkeeping, payroll and tax compliance services for companies and accounting practices across the UK, USA, Canada and Europe.</p>
      </div>
      <div class="footer__col">
        <h4>Services</h4>
        <ul>
          <li><a href="index.html#services">Accounting &amp; Bookkeeping</a></li>
          <li><a href="index.html#services">Payroll</a></li>
          <li><a href="index.html#services">VAT &amp; Tax Compliance</a></li>
          <li><a href="index.html#services">Year-End Accounts</a></li>
        </ul>
      </div>
      <div class="footer__col">
        <h4>Company</h4>
        <ul>
          <li><a href="index.html#why-us">Why Us</a></li>
          <li><a href="index.html#security">Security</a></li>
          <li><a href="index.html#process">Process</a></li>
          <li><a href="index.html#team">Team</a></li>
          <li><a href="index.html#clients">Clients</a></li>
          <li><a href="index.html#faq">FAQ</a></li>
          <li><a href="index.html#careers">Careers</a></li>
          <li><a href="#top">Study Abroad</a></li>
          <li><a href="index.html#contact">Contact</a></li>
        </ul>
      </div>
      <div class="footer__col">
        <h4>Office</h4>
        <address>
          81/A, Kakrail,<br />
          Dhaka-1000,<br />
          Bangladesh<br />
          <a href="tel:+8801911380938">+880 1911 380938</a><br />
          <a href="https://wa.me/8801911380938" target="_blank" rel="noopener">WhatsApp</a>
        </address>
      </div>
    </div>
    <div class="footer__bottom">
      <span>&copy; 2026 CERTA&amp; Advisory. All rights reserved.</span>
      <span>Dhaka, Bangladesh</span>
    </div>
  </div>
</footer>

<script src="assets/script.js"></script>
</body>
</html>
```

- [ ] **Step 2: Add the `.sa-hero` CSS**

In `assets/styles.css`, at the very end of the file, add:

```css

/* ---------- Study Abroad ---------- */
.sa-hero { padding-top: var(--space-xl); text-align: center; }
.sa-hero__inner { max-width: 640px; margin: 0 auto; }
.sa-hero__inner h1 {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(2.25rem, 4vw, 3.25rem);
  letter-spacing: -0.01em;
  line-height: 1.1;
  color: var(--ink);
}
.sa-hero__inner .lede { margin-top: var(--space-md); color: var(--ink-muted); font-size: 1.125rem; }
.sa-hero__inner .btn { margin-top: var(--space-lg); }
```

- [ ] **Step 3: Manual verification**

Open `study-abroad.html` directly in a browser (double-click, or its `file://` path). Check:

1. Page loads with no console errors, preloader clears, header/nav/footer render identically in style to `index.html` (same fonts, colors, spacing).
2. Hero shows "Study in Malaysia." heading, the subhead paragraph, and a "Talk to a counsellor" button.
3. Click "Talk to a counsellor" — **Pass:** opens your email client addressed to `info@certaadvisory.com` with subject "Study Abroad - Malaysia".
4. Click the brand logo (top-left) — **Pass:** navigates to `index.html`.
5. Click "Services" (or any other homepage-anchor nav item) — **Pass:** navigates to `index.html` and scrolls to that section.
6. Click "Study Abroad" in the nav — **Pass:** scrolls to the top of the current page (no navigation away).
7. Open the mobile menu (narrow the browser or use devtools device toolbar, click the hamburger icon) — **Pass:** the same links appear and work identically to the desktop nav.
8. Scroll to the bottom — **Pass:** footer renders with the same 4 columns as `index.html`, "Study Abroad" appears in the Company list and scrolls to page top when clicked, phone/WhatsApp links work.
9. Scroll to the closing CTA band at the bottom of `<main>` — **Pass:** "Talk to a counsellor" opens the same mailto link as the hero's; "Back to CERTA& Advisory" navigates to `index.html#contact`.

- [ ] **Step 4: Commit**

```bash
cd "E:\CERTA ADVISORY"
git add study-abroad.html assets/styles.css
git commit -m "Add Study Abroad page shell (head, nav, footer, hero, closing CTA)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Homepage teaser section + nav updates on `index.html`

**Files:**
- Modify: `index.html:41-49` (`.primary-nav`)
- Modify: `index.html:61-78` (`#mobileNav`)
- Modify: `index.html` (new `#study-abroad` section, inserted between the Careers section and the Contact section)
- Modify: `index.html:709-720` (footer Company `<ul>`)
- Modify: `assets/styles.css` (new `.sa-teaser` rules)

**Interfaces:**
- Consumes: `study-abroad.html` (Task 1) as the link target.
- Produces: nothing further tasks depend on (Tasks 3-7 only touch `study-abroad.html`).

- [ ] **Step 1: Add "Study Abroad" to the desktop primary nav**

In `index.html`, find:

```html
      <a href="#careers">Careers</a>
      <a href="#contact">Contact</a>
    </nav>
```

Replace with:

```html
      <a href="#careers">Careers</a>
      <a href="study-abroad.html">Study Abroad</a>
      <a href="#contact">Contact</a>
    </nav>
```

- [ ] **Step 2: Add "Study Abroad" to the mobile nav**

Find:

```html
    <li><a href="#careers">Careers</a></li>
    <li><a href="#contact">Contact</a></li>
  </ul>
```

Replace with:

```html
    <li><a href="#careers">Careers</a></li>
    <li><a href="study-abroad.html">Study Abroad</a></li>
    <li><a href="#contact">Contact</a></li>
  </ul>
```

- [ ] **Step 3: Add "Study Abroad" to the footer Company list**

Find:

```html
          <li><a href="#careers">Careers</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
      </div>
      <div class="footer__col">
        <h4>Office</h4>
```

Replace with:

```html
          <li><a href="#careers">Careers</a></li>
          <li><a href="study-abroad.html">Study Abroad</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
      </div>
      <div class="footer__col">
        <h4>Office</h4>
```

- [ ] **Step 4: Add the `#study-abroad` teaser section**

Find the closing of the Careers section and the opening of the Contact section:

```html
  </section>

  <section class="section" id="contact">
```

Replace with (inserting the new section between them):

```html
  </section>

  <section class="section" id="study-abroad">
    <div class="container container--narrow">
      <div class="section__head" style="grid-template-columns: 1fr; max-width: 640px;">
        <h2 data-reveal>Study in Malaysia.</h2>
        <p class="prose" data-reveal style="--reveal-delay:80">A second service from CERTA&amp; Advisory: university placement, EMGS visa processing, and on-the-ground support for students heading to Malaysia.</p>
      </div>
      <a class="btn btn-coral sa-teaser__btn" href="study-abroad.html" data-reveal style="--reveal-delay:160">
        <svg class="sa-teaser__flag" viewBox="0 0 30 20" aria-hidden="true">
          <rect width="30" height="20" fill="#fff"/>
          <rect y="0" width="30" height="2.86" fill="#CC0001"/>
          <rect y="5.71" width="30" height="2.86" fill="#CC0001"/>
          <rect y="11.43" width="30" height="2.86" fill="#CC0001"/>
          <rect y="17.14" width="30" height="2.86" fill="#CC0001"/>
          <rect width="15" height="10" fill="#010066"/>
          <circle cx="7.5" cy="5" r="3" fill="#FFCC00"/>
          <circle cx="8.7" cy="5" r="3" fill="#010066"/>
          <path d="M11.5 2.5 12.2 4.2 14 4.4 12.6 5.6 13 7.4 11.5 6.4 10 7.4 10.4 5.6 9 4.4 10.8 4.2Z" fill="#FFCC00"/>
        </svg>
        Study in Malaysia
      </a>
    </div>
  </section>

  <section class="section" id="contact">
```

- [ ] **Step 5: Style the teaser section**

In `assets/styles.css`, in the `/* ---------- Study Abroad ---------- */` block added in Task 1, add:

```css
.sa-teaser__btn { display: inline-flex; align-items: center; gap: 10px; margin-top: var(--space-lg); }
.sa-teaser__flag { width: 22px; height: auto; border-radius: 3px; flex: none; }
```

- [ ] **Step 6: Manual verification**

Open `index.html` in a browser. Check:

1. Scroll to (or click "Study Abroad" in the nav to jump to) the new section, positioned between Careers and Contact. **Pass:** heading "Study in Malaysia.", subhead paragraph, and a coral button reading "Study in Malaysia" with a small flag icon to its left.
2. Click the "Study in Malaysia" button — **Pass:** navigates to `study-abroad.html`.
3. Check the desktop nav, mobile nav (narrow the viewport), and footer Company list — **Pass:** all three show a "Study Abroad" link that navigates to `study-abroad.html`.
4. Confirm the rest of the homepage (Careers section above, Contact section below) is unchanged.

- [ ] **Step 7: Commit**

```bash
cd "E:\CERTA ADVISORY"
git add index.html assets/styles.css
git commit -m "Add Study Abroad homepage teaser section and nav links

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: About / Services section (7 services) on `study-abroad.html`

**Files:**
- Modify: `study-abroad.html` (insert new `<section id="sa-services">` between the hero and the closing CTA band)

**Interfaces:**
- Consumes: `.service-row`/`.service-row__mark`/`.service-list` classes (existing, from `assets/styles.css:558-…`) — reused as-is, not modified. No CSS changes in this task — every visual need is already met by the existing classes.
- Produces: nothing further tasks depend on.

- [ ] **Step 1: Insert the Services section**

In `study-abroad.html`, find:

```html
  </section>

  <section class="section" id="sa-contact">
```

Replace with:

```html
  </section>

  <section class="section section--tint" id="sa-services">
    <div class="container">
      <div class="section__head">
        <h2 data-reveal>Everything from shortlist to touchdown.</h2>
        <p class="prose" data-reveal style="--reveal-delay:80">University and course selection, visa processing, and the logistics around getting there and settling in, handled end to end.</p>
      </div>

      <div class="service-list">
        <div class="service-row" data-reveal style="--reveal-delay:0">
          <div class="service-row__mark">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>
          </div>
          <h3>University Selection</h3>
          <p>Matching your academic background and goals against the right university, not just the first offer.</p>
        </div>

        <div class="service-row" data-reveal style="--reveal-delay:40">
          <div class="service-row__mark">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          </div>
          <h3>Course Selection</h3>
          <p>Narrowing down programs and intake dates once the university shortlist is set.</p>
        </div>

        <div class="service-row" data-reveal style="--reveal-delay:80">
          <div class="service-row__mark">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg>
          </div>
          <h3>Counselling</h3>
          <p>One-to-one guidance through every decision, from application to departure.</p>
        </div>

        <div class="service-row" data-reveal style="--reveal-delay:120">
          <div class="service-row__mark">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></svg>
          </div>
          <h3>Legal Documents Processing</h3>
          <p>Preparing and submitting the paperwork your application and EMGS visa require.</p>
        </div>

        <div class="service-row" data-reveal style="--reveal-delay:160">
          <div class="service-row__mark">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>
          </div>
          <h3>Accommodation Solutions</h3>
          <p>Arranging on-campus or off-campus housing before you arrive.</p>
        </div>

        <div class="service-row" data-reveal style="--reveal-delay:200">
          <div class="service-row__mark">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-1 .1-1.3.5l-.7.7c-.4.4-.3 1.1.2 1.4l5.9 3.5-2.2 3.3-3.2-.1c-.3 0-.7.1-.9.4l-.5.5c-.4.4-.3 1 .1 1.3l3.4 2.3 2.3 3.4c.3.4.9.5 1.3.1l.5-.5c.3-.2.4-.6.4-.9l-.1-3.2 3.3-2.2 3.5 5.9c.3.5 1 .6 1.4.2l.7-.7c.4-.3.6-.8.5-1.3z"/></svg>
          </div>
          <h3>Air Ticketing</h3>
          <p>Booking your flight to Malaysia once your visa and enrolment are confirmed.</p>
        </div>

        <div class="service-row" data-reveal style="--reveal-delay:240">
          <div class="service-row__mark">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2v-4l-2.5-5.5A2 2 0 0 0 16.7 6H7.3a2 2 0 0 0-1.8 1.5L3 13v4h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M5 17h2M17 17h2M9 17h6"/></svg>
          </div>
          <h3>Airport Pickup &amp; Dropoff at Malaysia</h3>
          <p>Meeting you at the airport and getting you to your accommodation on arrival.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="sa-contact">
```

- [ ] **Step 2: Manual verification**

Open `study-abroad.html`. Check:

1. Below the hero, a tinted section shows heading "Everything from shortlist to touchdown." and a subhead.
2. All 7 services render as rows, each with an icon, a bold title, and a description, in this order: University Selection, Course Selection, Counselling, Legal Documents Processing, Accommodation Solutions, Air Ticketing, Airport Pickup & Dropoff at Malaysia.
3. Icons are visually distinct from each other (cap, book, chat bubble, checked file, house, plane, car) and match the style of icons elsewhere on the site (thin outline, rounded ends).
4. Resize to mobile width — **Pass:** rows stack correctly with no overflow (same responsive behavior as the homepage's Services section, since this reuses the identical `.service-row` CSS).

- [ ] **Step 3: Commit**

```bash
cd "E:\CERTA ADVISORY"
git add study-abroad.html
git commit -m "Add Study Abroad services section (7 services)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: EMGS section on `study-abroad.html`

**Files:**
- Modify: `study-abroad.html` (insert new `<section id="sa-emgs">` between the Services section and the closing CTA band)
- Modify: `assets/styles.css` (`.sa-emgs__*` rules)

**Interfaces:**
- Produces: `.sa-emgs__logo` — a `<span class="credential-chip">` placeholder in this task, replaced with a real `<img class="sa-emgs__logo">` by Task 7. Task 7 must preserve the `sa-emgs__logo` class name so no CSS changes are needed when the swap happens.

- [ ] **Step 1: Insert the EMGS section**

In `study-abroad.html`, find:

```html
  </section>

  <section class="section" id="sa-contact">
```

(This is now preceded by the Services section from Task 3 — the same closing/opening pair still marks the insertion point, since each task inserts immediately before `id="sa-contact"`.) Replace with:

```html
  </section>

  <section class="section" id="sa-emgs">
    <div class="container container--narrow">
      <div class="sa-emgs__inner" data-reveal>
        <span class="sa-emgs__logo credential-chip">EMGS</span>
        <h2>Your visa, handled by people who do this daily.</h2>
        <p class="prose">EMGS (Education Malaysia Global Services) is the Malaysian government body responsible for processing international student visas and passes. We handle your EMGS visa and pass processing on your behalf, so the paperwork isn't something you have to navigate alone.</p>
      </div>
    </div>
  </section>

  <section class="section" id="sa-contact">
```

- [ ] **Step 2: Style the EMGS section**

In `assets/styles.css`, in the `/* ---------- Study Abroad ---------- */` block, add:

```css
.sa-emgs__inner { text-align: center; max-width: 720px; margin: 0 auto; }
.sa-emgs__logo { margin-bottom: var(--space-md); }
.sa-emgs__inner h2 { font-size: clamp(1.75rem, 2.6vw, 2.5rem); font-weight: 600; letter-spacing: -0.01em; margin-bottom: var(--space-sm); }
```

- [ ] **Step 3: Manual verification**

Open `study-abroad.html`. Check:

1. Below the Services section, a section shows a small "EMGS" chip, a heading "Your visa, handled by people who do this daily.", and a paragraph explaining what EMGS is and CERTA& Advisory's role.
2. Content is centered and reads clearly at both desktop and mobile widths.

- [ ] **Step 4: Commit**

```bash
cd "E:\CERTA ADVISORY"
git add study-abroad.html assets/styles.css
git commit -m "Add Study Abroad EMGS section (logo placeholder pending Task 7)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: University showcase — rail + 14 grouped full cards

**Files:**
- Modify: `study-abroad.html` (insert new `<section id="sa-universities">` between the EMGS section and the closing CTA band)
- Modify: `assets/styles.css` (`.sa-rail*`, `.sa-uni-*` rules)

**Interfaces:**
- Produces:
  - `.sa-rail__avatar` — anchor links (`href="#uni-{slug}"`), one per university, consumed by Task 6's JS (`querySelectorAll('.sa-rail__avatar')`).
  - `.sa-uni-card` elements, each with a unique `id="uni-{slug}"` matching a rail avatar's href — consumed by Task 6's JS (`document.getElementById(targetId)`) and by Task 7 (which swaps each card's `.sa-uni-card__logo` placeholder for a real `<img>`).
  - The 14 slugs, in order: `monash`, `nottingham`, `southampton`, `heriot-watt`, `curtin`, `um`, `ukm`, `upm`, `usm`, `utm`, `uitm`, `taylors`, `ucsi`, `cyberjaya`.
- Consumes: `.credential-chip` (existing) for both rail-avatar and card-logo placeholders.

- [ ] **Step 1: Insert the university rail + grouped cards**

In `study-abroad.html`, find:

```html
  </section>

  <section class="section" id="sa-contact">
```

(Now preceded by the EMGS section from Task 4.) Replace with:

```html
  </section>

  <section class="section section--tint" id="sa-universities">
    <div class="container">
      <div class="section__head">
        <h2 data-reveal>14 universities, one point of contact.</h2>
        <p class="prose" data-reveal style="--reveal-delay:80">Browse by tapping a university below, or scroll straight to the full list.</p>
      </div>

      <div class="sa-rail" aria-label="Jump to a university">
        <a class="sa-rail__avatar" href="#uni-monash"><span class="sa-rail__mark credential-chip">MU</span><span class="sa-rail__name">Monash</span></a>
        <a class="sa-rail__avatar" href="#uni-nottingham"><span class="sa-rail__mark credential-chip">UN</span><span class="sa-rail__name">Nottingham</span></a>
        <a class="sa-rail__avatar" href="#uni-southampton"><span class="sa-rail__mark credential-chip">US</span><span class="sa-rail__name">Southampton</span></a>
        <a class="sa-rail__avatar" href="#uni-heriot-watt"><span class="sa-rail__mark credential-chip">HW</span><span class="sa-rail__name">Heriot-Watt</span></a>
        <a class="sa-rail__avatar" href="#uni-curtin"><span class="sa-rail__mark credential-chip">CU</span><span class="sa-rail__name">Curtin</span></a>
        <a class="sa-rail__avatar" href="#uni-um"><span class="sa-rail__mark credential-chip">UM</span><span class="sa-rail__name">Malaya</span></a>
        <a class="sa-rail__avatar" href="#uni-ukm"><span class="sa-rail__mark credential-chip">UKM</span><span class="sa-rail__name">UKM</span></a>
        <a class="sa-rail__avatar" href="#uni-upm"><span class="sa-rail__mark credential-chip">UPM</span><span class="sa-rail__name">UPM</span></a>
        <a class="sa-rail__avatar" href="#uni-usm"><span class="sa-rail__mark credential-chip">USM</span><span class="sa-rail__name">USM</span></a>
        <a class="sa-rail__avatar" href="#uni-utm"><span class="sa-rail__mark credential-chip">UTM</span><span class="sa-rail__name">UTM</span></a>
        <a class="sa-rail__avatar" href="#uni-uitm"><span class="sa-rail__mark credential-chip">UiTM</span><span class="sa-rail__name">UiTM</span></a>
        <a class="sa-rail__avatar" href="#uni-taylors"><span class="sa-rail__mark credential-chip">TU</span><span class="sa-rail__name">Taylor's</span></a>
        <a class="sa-rail__avatar" href="#uni-ucsi"><span class="sa-rail__mark credential-chip">UCSI</span><span class="sa-rail__name">UCSI</span></a>
        <a class="sa-rail__avatar" href="#uni-cyberjaya"><span class="sa-rail__mark credential-chip">UoC</span><span class="sa-rail__name">Cyberjaya</span></a>
      </div>

      <div class="sa-uni-group" data-reveal>
        <h3 class="sa-uni-group__label">International Branch Campuses</h3>
        <div class="sa-uni-grid">
          <div class="sa-uni-card" id="uni-monash">
            <span class="sa-uni-card__logo credential-chip">MU</span>
            <h4>Monash University Malaysia</h4>
            <p class="sa-uni-card__location">Bandar Sunway, Selangor</p>
            <p>Australian research university's Malaysia campus.</p>
          </div>
          <div class="sa-uni-card" id="uni-nottingham">
            <span class="sa-uni-card__logo credential-chip">UN</span>
            <h4>University of Nottingham Malaysia</h4>
            <p class="sa-uni-card__location">Semenyih, Selangor</p>
            <p>UK Russell Group university's Malaysia campus.</p>
          </div>
          <div class="sa-uni-card" id="uni-southampton">
            <span class="sa-uni-card__logo credential-chip">US</span>
            <h4>University of Southampton Malaysia</h4>
            <p class="sa-uni-card__location">Iskandar Puteri, Johor</p>
            <p>UK research university, engineering-focused Malaysia campus.</p>
          </div>
          <div class="sa-uni-card" id="uni-heriot-watt">
            <span class="sa-uni-card__logo credential-chip">HW</span>
            <h4>Heriot-Watt University Malaysia</h4>
            <p class="sa-uni-card__location">Putrajaya</p>
            <p>Scottish university's Malaysia campus, strong in engineering and business.</p>
          </div>
          <div class="sa-uni-card" id="uni-curtin">
            <span class="sa-uni-card__logo credential-chip">CU</span>
            <h4>Curtin University Malaysia</h4>
            <p class="sa-uni-card__location">Miri, Sarawak</p>
            <p>Australian university's East Malaysia campus.</p>
          </div>
        </div>
      </div>

      <div class="sa-uni-group" data-reveal>
        <h3 class="sa-uni-group__label">Malaysian Public Universities</h3>
        <div class="sa-uni-grid">
          <div class="sa-uni-card" id="uni-um">
            <span class="sa-uni-card__logo credential-chip">UM</span>
            <h4>Universiti Malaya (UM)</h4>
            <p class="sa-uni-card__location">Kuala Lumpur</p>
            <p>Malaysia's oldest and top-ranked research university.</p>
          </div>
          <div class="sa-uni-card" id="uni-ukm">
            <span class="sa-uni-card__logo credential-chip">UKM</span>
            <h4>Universiti Kebangsaan Malaysia (UKM)</h4>
            <p class="sa-uni-card__location">Bangi, Selangor</p>
            <p>Malaysia's national university.</p>
          </div>
          <div class="sa-uni-card" id="uni-upm">
            <span class="sa-uni-card__logo credential-chip">UPM</span>
            <h4>Universiti Putra Malaysia (UPM)</h4>
            <p class="sa-uni-card__location">Seri Kembangan, Selangor</p>
            <p>Known for agriculture and research.</p>
          </div>
          <div class="sa-uni-card" id="uni-usm">
            <span class="sa-uni-card__logo credential-chip">USM</span>
            <h4>Universiti Sains Malaysia (USM)</h4>
            <p class="sa-uni-card__location">George Town, Penang</p>
            <p>Renowned science university.</p>
          </div>
          <div class="sa-uni-card" id="uni-utm">
            <span class="sa-uni-card__logo credential-chip">UTM</span>
            <h4>Universiti Teknologi Malaysia (UTM)</h4>
            <p class="sa-uni-card__location">Skudai, Johor</p>
            <p>Specialises in engineering and technology.</p>
          </div>
          <div class="sa-uni-card" id="uni-uitm">
            <span class="sa-uni-card__logo credential-chip">UiTM</span>
            <h4>Universiti Teknologi MARA (UiTM)</h4>
            <p class="sa-uni-card__location">Shah Alam, Selangor</p>
            <p>Malaysia's largest public university system.</p>
          </div>
        </div>
      </div>

      <div class="sa-uni-group" data-reveal>
        <h3 class="sa-uni-group__label">Malaysian Private Universities</h3>
        <div class="sa-uni-grid">
          <div class="sa-uni-card" id="uni-taylors">
            <span class="sa-uni-card__logo credential-chip">TU</span>
            <h4>Taylor's University</h4>
            <p class="sa-uni-card__location">Subang Jaya, Selangor</p>
            <p>Globally ranked, with programs from foundation through PhD level.</p>
          </div>
          <div class="sa-uni-card" id="uni-ucsi">
            <span class="sa-uni-card__logo credential-chip">UCSI</span>
            <h4>UCSI University</h4>
            <p class="sa-uni-card__location">Kuala Lumpur</p>
            <p>Broad program range across business, engineering, medicine, and the arts.</p>
          </div>
          <div class="sa-uni-card" id="uni-cyberjaya">
            <span class="sa-uni-card__logo credential-chip">UoC</span>
            <h4>University of Cyberjaya</h4>
            <p class="sa-uni-card__location">Cyberjaya, Selangor</p>
            <p>Industry-aligned, hands-on education in Malaysia's tech hub.</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="sa-contact">
```

- [ ] **Step 2: Style the rail and grouped cards**

In `assets/styles.css`, in the `/* ---------- Study Abroad ---------- */` block, add:

```css
.sa-rail {
  display: flex;
  gap: var(--space-md);
  overflow-x: auto;
  padding: var(--space-md) 4px var(--space-lg);
  margin-bottom: var(--space-lg);
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
}
.sa-rail__avatar { flex: none; display: flex; flex-direction: column; align-items: center; gap: 8px; text-decoration: none; color: var(--ink); scroll-snap-align: start; }
.sa-rail__mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 2px solid var(--border);
  background: var(--white);
  padding: 0;
  transition: border-color 200ms var(--ease-standard);
}
.sa-rail__avatar:hover .sa-rail__mark,
.sa-rail__avatar:focus-visible .sa-rail__mark { border-color: var(--certa-green); }
.sa-rail__name { font-size: 0.75rem; font-weight: 600; max-width: 64px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.sa-uni-group { margin-top: var(--space-xl); }
.sa-uni-group:first-of-type { margin-top: 0; }
.sa-uni-group__label { font-size: 1.0625rem; font-weight: 600; margin-bottom: var(--space-md); }
.sa-uni-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-md); }
.sa-uni-card {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  scroll-margin-top: 100px;
  transition: box-shadow 300ms var(--ease-standard), border-color 300ms var(--ease-standard);
}
.sa-uni-card__logo { margin-bottom: var(--space-sm); }
.sa-uni-card h4 { font-size: 1.0625rem; font-weight: 600; }
.sa-uni-card__location { font-size: 0.8125rem; color: var(--ink-muted); margin-top: 2px; margin-bottom: var(--space-sm); }
.sa-uni-card p:last-child { color: var(--ink-muted); font-size: 0.9375rem; }
.sa-uni-card--highlight { border-color: var(--certa-green); box-shadow: 0 0 0 3px var(--certa-green-tint); }
```

- [ ] **Step 3: Manual verification**

Open `study-abroad.html`. Check:

1. Below the EMGS section, a tinted section shows heading "14 universities, one point of contact." and a horizontal, scrollable row of 14 circular avatars with initials and short names.
2. Below the rail, three grouped headings appear in order — "International Branch Campuses" (5 cards), "Malaysian Public Universities" (6 cards), "Malaysian Private Universities" (3 cards) — 14 cards total, each showing initials, full name, location, and a one-line description.
3. Click each rail avatar in turn — **Pass:** the page jumps to the matching card below (native anchor behavior; JS enhancement comes in Task 6).
4. Resize to mobile width — **Pass:** the rail still scrolls horizontally; the card grids collapse toward a single column with no overflow.

- [ ] **Step 4: Commit**

```bash
cd "E:\CERTA ADVISORY"
git add study-abroad.html assets/styles.css
git commit -m "Add Study Abroad university rail and grouped detail cards (14 universities)

Logos are credential-chip placeholders pending Task 7's sourcing pass.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Rail → scroll + highlight JS behavior

**Files:**
- Modify: `assets/script.js` (append new block at the end of the file)

**Interfaces:**
- Consumes: `.sa-rail__avatar` (from Task 5, `href="#uni-{slug}"`), `.sa-uni-card` (from Task 5, `id="uni-{slug}"`), `.sa-uni-card--highlight` (CSS class from Task 5), the existing top-of-file `reducedMotion` constant (`assets/script.js:1`).
- Produces: nothing further tasks depend on.

- [ ] **Step 1: Append the rail-click behavior**

At the end of `assets/script.js`, add:

```javascript

// ---------- Study Abroad: rail avatar -> card scroll + highlight ----------
const saRailLinks = document.querySelectorAll('.sa-rail__avatar');
if (saRailLinks.length) {
  saRailLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href').slice(1);
      const target = document.getElementById(targetId);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
      target.classList.add('sa-uni-card--highlight');
      window.setTimeout(() => target.classList.remove('sa-uni-card--highlight'), 1600);
    });
  });
}
```

This is progressive enhancement only: if `saRailLinks` is empty (e.g. this script ever loads on a page without the rail), the block does nothing. If JS fails to load at all, the plain `href="#uni-{slug}"` anchors from Task 5 still work as native browser jumps — `e.preventDefault()` only runs once JS has already found a matching target, so there's no broken-link case.

- [ ] **Step 2: Manual verification**

Open `study-abroad.html`. Check:

1. Click each of the 14 rail avatars in turn. **Pass:** the page smooth-scrolls to the matching card (not an instant jump), and that card gets a visible green outline/glow for about 1.5 seconds before fading back to normal.
2. Open your OS/browser's reduced-motion setting (or use devtools to emulate `prefers-reduced-motion: reduce`), reload, and click a rail avatar again. **Pass:** the page still jumps to the correct card, but instantly (no smooth animation) — matching the site's existing reduced-motion behavior elsewhere.
3. Open the browser devtools console and confirm no errors appear on page load or on any of the 14 clicks.

- [ ] **Step 3: Commit**

```bash
cd "E:\CERTA ADVISORY"
git add assets/script.js
git commit -m "Add rail-avatar smooth-scroll + highlight behavior for Study Abroad

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Source real logos for EMGS and all 14 universities

**Files:**
- Create: `assets/study-abroad/logos/*` (one file per institution successfully sourced)
- Modify: `study-abroad.html:` the `sa-emgs__logo` span (from Task 4) and each of the 14 `.sa-uni-card__logo` / `.sa-rail__mark` spans (from Task 5)
- Modify: `assets/styles.css` (add an `img`-specific rule for the now-mixed chip/image logo slots)

**Interfaces:**
- Consumes: `.sa-emgs__logo`, `.sa-uni-card__logo`, `.sa-rail__mark` class names and the `id`/slug scheme from Tasks 4 and 5 — this task only changes what's *inside* those elements (chip text → `<img>`), never the surrounding class names, so no other file needs to change.

- [ ] **Step 1: Source EMGS's logo**

Visit EMGS's official website (`educationmalaysia.gov.my` or the current official EMGS domain — confirm via a web search if that domain has changed) and locate their official logo image (usually in the site header or an official media/brand-assets page). Download it. If a clean SVG or high-resolution PNG with a transparent or plain background is available, save it as `assets/study-abroad/logos/emgs.svg` (or `.png`). If nothing usable is found (broken links, only a tiny favicon, watermarked stock imagery), skip this step and leave EMGS on its `credential-chip` fallback — note this explicitly in your task report.

If sourced, replace in `study-abroad.html`:

```html
        <span class="sa-emgs__logo credential-chip">EMGS</span>
```

with:

```html
        <img class="sa-emgs__logo" src="assets/study-abroad/logos/emgs.svg" alt="EMGS (Education Malaysia Global Services) logo" width="120" height="40" loading="lazy">
```

(adjust the file extension to match what you actually saved).

- [ ] **Step 2: Source each university's logo**

For each of the 14 universities below, visit its official website, locate its official logo (usually in the site header, or a "brand"/"media kit" page), and download it. Use the exact filename shown — this is the slug scheme Task 5's `id`s already use, so keeping them aligned avoids any confusion about which file belongs to which card:

| University | Official site to check | Save as |
|---|---|---|
| Monash University Malaysia | monash.edu.my | `assets/study-abroad/logos/monash.svg` (or `.png`) |
| University of Nottingham Malaysia | nottingham.edu.my | `assets/study-abroad/logos/nottingham.svg` |
| University of Southampton Malaysia | southampton.edu.my | `assets/study-abroad/logos/southampton.svg` |
| Heriot-Watt University Malaysia | heriotwatt.edu.my | `assets/study-abroad/logos/heriot-watt.svg` |
| Curtin University Malaysia | curtin.edu.my | `assets/study-abroad/logos/curtin.svg` |
| Universiti Malaya (UM) | um.edu.my | `assets/study-abroad/logos/um.svg` |
| Universiti Kebangsaan Malaysia (UKM) | ukm.my | `assets/study-abroad/logos/ukm.svg` |
| Universiti Putra Malaysia (UPM) | upm.edu.my | `assets/study-abroad/logos/upm.svg` |
| Universiti Sains Malaysia (USM) | usm.my | `assets/study-abroad/logos/usm.svg` |
| Universiti Teknologi Malaysia (UTM) | utm.my | `assets/study-abroad/logos/utm.svg` |
| Universiti Teknologi MARA (UiTM) | uitm.edu.my | `assets/study-abroad/logos/uitm.svg` |
| Taylor's University | university.taylors.edu.my | `assets/study-abroad/logos/taylors.svg` |
| UCSI University | ucsiuniversity.edu.my | `assets/study-abroad/logos/ucsi.svg` |
| University of Cyberjaya | cyberjaya.edu.my | `assets/study-abroad/logos/cyberjaya.svg` |

(Confirm each domain is still current before fetching — universities occasionally change domains — and prefer `.svg` when the site offers one, falling back to the highest-resolution clean `.png` otherwise.)

For every university where a clean official logo was found, replace **both** its rail-avatar mark and its card logo in `study-abroad.html`. For example, for Monash, replace:

```html
        <a class="sa-rail__avatar" href="#uni-monash"><span class="sa-rail__mark credential-chip">MU</span><span class="sa-rail__name">Monash</span></a>
```

with:

```html
        <a class="sa-rail__avatar" href="#uni-monash"><span class="sa-rail__mark"><img src="assets/study-abroad/logos/monash.svg" alt="" width="32" height="32" loading="lazy"></span><span class="sa-rail__name">Monash</span></a>
```

(the rail image gets `alt=""` since `.sa-rail__name` right next to it already provides the accessible label — an empty alt avoids screen readers announcing the university name twice) and replace:

```html
            <span class="sa-uni-card__logo credential-chip">MU</span>
```

with:

```html
            <img class="sa-uni-card__logo" src="assets/study-abroad/logos/monash.svg" alt="Monash University Malaysia logo" width="48" height="48" loading="lazy">
```

Repeat for every university you successfully sourced a logo for. For any university where nothing usable was found, leave both its rail mark and card logo on the `credential-chip` fallback exactly as Task 5 left them — do not remove the fallback markup for those.

- [ ] **Step 3: Add image-specific logo styling**

In `assets/styles.css`, in the `/* ---------- Study Abroad ---------- */` block, add:

```css
.sa-rail__mark img { width: 32px; height: 32px; object-fit: contain; border-radius: 50%; }
img.sa-uni-card__logo, img.sa-emgs__logo { object-fit: contain; }
img.sa-uni-card__logo { width: 48px; height: 48px; }
img.sa-emgs__logo { max-width: 160px; max-height: 48px; }
```

- [ ] **Step 4: Manual verification**

Open `study-abroad.html`. Check:

1. For every institution where a real logo was sourced: the rail avatar and the matching card both show the actual logo image, not initials text — and both images are legible (not stretched, not cut off, not upside down).
2. For every institution where no logo was found (if any): both the rail avatar and the card still show the readable initials chip from Task 5 — nothing is broken or blank.
3. Open the browser devtools Network tab and reload — **Pass:** no 404s for any `assets/study-abroad/logos/*` file referenced in the HTML.
4. Re-run Task 6's rail-click checks (click a few avatars for institutions that now have real logos) — **Pass:** scroll-and-highlight still works exactly as before, since Task 6's JS only reads `href`/`id`, never the logo content.

- [ ] **Step 5: Write the sourcing report**

In your task report (not committed to the repo, just part of your response back to the controller), list plainly:
- Which institutions (if any) used the official-logo path successfully.
- Which institutions (if any) fell back to the `credential-chip` initials, and why (domain unreachable, no clean asset found, etc.).

- [ ] **Step 6: Commit**

```bash
cd "E:\CERTA ADVISORY"
git add study-abroad.html assets/styles.css assets/study-abroad/
git commit -m "Source and add real logos for EMGS and partner universities

See task report for which institutions (if any) remain on the
credential-chip text fallback.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

This is the final task in the plan — once Task 7's commit lands and is pushed, the Study Abroad page is complete and live.
