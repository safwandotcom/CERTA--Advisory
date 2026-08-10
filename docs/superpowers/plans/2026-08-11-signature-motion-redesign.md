# Signature Motion Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the six signature motion moments, the new "By the numbers" section, and the supporting nav/micro-interaction polish from `docs/superpowers/specs/2026-08-11-signature-motion-redesign-design.md` on the existing one-page marketing site, with zero new facts, zero new colors, and zero new runtime dependencies.

**Architecture:** Vanilla HTML/CSS/JS, no build step. The brand mark is reconstructed once as an inline SVG `<symbol>` (Task 1) and reused everywhere it currently appears as a PNG; every subsequent task builds on that plus the existing `[data-reveal]` / `[data-parallax]`/`[data-float]` / `[data-count-to]` systems already in `assets/script.js` and `assets/styles.css`, extending them rather than introducing parallel animation systems.

**Tech Stack:** Static HTML5, CSS custom properties (tokens in `assets/styles.css:1-37`), vanilla JS (`IntersectionObserver`, one shared `requestAnimationFrame` loop). No npm, no framework, no animation library (GSAP explicitly declined per the spec's brainstorming decisions).

## Global Constraints

- **Scope:** only `index.html`, `assets/styles.css`, `assets/script.js`, plus one edit to `DESIGN.md` (Task 10). The Next.js `portal/` is untouched.
- **No new runtime dependencies** — no npm packages, animation libraries, fonts, or build step.
- **No fabricated facts or copy changes** — every string of copy in this plan (including the new "By the numbers" section) is either verbatim-reused or a direct paraphrase of something already on the page today. No new colors are introduced — every color reference below is one of the existing custom properties (`--certa-green`, `--certa-green-deep`, `--signal-coral`, `--ink`, `--ink-muted`, `--border`, `--surface-tint`, `--white`).
- **Motion discipline:** every new animated element gets a `prefers-reduced-motion: reduce` fallback that shows its end state immediately, extending the pattern already established for `[data-reveal]` (`styles.css:91-110`), parallax/float (`styles.css:112-120`), and the process count-up (`script.js:194-235`). Pin/sticky-scroll and the new process line are disabled under `(max-width: 860px)` and `(hover: none)`, matching the project's existing `@media (max-width: 860px)` breakpoint.
- **No test framework exists for this static site.** As with the prior redesign plan, every task's verification step is a manual browser check with an explicit pass/fail criterion, run by opening `index.html` directly (or via `file://`) — no server required.
- **Brand mark sourcing note (Task 1):** `assets/certa-mark.png` was viewed directly to calibrate the inline SVG reconstruction's geometry (ring gap position/size, dash position/size) against the real artwork — it is a geometric reconstruction of the project's own simple two-part abstract mark (an open ring + a separate dash), not a guessed approximation of a third-party asset. The PNG/white-PNG variants remain in `assets/` for `<meta>`/favicon/OG-image contexts that require a raster format — this plan does not delete them.
- **Line-number caveat:** exact `index.html`/`styles.css` line numbers below are accurate as of the start of this plan. Because tasks are applied in order and each inserts or replaces lines, treat line numbers in Tasks 2 onward as approximate — locate the target by its surrounding selector/content (given in full in every step) rather than by line number alone.

---

## Task 1: Inline SVG brand mark — symbol definition + static usages

**Files:**
- Modify: `index.html:16-17` (insert new hidden `<svg>` symbol block right after `<body>`)
- Modify: `index.html:145-147` (hero mark)
- Modify: `index.html:344` (Why Us visual mark)
- Modify: `index.html:51` (mobile nav mark)
- Modify: `assets/styles.css:460-465` (`.hero__mark img`)
- Modify: `assets/styles.css:862` (`.hero__mark img` inside the `@media (max-width: 860px)` block)

**Interfaces:**
- Produces: `#certa-mark` SVG `<symbol>`, `.certa-mark-use` class, `.certa-mark__ring` / `.certa-mark__dash` class names — all reused by Task 2 (preloader), Task 3 (morph target), Task 4 (stat flourish), and Task 6 (CTA flourish).

- [ ] **Step 1: Insert the shared symbol definition**

In `index.html`, immediately after the opening `<body>` tag (before the `<div class="preloader" ...>` block), insert:

```html
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <symbol id="certa-mark" viewBox="0 0 100 100">
    <path class="certa-mark__ring" pathLength="1" d="M 81.93 66.62 A 36 36 0 1 1 81.93 33.38" fill="none" stroke="var(--certa-green)" stroke-width="12" stroke-linecap="round"/>
    <rect class="certa-mark__dash" x="80" y="44" width="17" height="12" rx="6" fill="var(--signal-coral)"/>
  </symbol>
</svg>
```

This traces an open ring (36-radius arc from 27.5° to 332.5°, i.e. a 55° gap centered at the 3-o'clock point, matching the real mark's gap) plus a short rounded coral bar sitting in that gap — calibrated against `assets/certa-mark.png`. `pathLength="1"` normalizes the ring path's length to exactly `1`, so later tasks can animate `stroke-dasharray`/`stroke-dashoffset` as simple 0-1 fractions regardless of the actual arc length.

- [ ] **Step 2: Add the base `.certa-mark-use` style**

In `assets/styles.css`, immediately after the `.sr-only` rule (`styles.css:87`), add:

```css
.certa-mark-use { display: block; height: auto; }
```

- [ ] **Step 3: Swap the hero mark**

In `index.html`, replace (`index.html:145-147`):

```html
      <div class="hero__mark" data-reveal style="--reveal-delay:200">
        <img src="assets/certa-mark.png" alt="" data-parallax data-speed="-0.16" data-float data-float-amp="26" data-float-period="3.4" data-float-rotate="6" />
      </div>
```

with:

```html
      <div class="hero__mark" data-reveal style="--reveal-delay:200">
        <svg class="certa-mark-use" viewBox="0 0 100 100" aria-hidden="true" data-parallax data-speed="-0.16" data-float data-float-amp="26" data-float-period="3.4" data-float-rotate="6"><use href="#certa-mark"></use></svg>
      </div>
```

In `assets/styles.css`, change both occurrences of the selector `.hero__mark img` (`styles.css:460` and `styles.css:862`, the latter inside `@media (max-width: 860px)`) to `.hero__mark svg` — the declarations inside each rule stay exactly as they are today.

- [ ] **Step 4: Swap the Why Us visual mark**

In `index.html`, replace (`index.html:344`):

```html
          <img class="why-us__mark" src="assets/certa-mark.png" alt="" data-float data-float-amp="16" data-float-period="4" />
```

with:

```html
          <svg class="why-us__mark certa-mark-use" viewBox="0 0 100 100" aria-hidden="true" data-float data-float-amp="16" data-float-period="4"><use href="#certa-mark"></use></svg>
```

No CSS change needed here — the existing `.why-us__mark { position: relative; z-index: 1; width: 46%; }` rule (`styles.css:688`) is tag-agnostic and applies to the `<svg>` exactly as it did to the `<img>`.

- [ ] **Step 5: Swap the mobile nav mark**

In `index.html`, replace (`index.html:51`):

```html
    <img src="assets/certa-mark.png" alt="" style="height:32px" />
```

with:

```html
    <svg class="certa-mark-use" viewBox="0 0 100 100" aria-hidden="true" style="height:32px;width:32px"><use href="#certa-mark"></use></svg>
```

- [ ] **Step 6: Manual verification**

Open `index.html` in a browser.

Pass criteria:
- Hero mark, Why Us visual mark, and mobile-nav mark all render as a green open ring with a coral dash, visually matching the proportions of `assets/certa-mark.png` (open side facing right, dash sitting in the gap) — no distortion, no missing dash, no oversized/undersized ring relative to the old PNG rendering.
- Hero mark and Why Us mark still parallax/idle-float exactly as before (unchanged visually from before this task).
- Mobile nav mark renders crisply at 32px height.
- No console errors (in particular, no "symbol not found" or `<use>` reference errors).

- [ ] **Step 7: Commit**

```bash
git add index.html assets/styles.css
git commit -m "Replace raster brand mark with inline SVG symbol (ring + dash)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Preloader draw-on sequence

**Files:**
- Modify: `index.html:18-23` (preloader markup)
- Modify: `assets/styles.css:157-201` (`/* ---------- Preloader ---------- */` block)
- Modify: `assets/script.js:1-22` (preloader block) and hoist the `reducedMotion` constant

**Interfaces:**
- Consumes: `.certa-mark__ring` / `.certa-mark__dash` classes (Task 1).
- Produces: hoisted top-of-file `reducedMotion` constant, consumed by Task 3 and Task 8. `.preloader__mark.is-drawing` trigger class.

- [ ] **Step 1: Hoist the `reducedMotion` constant**

In `assets/script.js`, the line `const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;` currently sits inside the "Motion: idle float + scroll parallax" section (`script.js:76`). Move it to the very top of the file, before the preloader block, so both the preloader (this task) and the existing motion loop can use it. The file should now start:

```javascript
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Preloader ----------
const preloader = document.getElementById('preloader');
```

Delete the old declaration line from its original location in the "Motion: idle float + scroll parallax" section (do not declare it twice — the block there now just references the hoisted constant, no other change needed to that section in this step).

- [ ] **Step 2: Replace the preloader's raster mark with the animatable inline SVG**

In `index.html`, replace (`index.html:18-23`):

```html
<div class="preloader" id="preloader" role="status" aria-live="polite">
  <div class="preloader__inner">
    <img class="preloader__mark" src="assets/certa-mark.png" alt="" />
  </div>
  <span class="preloader__sr">Loading CERTA&amp; Advisory…</span>
</div>
```

with:

```html
<div class="preloader" id="preloader" role="status" aria-live="polite">
  <div class="preloader__inner">
    <svg class="preloader__mark" viewBox="0 0 100 100" aria-hidden="true">
      <path class="certa-mark__ring" pathLength="1" d="M 81.93 66.62 A 36 36 0 1 1 81.93 33.38" fill="none" stroke="var(--certa-green)" stroke-width="12" stroke-linecap="round"/>
      <rect class="certa-mark__dash" x="80" y="44" width="17" height="12" rx="6" fill="var(--signal-coral)"/>
    </svg>
  </div>
  <span class="preloader__sr">Loading CERTA&amp; Advisory…</span>
</div>
```

This duplicates the same ring/dash geometry from Task 1's `<symbol>` directly inline (not via `<use>`), because the draw-on animation needs to set `stroke-dashoffset` on the actual `<path>`/`<rect>` nodes — `<use>`-cloned shadow-DOM content isn't reliably targetable that way across browsers.

- [ ] **Step 3: Replace the spin/iris CSS with draw-on CSS**

In `assets/styles.css`, in the `/* ---------- Preloader ---------- */` block, replace:

```css
.preloader__mark {
  width: 100px;
  height: 100px;
  animation: certa-spin 1.6s linear infinite;
}
@keyframes certa-spin {
  to { transform: rotate(360deg); }
}
```

with:

```css
.preloader__mark { width: 100px; height: 100px; }
.preloader__mark .certa-mark__ring {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  transition: stroke-dashoffset 600ms var(--ease-standard);
}
.preloader__mark .certa-mark__dash {
  opacity: 0;
  transform: scale(0.4);
  transform-origin: 88px 50px;
  transition: opacity 150ms var(--ease-standard) 650ms, transform 150ms var(--ease-standard) 650ms;
}
.preloader__mark.is-drawing .certa-mark__ring { stroke-dashoffset: 0; }
.preloader__mark.is-drawing .certa-mark__dash { opacity: 1; transform: scale(1); }
```

Then, in the existing `@media (prefers-reduced-motion: reduce)` block at the bottom of the same section, replace the line `.preloader__mark { animation: none; }` with:

```css
  .preloader__mark .certa-mark__ring { stroke-dashoffset: 0; transition: none; }
  .preloader__mark .certa-mark__dash { opacity: 1; transform: scale(1); transition: none; }
```

- [ ] **Step 4: Trigger the draw and retune the minimum display time**

In `assets/script.js`, in the preloader block, replace:

```javascript
// ---------- Preloader ----------
const preloader = document.getElementById('preloader');
if (preloader) {
  document.documentElement.classList.add('is-loading');
  const shownAt = performance.now();
  const minDisplay = 1800; // ms — deliberate pause so the spinning mark actually registers, not just a flash

  function hidePreloader() {
    const elapsed = performance.now() - shownAt;
    const wait = Math.max(0, minDisplay - elapsed);
    setTimeout(() => {
      preloader.classList.add('is-hidden');
      document.documentElement.classList.remove('is-loading');
    }, wait);
  }

  if (document.readyState === 'complete') {
    hidePreloader();
  } else {
    window.addEventListener('load', hidePreloader);
  }
}
```

with:

```javascript
// ---------- Preloader ----------
const preloader = document.getElementById('preloader');
if (preloader) {
  document.documentElement.classList.add('is-loading');
  const shownAt = performance.now();
  // ms — the draw-on sequence itself is ~900ms (600ms ring + 150ms dash-snap + 150ms hold);
  // minDisplay adds a short settle so the completed mark registers before the iris opens.
  const minDisplay = 1400;

  const preloaderMark = preloader.querySelector('.preloader__mark');
  if (preloaderMark && !reducedMotion) {
    // Double rAF: wait a frame so the browser has committed the initial (undrawn) state
    // before adding the class that transitions it, so the transition actually plays.
    requestAnimationFrame(() => requestAnimationFrame(() => preloaderMark.classList.add('is-drawing')));
  }

  function hidePreloader() {
    const elapsed = performance.now() - shownAt;
    const wait = Math.max(0, minDisplay - elapsed);
    setTimeout(() => {
      preloader.classList.add('is-hidden');
      document.documentElement.classList.remove('is-loading');
    }, wait);
  }

  if (document.readyState === 'complete') {
    hidePreloader();
  } else {
    window.addEventListener('load', hidePreloader);
  }
}
```

- [ ] **Step 5: Manual verification**

Reload `index.html` (hard refresh to re-trigger the preloader).

Pass criteria:
- The ring visibly strokes on (grows from nothing to the full open-ring shape), then the coral dash snaps into its gap, then a brief hold, then the existing iris/scale-up transition plays as before.
- No spinning motion anywhere.
- Total preloader time feels similar to or shorter than before this task (not longer).
- With `prefers-reduced-motion: reduce` emulated, the mark appears already-complete (full ring + dash) immediately, with only the existing opacity fade-out — no draw animation.
- No console errors.

- [ ] **Step 6: Commit**

```bash
git add index.html assets/styles.css assets/script.js
git commit -m "Replace preloader spin with ring-draws-then-dash-snaps sequence

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Preloader → Hero shared-element morph

**Files:**
- Modify: `assets/script.js` (preloader block, extends Task 2's `hidePreloader`)

**Interfaces:**
- Consumes: hoisted `reducedMotion` (Task 2), `.preloader__mark` (Task 2), `.hero__mark .certa-mark-use` (Task 1).

- [ ] **Step 1: Add the morph function and call it from `hidePreloader`**

In `assets/script.js`, in the preloader block, add this function directly above `hidePreloader`:

```javascript
  function morphMarkToHero() {
    const heroMark = document.querySelector('.hero__mark .certa-mark-use');
    if (!preloaderMark || !heroMark) return;

    const startRect = preloaderMark.getBoundingClientRect();
    const endRect = heroMark.getBoundingClientRect();
    const clone = preloaderMark.cloneNode(true);
    clone.classList.add('mark-morph-clone');
    clone.style.position = 'fixed';
    clone.style.left = `${startRect.left}px`;
    clone.style.top = `${startRect.top}px`;
    clone.style.width = `${startRect.width}px`;
    clone.style.height = `${startRect.height}px`;
    clone.style.margin = '0';
    clone.style.zIndex = '10050';
    clone.style.pointerEvents = 'none';
    document.body.appendChild(clone);

    heroMark.style.opacity = '0';

    requestAnimationFrame(() => {
      const scaleX = endRect.width / startRect.width;
      const scaleY = endRect.height / startRect.height;
      const translateX = endRect.left - startRect.left;
      const translateY = endRect.top - startRect.top;
      clone.style.transition = 'transform 950ms var(--ease-standard), opacity 950ms var(--ease-standard)';
      clone.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`;
    });

    setTimeout(() => {
      heroMark.style.opacity = '';
      clone.remove();
    }, 950);
  }
```

Then update `hidePreloader` to call it (only when motion is enabled — reduced-motion visitors keep today's plain cross-fade with no clone/morph):

```javascript
  function hidePreloader() {
    const elapsed = performance.now() - shownAt;
    const wait = Math.max(0, minDisplay - elapsed);
    setTimeout(() => {
      if (!reducedMotion) morphMarkToHero();
      preloader.classList.add('is-hidden');
      document.documentElement.classList.remove('is-loading');
    }, wait);
  }
```

- [ ] **Step 2: Manual verification**

Reload `index.html` at desktop width (≥1320px).

Pass criteria:
- As the preloader clears, the completed ring+dash mark visibly travels from the preloader's center-screen position to the hero mark's position (rather than the hero mark just fading in independently at its own spot).
- No visible "double mark" flash (the real hero mark stays hidden until the traveling clone arrives, then the clone is removed and the real mark is at full opacity in the same place — no jump/flicker at handoff).
- Repeat at 375px mobile width — same behavior, just a different end position/scale, no layout break.
- With `prefers-reduced-motion: reduce` emulated, `morphMarkToHero` never runs (verify via a breakpoint or a temporary `console.log` during manual testing, then remove it) — the hero mark just appears via its existing `[data-reveal]` fade, no clone element ever added to the DOM.
- No console errors.

- [ ] **Step 3: Commit**

```bash
git add assets/script.js
git commit -m "Add preloader-to-hero shared-element morph for the brand mark

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: New section — "By the numbers"

**Files:**
- Modify: `index.html` (insert new `<section id="by-the-numbers">` between the hero's closing `</section>` and the `#services` section's opening tag, i.e. between current lines 149 and 151)
- Modify: `assets/styles.css` (append new `/* ---------- By the numbers ---------- */` block after the Header block and before `/* ---------- Hero ---------- */`, or any location before the Services block — placement in the cascade doesn't matter here since all selectors are scoped)

**Interfaces:**
- Consumes: `[data-count-to]`/`[data-count-suffix]` convention and `animateCount()` (existing, `script.js:194-235` — no changes needed, the existing `document.querySelectorAll('[data-count-to]')` picks up the new elements automatically), `[data-reveal]`/`.is-visible` system (existing), `.certa-mark__ring`/`.certa-mark__dash` classes (Task 1).

- [ ] **Step 1: Insert the section**

In `index.html`, between the hero section's closing `</section>` and the `#services` section's opening `<section ...>` tag, insert:

```html
  <section class="section stats-band" id="by-the-numbers" aria-label="CERTA&amp; Advisory by the numbers">
    <div class="container">
      <div class="stats-band__row" data-reveal>
        <div class="stat-item">
          <span class="stat-item__value" data-count-to="1" data-count-suffix=" week">1 week</span>
          <span class="stat-item__label">to scoping</span>
        </div>
        <div class="stat-item">
          <span class="stat-item__value" data-count-to="60" data-count-suffix=" days">60 days</span>
          <span class="stat-item__label">to first reporting cycle</span>
        </div>
        <div class="stat-item">
          <span class="stat-item__value" data-count-to="4">4</span>
          <span class="stat-item__label">jurisdictions covered</span>
        </div>
        <div class="stat-item">
          <span class="stat-item__value" data-count-to="4">4</span>
          <span class="stat-item__label">software platforms supported</span>
        </div>
        <div class="stat-item stat-item--final">
          <span class="stat-item__value" data-count-to="4">4</span>
          <span class="stat-item__label">named roles on every engagement</span>
          <svg class="stat-item__flourish" viewBox="0 0 100 100" aria-hidden="true">
            <path class="certa-mark__ring" pathLength="1" d="M 81.93 66.62 A 36 36 0 1 1 81.93 33.38" fill="none" stroke="var(--certa-green)" stroke-width="12" stroke-linecap="round"/>
            <rect class="certa-mark__dash" x="80" y="44" width="17" height="12" rx="6" fill="var(--signal-coral)"/>
          </svg>
        </div>
      </div>
    </div>
  </section>
```

Every figure here already appears elsewhere on the page: "1 week"/"60 days" in the Process section intro and stat callout, "4 jurisdictions" (UK/USA/Canada/Europe) in the Hero and FAQ, "4 software platforms" (Xero/QuickBooks/Sage/FreeAgent) in the Hero, Why Us, Security, and FAQ, and "4 named roles" (Engagement Lead, Senior Accountants, Payroll Specialists, Compliance Reviewers) in the Team, Security, and FAQ sections.

- [ ] **Step 2: Style the stat band**

In `assets/styles.css`, append:

```css
/* ---------- By the numbers ---------- */
.stats-band { padding: var(--space-lg) 0; }
.stats-band__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-lg) var(--space-xl);
  justify-content: space-between;
}
.stat-item { display: flex; flex-direction: column; gap: 4px; position: relative; }
.stat-item__value {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1.75rem, 3vw, 2.25rem);
  color: var(--certa-green-deep);
  font-variant-numeric: tabular-nums;
}
.stat-item__label { font-size: 0.8125rem; color: var(--ink-muted); max-width: 16ch; }
.stat-item__flourish {
  position: absolute;
  top: -6px;
  right: -34px;
  width: 22px;
  height: 22px;
  opacity: 0;
  transform: scale(0.6);
  transition: opacity 400ms var(--ease-standard), transform 400ms var(--ease-standard);
}
.stat-item__flourish .certa-mark__ring {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  transition: stroke-dashoffset 500ms var(--ease-standard) 200ms;
}
.stats-band__row.is-visible .stat-item__flourish { opacity: 1; transform: scale(1); }
.stats-band__row.is-visible .stat-item__flourish .certa-mark__ring { stroke-dashoffset: 0; }

@media (max-width: 640px) {
  .stats-band__row { gap: var(--space-md); }
  .stat-item__flourish { display: none; }
}
```

- [ ] **Step 3: Add the reduced-motion override**

In the existing `@media (prefers-reduced-motion: reduce)` block in `assets/styles.css`, add:

```css
  .stat-item__flourish, .stat-item__flourish .certa-mark__ring { transition: none; opacity: 1; transform: none; stroke-dashoffset: 0; }
```

- [ ] **Step 4: Manual verification**

Open `index.html`, scroll to the new section between Hero and Services.

Pass criteria:
- Five stats appear in a row (wrapping to fewer per row on narrower viewports), each counting up from 0 to its final value as the row scrolls into view.
- The fifth stat ("named roles on every engagement") shows a small ring+dash flourish appearing beside it shortly after the row becomes visible.
- At 375px viewport width, the flourish is hidden (per the `max-width: 640px` rule) and the stats stack/wrap cleanly with no overlap.
- With `prefers-reduced-motion: reduce` emulated, all five values show their final numbers immediately (existing count-up reduced-motion behavior, unchanged) and the flourish is visible immediately with no transition.
- Every number on this page also appears (verbatim or as a clear paraphrase) elsewhere on the page — no invented figures.
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add index.html assets/styles.css
git commit -m "Add 'By the numbers' stat band section after the hero

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Process section scroll-choreographed line

**Files:**
- Modify: `index.html:233` (inside `#process`, before `.process`)
- Modify: `assets/styles.css:566-586` (`.process`/`.process-step` rules)
- Modify: `assets/script.js` (extend the existing shared motion loop)

**Interfaces:**
- Consumes: the existing shared `motionEls`/`tick()` loop (`script.js`, "Motion: idle float + scroll parallax" section).
- Produces: `[data-line-progress]`, `.process-line`, `.process-step.is-active` — used only in this task.

- [ ] **Step 1: Add the line markup**

In `index.html`, inside `#process`, immediately before the opening `<div class="process">` tag (`index.html:233`), insert:

```html
      <div class="process-line" aria-hidden="true"><span class="process-line__fill" data-line-progress></span></div>
```

- [ ] **Step 2: Style the line and wire up the grid container**

In `assets/styles.css`, replace:

```css
.process {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
```

with:

```css
.process {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
```

Then, immediately after the `.process { ... }` rule's closing brace and before `.process-step { ... }`, add:

```css
.process-line { display: none; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--border); z-index: 0; }
.process-line__fill { position: absolute; inset: 0; background: var(--certa-green); transform-origin: left; transform: scaleX(0); }

@media (min-width: 861px) and (hover: hover) {
  .process-line { display: block; }
  .process-step { border-top-color: transparent; }
}
```

This keeps the existing per-step `border-top` (`styles.css:572-576`) as the resting "rail" on mobile/touch (where the scroll-driven line is disabled), and replaces it with one continuous green fill line on desktop.

- [ ] **Step 3: Add active-step styling**

In `assets/styles.css`, immediately after `.process-step__num { ... }` (`styles.css:577-584`), add:

```css
.process-step.is-active .process-step__num,
.process-step.is-active h3 { color: var(--certa-green-deep); }
```

- [ ] **Step 4: Extend the shared motion loop**

In `assets/script.js`, in the "Motion: idle float + scroll parallax" section, change the element-selection line from:

```javascript
const motionEls = Array.from(document.querySelectorAll('[data-parallax], [data-float]'));
```

to:

```javascript
const motionEls = Array.from(document.querySelectorAll('[data-parallax], [data-float], [data-line-progress]'));
```

Then, inside `tick()`, as the very first line of the `motionEls.forEach((el) => { ... })` callback (before the existing `let y = 0; let rot = 0;`), add:

```javascript
      if (el.hasAttribute('data-line-progress')) {
        const track = el.closest('.process');
        if (track) {
          const rect = track.getBoundingClientRect();
          const start = viewportH * 0.8;
          const end = viewportH * 0.25;
          const raw = (start - rect.top) / (start - end);
          const progress = Math.min(1, Math.max(0, raw));
          el.style.transform = `scaleX(${progress.toFixed(3)})`;
          const steps = track.querySelectorAll('.process-step');
          const activeIndex = Math.floor(progress * steps.length);
          steps.forEach((step, i) => step.classList.toggle('is-active', progress > 0 && i <= activeIndex));
        }
        return;
      }

```

(`return` inside `forEach`'s callback just skips to the next element, equivalent to `continue` — it does not exit `tick()`.)

- [ ] **Step 5: Add the reduced-motion fallback**

In the existing `@media (prefers-reduced-motion: reduce)` block in `assets/styles.css`, add:

```css
  .process-line__fill { transform: scaleX(1) !important; }
```

(Under reduced motion, the whole `motionEls` loop never starts per the existing `if (!reducedMotion && motionEls.length)` guard, so this CSS-only override is what makes the line show fully drawn instead of staying at its default `scaleX(0)`.)

- [ ] **Step 6: Manual verification**

Open `index.html` at desktop width (≥1320px) with a mouse (not touch emulation), scroll through `#process`.

Pass criteria:
- A thin green line above the four process steps fills left-to-right as the section scrolls through the middle of the viewport, reaching full width by the time the section has mostly passed.
- Each step's number and heading shift to the darker green (`--certa-green-deep`) roughly as the line's leading edge reaches it, and stay that color afterward.
- At 375px viewport width (or with touch/`(hover: none)` emulation), the line never appears — the four steps show their original muted `border-top` rail and plain `[data-reveal]` fade-up, unchanged from before this task.
- With `prefers-reduced-motion: reduce` emulated, the line (where visible, i.e. desktop) shows fully green immediately, no scroll-driven fill animation.
- No console errors, no layout shift/horizontal scroll introduced at any width.

- [ ] **Step 7: Commit**

```bash
git add index.html assets/styles.css assets/script.js
git commit -m "Add scroll-choreographed connecting line to Process section (desktop)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Security card icon draw-in + closing CTA ring-complete

**Files:**
- Modify: `index.html` (security card icons, `~index.html:397-419`; CTA band, `~index.html:555-564`)
- Modify: `assets/styles.css` (append after the Security block; append reduced-motion overrides)

**Interfaces:**
- Consumes: `.security-card`/`data-reveal`/`.is-visible` (existing), `.cta-band`/`data-reveal`/`.is-visible` (existing), `.certa-mark__ring`/`.certa-mark__dash` (Task 1).

- [ ] **Step 1: Add `pathLength="1"` to each security icon's shapes**

In `index.html`, in the three `.security-card__mark svg` icons, add `pathLength="1"` to every `<path>`/`<rect>` element inside them. The three icons become:

Card 1 (shield):
```html
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path pathLength="1" d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
```

Card 2 (lock):
```html
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect pathLength="1" width="18" height="11" x="3" y="11" rx="2" ry="2"/><path pathLength="1" d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
```

Card 3 (sync arrows):
```html
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path pathLength="1" d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path pathLength="1" d="M21 3v5h-5"/><path pathLength="1" d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path pathLength="1" d="M8 16H3v5"/></svg>
```

- [ ] **Step 2: Style the draw-in with a per-shape stagger**

In `assets/styles.css`, append after the `/* ---------- Confidentiality & Security ---------- */` block:

```css
.security-card__mark svg * {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  transition: stroke-dashoffset 500ms var(--ease-standard);
}
.security-card__mark svg *:nth-child(2) { transition-delay: 120ms; }
.security-card__mark svg *:nth-child(3) { transition-delay: 240ms; }
.security-card__mark svg *:nth-child(4) { transition-delay: 360ms; }
.security-card.is-visible .security-card__mark svg * { stroke-dashoffset: 0; }
```

- [ ] **Step 3: Add the closing CTA ring-complete flourish**

In `index.html`, inside the `#contact` section's `.cta-band` div, immediately before the closing `</div>` of the first inner `<div>` (the one containing the `<h2>`/`<p>`, i.e. right after the existing `<p>Book a 30-minute call...</p>`), insert:

```html
          <svg class="cta-mark" viewBox="0 0 100 100" aria-hidden="true">
            <path class="certa-mark__ring" pathLength="1" d="M 81.93 66.62 A 36 36 0 1 1 81.93 33.38" fill="none" stroke="var(--certa-green)" stroke-width="12" stroke-linecap="round"/>
            <rect class="certa-mark__dash" x="80" y="44" width="17" height="12" rx="6" fill="var(--signal-coral)"/>
          </svg>
```

- [ ] **Step 4: Style the CTA flourish**

In `assets/styles.css`, in the `cta-band` rules, add:

```css
.cta-mark { width: 32px; height: 32px; margin-top: var(--space-sm); }
.cta-mark .certa-mark__ring {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  transition: stroke-dashoffset 600ms var(--ease-standard);
}
.cta-mark .certa-mark__dash {
  opacity: 0;
  transition: opacity 200ms var(--ease-standard) 550ms;
}
.cta-band.is-visible .cta-mark .certa-mark__ring { stroke-dashoffset: 0; }
.cta-band.is-visible .cta-mark .certa-mark__dash { opacity: 1; }
```

- [ ] **Step 5: Add the reduced-motion overrides**

In the existing `@media (prefers-reduced-motion: reduce)` block in `assets/styles.css`, add:

```css
  .security-card__mark svg * { transition: none; stroke-dashoffset: 0; }
  .cta-mark .certa-mark__ring, .cta-mark .certa-mark__dash { transition: none; stroke-dashoffset: 0; opacity: 1; }
```

- [ ] **Step 6: Manual verification**

Open `index.html`, scroll to the Security section and the closing CTA.

Pass criteria:
- Each security card's icon visibly draws itself in (strokes appear progressively) as the card scrolls into view, with a slight stagger between an icon's own sub-shapes where it has more than one (the lock and sync-arrows icons).
- The closing CTA band shows a small ring+dash mark that completes (ring draws, then dash fades in) once the CTA band scrolls into view.
- With `prefers-reduced-motion: reduce` emulated, all icons and the CTA mark appear fully drawn immediately, no stroke animation.
- No console errors.

- [ ] **Step 7: Commit**

```bash
git add index.html assets/styles.css
git commit -m "Add security icon draw-in and closing CTA ring-complete flourish

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Nav scroll-progress line

**Files:**
- Modify: `index.html` (inside `.site-header`)
- Modify: `assets/styles.css` (Header block)
- Modify: `assets/script.js` (`updateHeaderState`)

**Interfaces:**
- Consumes: existing `siteHeader`/`updateHeaderState` (`script.js`, "Header" section).

- [ ] **Step 1: Add the progress bar element**

In `index.html`, inside `<header class="site-header">`, immediately before its closing `</header>` tag (i.e. as the last child, after the `.container.site-header__bar` div), insert:

```html
  <span class="nav-progress" aria-hidden="true"></span>
```

- [ ] **Step 2: Style it**

In `assets/styles.css`, in the Header block, add:

```css
.nav-progress {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  width: 100%;
  background: var(--certa-green);
  transform-origin: left;
  transform: scaleX(0);
  transition: transform 100ms linear;
}
```

- [ ] **Step 3: Compute progress on scroll**

In `assets/script.js`, in the "Header: transparent-over-hero, solid once scrolled" section, replace:

```javascript
const siteHeader = document.querySelector('.site-header');
function updateHeaderState() {
  siteHeader.classList.toggle('is-scrolled', window.scrollY > 40);
}
window.addEventListener('scroll', updateHeaderState, { passive: true });
updateHeaderState();
```

with:

```javascript
const siteHeader = document.querySelector('.site-header');
const navProgress = document.querySelector('.nav-progress');
function updateHeaderState() {
  siteHeader.classList.toggle('is-scrolled', window.scrollY > 40);
  if (navProgress) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    navProgress.style.transform = `scaleX(${progress.toFixed(3)})`;
  }
}
window.addEventListener('scroll', updateHeaderState, { passive: true });
updateHeaderState();
```

- [ ] **Step 4: Add the reduced-motion override**

In the existing `@media (prefers-reduced-motion: reduce)` block in `assets/styles.css`, add:

```css
  .nav-progress { transition: none; }
```

- [ ] **Step 5: Manual verification**

Open `index.html`, scroll from top to bottom.

Pass criteria:
- A thin green line grows across the bottom edge of the header/nav bar as the page scrolls, reaching full width at the bottom of the page.
- Reaches exactly full width at the page bottom, not before and not short of it.
- No console errors, no visual overlap with the nav links.

- [ ] **Step 6: Commit**

```bash
git add index.html assets/styles.css assets/script.js
git commit -m "Add scroll-progress line to site header

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Hero CTA cursor-proximity pull

**Files:**
- Modify: `index.html:83` (hero coral CTA)
- Modify: `assets/styles.css` (Buttons block)
- Modify: `assets/script.js` (append new behavior)

**Interfaces:**
- Consumes: hoisted `reducedMotion` (Task 2).

- [ ] **Step 1: Wrap the hero CTA**

In `index.html`, replace (`index.html:83`):

```html
          <a class="btn btn-coral" href="#contact">Book a discovery call</a>
```

with:

```html
          <span class="magnetic-cta"><a class="btn btn-coral" href="#contact">Book a discovery call</a></span>
```

- [ ] **Step 2: Style the wrapper**

In `assets/styles.css`, in the Buttons block, add:

```css
.magnetic-cta { display: inline-block; transition: transform 200ms var(--ease-standard); }
```

- [ ] **Step 3: Add the pull behavior**

In `assets/script.js`, append at the end of the file:

```javascript
// ---------- Hero CTA cursor-proximity pull ----------
// Mouse-only enhancement (no listener attached at all on touch/reduced-motion), and capped
// to a few pixels so it reads as engineered precision, not a playful "magnetic button."
const magneticCta = document.querySelector('.magnetic-cta');
const canHover = window.matchMedia('(hover: hover)').matches;
if (magneticCta && canHover && !reducedMotion) {
  const radius = 60; // px — activation radius around the button's center
  const maxPull = 8; // px — cap on the visual pull

  function handleMagneticMove(e) {
    const rect = magneticCta.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < radius) {
      const pull = (1 - dist / radius) * maxPull;
      const angle = Math.atan2(dy, dx);
      magneticCta.style.transform = `translate(${(Math.cos(angle) * pull).toFixed(1)}px, ${(Math.sin(angle) * pull).toFixed(1)}px)`;
    } else {
      magneticCta.style.transform = '';
    }
  }

  window.addEventListener('mousemove', handleMagneticMove, { passive: true });
}
```

- [ ] **Step 4: Manual verification**

Open `index.html` with a mouse, move the cursor near the hero's "Book a discovery call" button.

Pass criteria:
- The button visibly (but subtly — a few pixels, not a large jump) pulls toward the cursor as it approaches within roughly 60px, and releases back to rest when the cursor moves away.
- The button's own existing hover state (background/shadow/lift on `:hover`) still works unchanged.
- On a touch device (or with `(hover: none)` emulated), no pull occurs and no `mousemove` listener errors appear.
- With `prefers-reduced-motion: reduce` emulated, no pull occurs.
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add index.html assets/styles.css assets/script.js
git commit -m "Add subtle cursor-proximity pull to hero CTA

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Comparison table + FAQ hover polish

**Files:**
- Modify: `assets/styles.css` (append after the existing comparison-table and FAQ blocks, so source order wins over the existing `tbody tr:nth-child(even)` rule)

**Interfaces:** none — CSS only.

- [ ] **Step 1: Add the hover rules**

In `assets/styles.css`, append (after the existing `/* ---------- FAQ ---------- */` block, so this comes later in the cascade than the comparison table's `tbody tr:nth-child(even)` rule and reliably wins on both odd and even rows):

```css
/* ---------- Table/FAQ hover polish ---------- */
.comparison-table tbody tr { transition: background 200ms var(--ease-standard); }
.comparison-table tbody tr:hover { background: var(--certa-green-tint); }
.faq-item { transition: background 200ms var(--ease-standard); }
.faq-item:hover { background: var(--surface-tint); }
```

- [ ] **Step 2: Manual verification**

Open `index.html`, hover over comparison table rows (both odd and even) and FAQ items.

Pass criteria:
- Every comparison table row (both the plain and the `nth-child(even)`-tinted ones) shows the green-tint hover background — the existing even-row white background never wins over the hover state.
- Every FAQ item shows the surface-tint hover background, including when open.
- No layout shift on hover.
- No console errors.

- [ ] **Step 3: Commit**

```bash
git add assets/styles.css
git commit -m "Add hover polish to comparison table rows and FAQ items

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: DESIGN.md — Signature Moments Rule

**Files:**
- Modify: `DESIGN.md` (the "Scroll Reveal & Parallax" section's "Named Rules" subsection, and the "Do's and Don'ts" list)

**Interfaces:** none — documentation only.

- [ ] **Step 1: Replace the Static-By-Default Rule**

In `DESIGN.md`, in the "### Named Rules" subsection under "### Scroll Reveal & Parallax (signature)", replace:

```
**The Static-By-Default Rule.** Full-scale, full-bleed layout and signature scroll motion are not the same thing as decorating every element. Parallax is reserved for the hero and Why Us visual only; reveal-on-scroll is used for content blocks, not sprinkled onto every icon and label. If it's not one of the two named signature moments, it does not get parallax.
```

with:

```
**The Signature Moments Rule** (supersedes the earlier two-moment Static-By-Default Rule, expanded 2026-08-11). Full-scale, full-bleed layout and signature scroll motion are not the same thing as decorating every element. Scroll-driven and stroke-draw motion beyond the standard `[data-reveal]` fade-up and hover/focus states is reserved for exactly six named moments: (1) the preloader's ring-draws/dash-snaps sequence and its shared-element morph into the hero mark, (2) the hero's decorative rings and floating mark, (3) the "By the numbers" stat band's count-up and closing ring flourish, (4) the Process section's scroll-choreographed connecting line (desktop only), (5) the Why Us visual, and (6) the Security cards' icon draw-in plus the closing CTA's ring-complete flourish. If it's not one of these six, it does not get scroll-driven or stroke-draw motion — it gets the standard reveal-on-scroll treatment or nothing.
```

- [ ] **Step 2: Update the "Do" bullet referencing the old rule**

In the "### Do:" list, replace:

```
- **Do** reserve parallax for the hero and Why Us visual only; use reveal-on-scroll for content blocks, per the Static-By-Default Rule.
```

with:

```
- **Do** reserve scroll-driven and stroke-draw motion for the six named Signature Moments only; use reveal-on-scroll for everything else, per the Signature Moments Rule.
```

- [ ] **Step 3: Commit**

```bash
git add DESIGN.md
git commit -m "Update DESIGN.md: Static-By-Default Rule -> Signature Moments Rule (6 moments)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: Full-page integration pass

**Files:** none (verification only — no code changes expected).

**Interfaces:** none.

- [ ] **Step 1: Full scroll-through at desktop width (≥1320px), fresh page load**

Hard-refresh `index.html`. Watch the preloader-to-hero sequence, then scroll from top to footer in one continuous pass.

Pass criteria:
- Preloader: ring draws, dash snaps, hold, then morphs into the hero mark position as the iris opens — no flash/jump at handoff.
- Section order: Hero → By the numbers (new) → Services → Process (with new connecting line) → Outsourcing comparison → Why Us → Security (with icon draw-in) → Team → Clients → FAQ → Careers → Contact (with ring-complete flourish) → Footer.
- Nav progress line fills smoothly from 0 to full width across the whole scroll.
- Hero CTA responds to cursor proximity.
- No section's spacing looks doubled-up or collapsed at any of the new-section boundaries.

- [ ] **Step 2: Full scroll-through at mobile width (375px)**

Resize (or use device emulation) to 375px width and repeat.

Pass criteria:
- No horizontal page scroll anywhere (`document.documentElement.scrollWidth === document.documentElement.clientWidth`).
- Process section shows its plain static rail + stacked reveal, no scroll-choreographed line.
- "By the numbers" stats wrap/stack cleanly with the ring flourish hidden.
- Mobile nav (hamburger menu) still opens/closes correctly and its mark renders correctly.

- [ ] **Step 3: Reduced-motion pass**

Enable `prefers-reduced-motion: reduce` (OS setting or devtools emulation) and hard-reload.

Pass criteria:
- Preloader shows the completed mark immediately (no draw), fades out via opacity only, no morph clone ever created.
- "By the numbers" stats show final values immediately with the flourish already visible.
- Process line (desktop) shows fully green immediately, no scroll-driven fill.
- Security icons and the closing CTA mark show fully drawn immediately.
- Nav progress line still tracks scroll position (it's not a decorative flourish, just a position indicator) but with no transition easing.
- Hero CTA cursor pull never activates.
- All pre-existing reduced-motion behavior (parallax/float removed, `[data-reveal]` shows full content) still intact.

- [ ] **Step 4: Console and cross-browser sanity check**

With devtools console open, reload and click through every nav link, then scroll-check `#by-the-numbers` via direct URL hash.

Pass criteria:
- Zero console errors or warnings at any point.
- Every nav anchor still scrolls to the correct section.
- `index.html#by-the-numbers` scrolls to the correct new section.

- [ ] **Step 5: Commit (only if Steps 1-4 required fixes)**

```bash
git add index.html assets/styles.css assets/script.js DESIGN.md
git commit -m "Fix integration issues found in full-page verification pass

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

If nothing needed fixing, skip this step.

---

## Self-Review

**Spec coverage:**
1. Prerequisite: inline SVG brand mark → Task 1. ✅
2. Signature moment 1 (preloader draw-on) → Task 2. ✅
3. Signature moment 1 (preloader→hero morph) → Task 3. ✅
4. Signature moment 2 (hero rings/mark, kept) → no task needed, explicitly unchanged per spec. ✅
5. Signature moment 3 ("By the numbers") → Task 4. ✅
6. Signature moment 4 (Process line choreography) → Task 5. ✅
7. Signature moment 5 (Why Us visual, kept) → no task needed, explicitly unchanged per spec. ✅
8. Signature moment 6 (Security icons + closing CTA) → Task 6. ✅
9. Nav scroll-progress line → Task 7. ✅
10. Micro-interactions (CTA pull, table/FAQ hover) → Tasks 8-9. ✅
11. DESIGN.md Signature Moments Rule update → Task 10. ✅
12. Accessibility requirements (reduced-motion fallbacks, decorative `aria-hidden`, no-JS-safe stat values, keyboard/touch-safe CTA pull) → enforced per-task and re-verified in Task 11. ✅
13. Out-of-scope guardrails (no new colors/dark-mode/copy/deps, no portal changes) → enforced in Global Constraints, re-verified in Task 11. ✅

**Placeholder scan:** no "TBD"/"TODO"/"handle appropriately" language anywhere in the tasks above — every step has literal HTML/CSS/JS and a concrete pass/fail check.

**Type/naming consistency:** `.certa-mark__ring`/`.certa-mark__dash` (defined in Task 1's symbol) are the exact class names reused in Task 2 (preloader), Task 4 (stat flourish), and Task 6 (CTA flourish). `.certa-mark-use` (Task 1) is the exact class the Task 3 morph function queries (`.hero__mark .certa-mark-use`). The hoisted `reducedMotion` constant (Task 2, Step 1) is the exact identifier Task 3 and Task 8 reference — no re-declaration anywhere. `[data-line-progress]`/`.process-line`/`.is-active` (Task 5) are self-contained to that task. `motionEls`/`tick()` (existing, extended by Task 5) keep their original names.

**Scope check:** eleven tasks, each independently reviewable and each producing a working, visually-verifiable page state on its own (no task leaves the site broken if execution stops after it). Consistent with a single cohesive feature (motion redesign) rather than multiple unrelated subsystems — no further decomposition needed.
