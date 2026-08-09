# Marketing Site Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the six items in `docs/superpowers/specs/2026-08-09-marketing-site-redesign-design.md` — real software logos, a process stat callout, a new Outsourcing-vs-in-house comparison table, a Why Us icon grid, a new Confidentiality & Security section, and a new FAQ section — on the existing one-page marketing site, with zero new facts and zero new dependencies.

**Architecture:** Vanilla HTML/CSS/JS, no build step. Every task edits `index.html` (structure), `assets/styles.css` (new rules appended near the section they style, following the file's existing `/* ---------- Name ---------- */` block convention), and occasionally `assets/script.js` (one new progressive-enhancement behavior). Tasks are ordered top-to-bottom by where they land on the page, so each diff is easy to review in isolation.

**Tech Stack:** Static HTML5, CSS custom properties (design tokens already in `styles.css:2-37`), vanilla JS (`IntersectionObserver`, `requestAnimationFrame` — both already used by the existing reveal/parallax/world-clock systems). No npm, no framework, no icon library.

## Global Constraints

- **Scope:** only `index.html`, `assets/styles.css`, `assets/script.js`. The Next.js `portal/` is untouched.
- **No new runtime dependencies** — no npm packages, icon libraries, animation libraries, fonts, or build step introduced.
- **No fabricated facts.** Every new sentence of copy must already exist (or be a direct paraphrase of something that already exists) in `index.html`, `PRODUCT.md`, or `DESIGN.md`. No invented stats, client logos, testimonials, or certifications. (`PRODUCT.md` principle #9: "Team, Clients, and Careers content must never fabricate specific named people, credentials, or client logos that don't exist.")
- **Brand tokens only** — reuse the existing custom properties from `styles.css:2-37` (`--certa-green` `#00904C`, `--certa-green-deep` `#00753E`, `--certa-green-tint` `#E4F3EA`, `--signal-coral` `#ED1C25`, `--signal-coral-deep` `#B8232A`, `--ink` `#231F20`, `--ink-muted` `#55565A`, `--surface-tint` `#F6F9F7`, `--border` `#E3E5E4`, `--white`). No new colors introduced.
- **Nav unchanged.** `.primary-nav` (`index.html:31-38`) is not modified — the two new sections (Security, FAQ) are reachable by scroll/footer only, matching `PRODUCT.md`'s anti-reference against "dense, deeply-nested navigation."
- **Icon convention:** every new icon is `viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`, no inline `width`/`height`/`stroke` attribute (sized and colored via CSS on the containing class, exactly like the existing `.service-row__mark svg` rule at `styles.css:499`). Every icon is `aria-hidden="true"` and always paired with visible text — never icon-only.
- **Motion discipline:** all new reveal animation reuses the existing `[data-reveal]` system (`script.js:47-63`, `styles.css:89-108`) — default-visible markup, `html.js` arms the hidden pre-reveal state. The Task 2 stat count-up is the *only* new motion pattern; it must render the correct final value in the raw HTML (no-JS-safe) and only animate from 0 when armed by JS **and** `prefers-reduced-motion` is not set.
- **Accessibility baseline (WCAG 2.1 AA per `PRODUCT.md`):** body text ≥4.5:1 contrast, large text/headings ≥3:1, visible focus states, reduced-motion alternatives for all motion. The comparison table (Task 3) must be a real semantic `<table>`/`<caption>`/`<th scope>` — never a styled div grid. The FAQ (Task 6) must use native `<details>`/`<summary>` — never a custom JS accordion.
- **No test framework exists for this static site.** There's no `package.json` at the repo root and no e2e harness wired to `index.html` (unlike `portal/`, which has Playwright). Every task's verification step is a manual browser check with an explicit pass/fail criterion, run by opening `index.html` directly in a browser (double-click, or `file://` URL) — no server required.
- **Software logos (Task 1) — sourcing note:** Xero, QuickBooks, and Sage marks below are copied verbatim from simple-icons (MIT-licensed, industry-standard source for accurate brand SVGs). FreeAgent has no clean official SVG available there (confirmed 404 at implementation time) and keeps the site's existing text-chip treatment, per the spec's own explicit fallback rule ("Falls back to the existing text-chip treatment if a clean official SVG can't be sourced... never a redrawn/approximated logo"). Official brand hex colors could not be independently verified, so the spec's "grayscale by default, full color on hover" idea is implemented honestly as **muted opacity by default → full-opacity ink-black on hover** instead of a guessed color reveal — this is a documented adaptation, not a fabricated value.

---

## Task 1: Hero credential strip → real software logos

**Files:**
- Modify: `index.html:126-134` (`.credential-strip` markup inside the hero)
- Modify: `assets/styles.css:348-375` (`/* ---------- Credential strip ---------- */` block)
- Modify: `assets/styles.css:85-87` (add a reusable `.sr-only` utility, right after `a { color: inherit; }`)

**Interfaces:**
- Produces: `.sr-only` utility class, reused by Task 3 (comparison table's hidden column header) and Task 6 if needed.
- Consumes: existing `--ink`, `--ease-standard` tokens from `styles.css:2-37`.

- [ ] **Step 1: Add the `.sr-only` utility**

In `assets/styles.css`, immediately after line 85 (`a { color: inherit; }`), add:

```css
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
```

- [ ] **Step 2: Replace the Xero/QuickBooks/Sage text chips with real logos**

In `index.html`, replace the `.credential-strip` block (lines 126-134):

```html
        <div class="credential-strip" data-reveal style="--reveal-delay:520">
          <span class="credential-strip__label">We work in your stack</span>
          <div class="credential-chips">
            <span class="credential-chip">Xero</span>
            <span class="credential-chip">QuickBooks</span>
            <span class="credential-chip">Sage</span>
            <span class="credential-chip">FreeAgent</span>
          </div>
        </div>
```

with:

```html
        <div class="credential-strip" data-reveal style="--reveal-delay:520">
          <span class="credential-strip__label">We work in your stack</span>
          <div class="credential-chips">
            <span class="credential-logo" title="Xero">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm6.585 14.655c-1.485 0-2.69-1.206-2.69-2.689 0-1.485 1.207-2.691 2.69-2.691 1.485 0 2.69 1.207 2.69 2.691s-1.207 2.689-2.69 2.689zM7.53 14.644c-.099 0-.192-.041-.267-.116l-2.043-2.04-2.052 2.047c-.069.068-.16.108-.258.108-.202 0-.368-.166-.368-.368 0-.099.04-.191.111-.263l2.04-2.05-2.038-2.047c-.075-.069-.113-.162-.113-.261 0-.203.166-.366.368-.366.098 0 .188.037.258.105l2.055 2.048 2.048-2.045c.069-.071.162-.108.26-.108.211 0 .375.165.375.366 0 .098-.029.188-.104.258l-2.056 2.055 2.055 2.051c.068.069.104.16.104.258 0 .202-.165.368-.365.368h-.01zm8.017-4.591c-.796.101-.882.476-.882 1.404v2.787c0 .202-.165.366-.366.366-.203 0-.367-.165-.368-.366v-4.53c0-.204.16-.366.362-.366.166 0 .316.125.346.289.27-.209.6-.317.93-.317h.105c.195 0 .359.165.359.368 0 .201-.164.352-.375.359 0 0-.09 0-.164.008l.053-.002zm-3.091 2.205H8.625c0 .019.003.037.006.057.02.105.045.211.083.31.194.531.765 1.275 1.829 1.29.33-.003.631-.086.9-.229.21-.12.391-.271.525-.428.045-.058.09-.112.12-.168.18-.229.405-.186.54-.083.164.135.18.391.045.57l-.016.016c-.21.27-.435.495-.689.66-.255.164-.525.284-.811.345-.33.09-.645.104-.975.06-1.095-.135-2.01-.93-2.28-2.01-.06-.21-.09-.42-.09-.645 0-.855.421-1.695 1.125-2.205.885-.615 2.085-.66 3-.075.63.405 1.035 1.021 1.185 1.771.075.419-.21.794-.734.81l.068-.046zm6.129-2.223c-1.064 0-1.931.865-1.931 1.931 0 1.064.866 1.931 1.931 1.931s1.931-.867 1.931-1.931c0-1.065-.866-1.933-1.931-1.933v.002zm0 2.595c-.367 0-.666-.297-.666-.666 0-.367.3-.665.666-.665.367 0 .667.299.667.665 0 .369-.3.667-.667.666zm-8.04-2.603c-.91 0-1.672.623-1.886 1.466v.03h3.776c-.203-.855-.973-1.494-1.891-1.494v-.002z"/></svg>
              <span class="sr-only">Xero</span>
            </span>
            <span class="credential-logo" title="QuickBooks">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm.642 4.1335c.9554 0 1.7296.776 1.7296 1.7332v9.0667h1.6c1.614 0 2.9275-1.3156 2.9275-2.933 0-1.6173-1.3136-2.9333-2.9276-2.9333h-.6654V7.3334h.6654c2.5722 0 4.6577 2.0897 4.6577 4.667 0 2.5774-2.0855 4.6666-4.6577 4.6666H12.642zM7.9837 7.333h3.3291v12.533c-.9555 0-1.73-.7759-1.73-1.7332V9.0662H7.9837c-1.6146 0-2.9277 1.316-2.9277 2.9334 0 1.6175 1.3131 2.9333 2.9277 2.9333h.6654v1.7332h-.6654c-2.5725 0-4.6577-2.0892-4.6577-4.6665 0-2.5771 2.0852-4.6666 4.6577-4.6666Z"/></svg>
              <span class="sr-only">QuickBooks</span>
            </span>
            <span class="credential-logo" title="Sage">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.702 5.316C1.167 5.316 0 6.48 0 7.972c0 1.635 1.167 2.267 2.46 2.655 1.224.387 1.804.818 1.804 1.666 0 .86-.64 1.465-1.477 1.465-.84 0-1.566-.604-1.566-1.535 0-.516.242-.647.242-.934 0-.33-.227-.574-.599-.574-.423 0-.864.647-.864 1.566 0 1.48 1.266 2.57 2.787 2.57 1.535 0 2.701-1.163 2.701-2.656 0-1.623-1.166-2.267-2.472-2.655-1.209-.372-1.792-.818-1.792-1.666 0-.845.626-1.45 1.463-1.45.867 0 1.565.617 1.577 1.465.016.388.285.617.599.617a.592.592 0 0 0 .61-.647c-.027-1.48-1.263-2.543-2.771-2.543zm6.171 9.52c.683 0 1.21-.23 1.21-.69a.57.57 0 0 0-.557-.574c-.2 0-.341.085-.668.085-.882 0-1.577-.76-1.577-1.65 0-.962.71-1.725 1.608-1.725 1.009 0 1.65.775 1.65 1.895v2.054c0 .36.284.604.625.604.327 0 .61-.244.61-.604v-2.097c0-1.72-1.178-2.984-2.858-2.984-1.566 0-2.86 1.22-2.86 2.856 0 1.58 1.282 2.83 2.817 2.83zm6.257 3.848c1.535 0 2.701-1.163 2.701-2.656 0-1.635-1.166-2.267-2.472-2.655-1.209-.387-1.792-.818-1.792-1.666s.64-1.465 1.463-1.465c.84 0 1.577.604 1.577 1.535 0 .519-.241.647-.241.934 0 .33.226.574.583.574.441 0 .882-.647.882-1.566 0-1.48-1.278-2.57-2.801-2.57-1.535 0-2.687 1.163-2.687 2.656 0 1.623 1.152 2.267 2.46 2.655 1.224.372 1.804.818 1.804 1.666 0 .86-.64 1.45-1.462 1.45-.883 0-1.566-.601-1.578-1.465-.015-.388-.3-.604-.598-.604-.327 0-.626.216-.61.631.011 1.499 1.247 2.546 2.77 2.546zm6.171-3.849c.795 0 1.424-.229 1.862-.503.426-.272.595-.504.595-.76 0-.272-.2-.516-.568-.516-.441 0-.795.66-1.877.66-.952 0-1.707-.76-1.707-1.722 0-.95.725-1.724 1.635-1.724.982 0 1.508.647 1.508 1.062 0 .116-.085.174-.2.174h-1.194c-.326 0-.568.216-.568.503 0 .314.242.546.568.546h1.636c.625 0 1.009-.33 1.009-.89 0-1.408-1.194-2.512-2.774-2.512-1.566 0-2.83 1.263-2.83 2.84s1.312 2.842 2.905 2.842z"/></svg>
              <span class="sr-only">Sage</span>
            </span>
            <span class="credential-chip">FreeAgent</span>
          </div>
        </div>
```

- [ ] **Step 3: Style the logo chips**

In `assets/styles.css`, in the `/* ---------- Credential strip ---------- */` block, change:

```css
.credential-chips { display: flex; gap: 10px; flex-wrap: wrap; }
```

to:

```css
.credential-chips { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
```

Then add, directly after the existing `.credential-chip { ... }` rule:

```css
.credential-logo {
  display: inline-flex;
  align-items: center;
  height: 22px;
}
.credential-logo svg {
  height: 100%;
  width: auto;
  fill: var(--ink);
  opacity: 0.5;
  transition: opacity 200ms var(--ease-standard);
}
.credential-logo:hover svg { opacity: 1; }
```

- [ ] **Step 4: Manual verification**

Open `index.html` in a browser. Scroll to the hero's "We work in your stack" row.

Pass criteria:
- Xero, QuickBooks, and Sage render as real logo marks (not text), roughly 22px tall, muted/translucent by default.
- Hovering each logo brings it to full opacity; moving away returns it to muted.
- FreeAgent still renders as the original text chip, vertically centered with the logos.
- No layout shift or overlap at 375px viewport width (mobile).
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add index.html assets/styles.css
git commit -m "Replace hero credential text chips with real Xero/QuickBooks/Sage logos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Process section stat callouts

**Files:**
- Modify: `index.html:206-236` (`#process` section)
- Modify: `assets/styles.css:534-555` (`/* ---------- Process (earned sequence) ---------- */` block)
- Modify: `assets/script.js` (append new count-up behavior at end of file)

**Interfaces:**
- Consumes: `reducedMotion` constant already declared at `script.js:76` (`const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;`) — do not redeclare it.
- Produces: `[data-count-to]` / `[data-count-suffix]` attribute convention, used only in this task.

- [ ] **Step 1: Add the stat row markup**

In `index.html`, inside `#process`, insert a new block immediately after `</div>` that closes `.section__head` (after line 211, before `<div class="process">`):

```html
      <div class="process-stats" data-reveal style="--reveal-delay:120">
        <div class="process-stat">
          <span class="process-stat__value" data-count-to="1" data-count-suffix=" week">1 week</span>
          <span class="process-stat__label">to scoping</span>
        </div>
        <div class="process-stat">
          <span class="process-stat__value" data-count-to="60" data-count-suffix=" days">60 days</span>
          <span class="process-stat__label">to first reporting cycle</span>
        </div>
      </div>
```

The markup already shows the correct final values (`1 week`, `60 days`) — this is the no-JS-safe state. JS only resets to 0 and counts back up when it can.

- [ ] **Step 2: Style the stat row**

In `assets/styles.css`, in the `/* ---------- Process (earned sequence) ---------- */` block, add before `.process {`:

```css
.process-stats {
  display: flex;
  gap: var(--space-xl);
  flex-wrap: wrap;
  margin-bottom: var(--space-lg);
}
.process-stat { display: flex; flex-direction: column; gap: 4px; }
.process-stat__value {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(2rem, 4vw, 2.75rem);
  color: var(--certa-green-deep);
  font-variant-numeric: tabular-nums;
}
.process-stat__label { font-size: 0.875rem; color: var(--ink-muted); }
```

- [ ] **Step 3: Add the count-up behavior**

In `assets/script.js`, append at the end of the file:

```javascript
// ---------- Process stat count-up ----------
// Default markup already shows the final value (progressive enhancement, matching the
// [data-reveal] philosophy in styles.css): only reset to 0 and animate back up once
// html.js is armed, IntersectionObserver is available, and reduced-motion isn't set.
const countEls = document.querySelectorAll('[data-count-to]');
if (!reducedMotion && 'IntersectionObserver' in window && countEls.length) {
  const countDuration = 900; // ms

  function animateCount(el) {
    const target = parseInt(el.getAttribute('data-count-to'), 10) || 0;
    const suffix = el.getAttribute('data-count-suffix') || '';
    const start = performance.now();

    function step(now) {
      const progress = Math.min(1, (now - start) / countDuration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(target * eased);
      el.textContent = `${value}${suffix}`;
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = `${target}${suffix}`;
      }
    }
    requestAnimationFrame(step);
  }

  const countObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const suffix = entry.target.getAttribute('data-count-suffix') || '';
          entry.target.textContent = `0${suffix}`;
          animateCount(entry.target);
          countObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );
  countEls.forEach((el) => countObserver.observe(el));
}
```

- [ ] **Step 4: Manual verification**

Open `index.html` in a browser, scroll to `#process`.

Pass criteria:
- On first load (before scrolling there), the two stats aren't yet visible in viewport.
- Scrolling the stat row into view triggers a count-up from 0 to "1 week" and 0 to "60 days" over roughly a second.
- Reloading with OS-level "reduce motion" enabled (or via browser devtools' `prefers-reduced-motion: reduce` emulation) shows "1 week" / "60 days" immediately, with no count-up.
- Disabling JS entirely (or viewing page source) shows "1 week" / "60 days" as the static text — never "0".
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add index.html assets/styles.css assets/script.js
git commit -m "Add process section stat callout with reduced-motion-safe count-up

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: New section — Outsourcing vs. building in-house

**Files:**
- Modify: `index.html` (insert new `<section id="outsourcing">` between the closing `</section>` of `#process` and the opening `<section ... id="why-us">`, i.e. between current lines 236 and 238)
- Modify: `assets/styles.css` (append new `/* ---------- Outsourcing vs in-house comparison ---------- */` block after the Process block, before the Why Us block)

**Interfaces:**
- Consumes: `.sr-only` utility from Task 1, `.prose` from `styles.css:83`.
- Produces: `.comparison-table` classes, used only in this task.

- [ ] **Step 1: Insert the new section**

In `index.html`, between the `#process` section's closing `</section>` and the `#why-us` section's opening `<section ...>` tag, insert:

```html
  <section class="section section--tint" id="outsourcing">
    <div class="container">
      <div class="comparison-table-wrap" data-reveal>
        <table class="comparison-table">
          <caption>
            <h2>Building an in-house function, or scoping it out — what actually changes?</h2>
            <p class="prose">The honest tradeoffs finance teams weigh before this decision.</p>
          </caption>
          <thead>
            <tr>
              <th scope="col"><span class="sr-only">Comparison area</span></th>
              <th scope="col">Building in-house</th>
              <th scope="col">CERTA&amp; Advisory</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Getting started</th>
              <td>Recruiting, interviewing, and onboarding a new hire — typically weeks to months before they're productive.</td>
              <td>Scoping starts within a week; most clients see their first full reporting cycle inside 60 days.</td>
            </tr>
            <tr>
              <th scope="row">Coverage</th>
              <td>One person's leave, turnover, or notice period is a single point of failure for your books.</td>
              <td>A named team with defined roles — Engagement Lead, Senior Accountants, Payroll Specialists, Compliance Reviewers — so coverage doesn't depend on one person.</td>
            </tr>
            <tr>
              <th scope="row">Cost structure</th>
              <td>Salary, benefits, software licenses, training, and management time, whether or not workload is steady.</td>
              <td>One scoped, fixed-price engagement — priced before it starts, adjusted only when scope changes.</td>
            </tr>
            <tr>
              <th scope="row">Scaling up</th>
              <td>Re-hire and re-train each time the function needs to grow.</td>
              <td>Scope adjusts within the existing engagement and team structure.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
```

- [ ] **Step 2: Style the table**

In `assets/styles.css`, after the `/* ---------- Process (earned sequence) ---------- */` block and before `/* ---------- Why Choose CERTA& ---------- */`, add:

```css
/* ---------- Outsourcing vs in-house comparison ---------- */
.comparison-table-wrap { overflow-x: auto; }
.comparison-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 640px;
}
.comparison-table caption {
  text-align: left;
  caption-side: top;
  margin-bottom: var(--space-lg);
}
.comparison-table caption h2 {
  font-size: clamp(1.75rem, 2.6vw, 2.5rem);
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.01em;
  max-width: 46ch;
}
.comparison-table caption p { color: var(--ink-muted); margin-top: var(--space-sm); max-width: 60ch; }
.comparison-table th,
.comparison-table td {
  text-align: left;
  padding: var(--space-md);
  border-bottom: 1px solid var(--border);
  vertical-align: top;
  font-size: 0.9375rem;
}
.comparison-table thead th {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.8125rem;
  letter-spacing: 0.02em;
  color: var(--ink-muted);
  border-bottom: 2px solid var(--border);
  padding-bottom: var(--space-sm);
}
.comparison-table thead th:last-child { color: var(--certa-green-deep); }
.comparison-table tbody th[scope="row"] {
  font-family: var(--font-display);
  font-weight: 600;
  color: var(--ink);
  width: 18%;
  white-space: nowrap;
}
.comparison-table tbody td:first-of-type { color: var(--ink-muted); }
.comparison-table tbody td:last-child {
  border-left: 2px solid var(--certa-green-tint);
  color: var(--ink);
}
.comparison-table tbody tr:nth-child(even) { background: var(--white); }
```

- [ ] **Step 3: Manual verification**

Open `index.html` in a browser, scroll between Process and Why Us.

Pass criteria:
- New section appears with the tinted background, sitting between Process and Why Us.
- Table has two column headers ("Building in-house", "CERTA& Advisory") plus an invisible-but-screen-reader-readable first column header; four labeled rows.
- Even rows are white, odd rows show through to the section's tint — a visible alternation.
- At 375px viewport width, the table scrolls horizontally inside its own wrapper without the page itself gaining horizontal scroll.
- Selecting all page text and searching it confirms every sentence in the new table also appears (verbatim or as a clear paraphrase) elsewhere on the page — no invented numbers.
- No console errors.

- [ ] **Step 4: Commit**

```bash
git add index.html assets/styles.css
git commit -m "Add outsourcing vs in-house comparison table section

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Why Us icon grid

**Files:**
- Modify: `index.html:247-303` (all six `.why-us__item` blocks)
- Modify: `assets/styles.css:574-585` (`.why-us__num` rule and surrounding block)

**Interfaces:**
- Produces: `.why-us__item-head` / `.why-us__icon` classes, used only in this task.

- [ ] **Step 1: Restructure each `.why-us__item` to add an icon**

In `index.html`, replace all six `.why-us__item` blocks (inside `#why-us`, both `.why-us__col` columns) as follows. Item 01 (`styles.css` icon = graduation cap):

```html
          <div class="why-us__item" data-reveal style="--reveal-delay:0">
            <div class="why-us__item-head">
              <svg class="why-us__icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>
              <span class="why-us__num">01</span>
            </div>
            <div>
              <h3>Qualified and part-qualified accountants</h3>
              <p>An English-fluent pipeline of ACCA-track accountants — we hire and train from the top of it.</p>
            </div>
          </div>
```

Item 02 (plug):

```html
          <div class="why-us__item" data-reveal style="--reveal-delay:100">
            <div class="why-us__item-head">
              <svg class="why-us__icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5"/><path d="M15 8V2"/><path d="M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z"/><path d="M9 8V2"/></svg>
              <span class="why-us__num">02</span>
            </div>
            <div>
              <h3>Your software, not ours</h3>
              <p>We work directly in Xero, QuickBooks, Sage or FreeAgent — no migration, no new tool for your team to learn.</p>
            </div>
          </div>
```

Item 03 (scale):

```html
          <div class="why-us__item" data-reveal style="--reveal-delay:200">
            <div class="why-us__item-head">
              <svg class="why-us__icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="m19 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"/><path d="m5 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M7 21h10"/></svg>
              <span class="why-us__num">03</span>
            </div>
            <div>
              <h3>Meaningful cost efficiency</h3>
              <p>Lower delivery cost than an equivalent in-house or onshore-outsourced team, without cutting corners on oversight.</p>
            </div>
          </div>
```

Item 04 (clock):

```html
          <div class="why-us__item" data-reveal style="--reveal-delay:0">
            <div class="why-us__item-head">
              <svg class="why-us__icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              <span class="why-us__num">04</span>
            </div>
            <div>
              <h3>Built around your working day</h3>
              <p>Working hours structured to overlap with UK, US, Canadian and European business hours, not the other way around.</p>
            </div>
          </div>
```

Item 05 (file-check):

```html
          <div class="why-us__item" data-reveal style="--reveal-delay:100">
            <div class="why-us__item-head">
              <svg class="why-us__icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="m9 15 2 2 4-4"/></svg>
              <span class="why-us__num">05</span>
            </div>
            <div>
              <h3>Fixed scope, fixed price</h3>
              <p>Every engagement is scoped before it starts — no vague retainers, no surprise line items later.</p>
            </div>
          </div>
```

Item 06 (lock):

```html
          <div class="why-us__item" data-reveal style="--reveal-delay:200">
            <div class="why-us__item-head">
              <svg class="why-us__icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span class="why-us__num">06</span>
            </div>
            <div>
              <h3>Confidentiality by default</h3>
              <p>Client data handled under signed confidentiality agreements and role-based access, from day one.</p>
            </div>
          </div>
```

- [ ] **Step 2: Update the CSS for the new head row**

In `assets/styles.css`, replace:

```css
.why-us__num {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.375rem;
  color: var(--certa-green);
  flex: none;
  width: 2ch;
}
```

with:

```css
.why-us__item-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}
.why-us__icon {
  width: 22px;
  height: 22px;
  stroke: var(--certa-green);
  flex: none;
}
.why-us__num {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.375rem;
  color: var(--certa-green);
}
```

- [ ] **Step 3: Manual verification**

Open `index.html` in a browser, scroll to `#why-us`.

Pass criteria:
- All six items show a small line-icon beside their numeral, above the heading/body text.
- Icons are visually consistent in size and stroke weight with each other and with the `.service-row__mark` icons in Services above.
- Layout is unchanged otherwise — same two-column arrangement, same reveal stagger.
- At 375px viewport width, items still stack cleanly with no icon/numeral overlap.
- No console errors.

- [ ] **Step 4: Commit**

```bash
git add index.html assets/styles.css
git commit -m "Add hand-drawn icons to the Why Us grid

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: New section — Confidentiality & Security

**Files:**
- Modify: `index.html` (insert new `<section id="security">` between the closing `</section>` of `#why-us` and the opening `<section ... id="team">`, i.e. between current lines 307 and 309)
- Modify: `assets/styles.css` (append new `/* ---------- Confidentiality & Security ---------- */` block after the Why Us block, before `/* ---------- Our Clients ---------- */`)
- Modify: `assets/styles.css:723-743` (`@media (max-width: 860px)` block — add responsive override)

**Interfaces:**
- Consumes: `.section`, `.section--tint`, `.section__head`, `.prose` from the existing section shell (`styles.css:460-476`).
- Produces: `.security-grid` / `.security-card` classes, used only in this task.

- [ ] **Step 1: Insert the new section**

In `index.html`, between the `#why-us` section's closing `</section>` and the `#team` section's opening `<section ...>` tag, insert:

```html
  <section class="section section--tint" id="security">
    <div class="container">
      <div class="section__head">
        <h2 data-reveal>Your data, handled like it's ours to lose.</h2>
        <p class="prose" data-reveal style="--reveal-delay:80">Three structural facts about how an engagement actually runs, not a badge wall.</p>
      </div>

      <div class="security-grid">
        <div class="security-card" data-reveal style="--reveal-delay:0">
          <div class="security-card__mark">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
          </div>
          <h3>Signed before anything moves.</h3>
          <p>Every engagement runs under a signed confidentiality agreement before any ledger access, document, or credential changes hands.</p>
        </div>

        <div class="security-card" data-reveal style="--reveal-delay:80">
          <div class="security-card__mark">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h3>Role-based access, not open access.</h3>
          <p>Only the named team members on your engagement — your Engagement Lead, Senior Accountants, and Compliance Reviewer — can see your books. Access is scoped to the role, not the office.</p>
        </div>

        <div class="security-card" data-reveal style="--reveal-delay:160">
          <div class="security-card__mark">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
          </div>
          <h3>Your software, not a copy of it.</h3>
          <p>We work directly inside your existing Xero, QuickBooks, Sage, or FreeAgent — nothing is migrated to a separate system, which means nothing exists in a second place to secure.</p>
        </div>
      </div>
    </div>
  </section>
```

- [ ] **Step 2: Style the card grid**

In `assets/styles.css`, after the `/* ---------- Why Choose CERTA& ---------- */` block and before `/* ---------- Our Clients ---------- */`, add:

```css
/* ---------- Confidentiality & Security ---------- */
.security-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-lg);
}
.security-card__mark {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--white);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-sm);
}
.security-card__mark svg { width: 20px; height: 20px; stroke: var(--certa-green-deep); }
.security-card h3 { font-size: 1.0625rem; font-weight: 600; margin-bottom: 8px; }
.security-card p { color: var(--ink-muted); font-size: 0.9375rem; }
```

- [ ] **Step 3: Add the mobile breakpoint override**

In `assets/styles.css`, inside the existing `@media (max-width: 860px)` block, add:

```css
  .security-grid { grid-template-columns: 1fr; gap: var(--space-md); }
```

- [ ] **Step 4: Manual verification**

Open `index.html` in a browser, scroll between Why Us and Team.

Pass criteria:
- New tinted section appears with heading "Your data, handled like it's ours to lose." and three cards.
- Each card shows a distinct icon (shield / lock / sync-arrows), a bold micro-heading, and 1-2 sentences of body copy.
- At 375px viewport width, cards stack to a single column with readable spacing.
- Every sentence of body copy also appears (verbatim or as a clear paraphrase) elsewhere on the page (Why Us item 06, Team section, Services) — no new facts.
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add index.html assets/styles.css
git commit -m "Add Confidentiality & Security section

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: New section — FAQ

**Files:**
- Modify: `index.html` (insert new `<section id="faq">` between the closing `</section>` of `#clients` and the opening `<section ... id="careers">`, i.e. between current lines 379 and 381)
- Modify: `assets/styles.css` (append new `/* ---------- FAQ ---------- */` block after `/* ---------- Our Clients ---------- */`, before `/* ---------- Careers ---------- */`)
- Modify: `assets/styles.css:775-777` (`@media (prefers-reduced-motion: reduce)` block — add override for the summary marker transition)

**Interfaces:**
- Consumes: `.container--narrow` from `styles.css:73-75`.
- Produces: `.faq-head`, `.faq-list`, `.faq-item` classes, used only in this task.

- [ ] **Step 1: Insert the new section**

In `index.html`, between the `#clients` section's closing `</section>` and the `#careers` section's opening `<section ...>` tag, insert:

```html
  <section class="section" id="faq">
    <div class="container container--narrow">
      <div class="faq-head">
        <h2 data-reveal>Questions finance teams ask before they scope a call.</h2>
      </div>

      <div class="faq-list">
        <details class="faq-item" data-reveal style="--reveal-delay:0">
          <summary>How do you keep our data secure?</summary>
          <p>Every engagement runs under a signed confidentiality agreement first, access is role-based to your named team only, and we work inside your own software rather than migrating your data anywhere else.</p>
        </details>
        <details class="faq-item" data-reveal style="--reveal-delay:40">
          <summary>What happens if our main contact is unavailable?</summary>
          <p>You're never staffed by one freelancer. Each engagement has a named Engagement Lead plus Senior Accountants, Payroll Specialists, and a Compliance Reviewer, so coverage doesn't depend on a single person.</p>
        </details>
        <details class="faq-item" data-reveal style="--reveal-delay:80">
          <summary>Do we have to migrate to new software?</summary>
          <p>No. We work directly in Xero, QuickBooks, Sage, or FreeAgent — whichever you already use.</p>
        </details>
        <details class="faq-item" data-reveal style="--reveal-delay:120">
          <summary>How much of the working day do we actually overlap?</summary>
          <p>Our working hours are structured to overlap with UK, US, Canadian, and European business hours — see the live London/Dhaka times in the hero above.</p>
        </details>
        <details class="faq-item" data-reveal style="--reveal-delay:160">
          <summary>What if our scope needs to change later?</summary>
          <p>Every engagement is reviewed on a regular cadence and adjusted as your business changes — scope isn't fixed forever, just fixed and clear at any given time.</p>
        </details>
        <details class="faq-item" data-reveal style="--reveal-delay:200">
          <summary>Which jurisdictions and software do you support?</summary>
          <p>UK, USA, Canada, and Europe for jurisdictions; Xero, QuickBooks, Sage, and FreeAgent for software.</p>
        </details>
      </div>
    </div>
  </section>
```

- [ ] **Step 2: Style the FAQ**

In `assets/styles.css`, after `/* ---------- Our Clients ---------- */` and before `/* ---------- Careers ---------- */`, add:

```css
/* ---------- FAQ ---------- */
.faq-head { max-width: 640px; margin-bottom: var(--space-lg); }
.faq-head h2 {
  font-size: clamp(1.75rem, 2.6vw, 2.5rem);
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.01em;
}
.faq-list { border-top: 1px solid var(--border); }
.faq-item { border-bottom: 1px solid var(--border); padding: var(--space-md) 0; }
.faq-item summary {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.0625rem;
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
}
.faq-item summary::-webkit-details-marker { display: none; }
.faq-item summary::after {
  content: '+';
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--certa-green-deep);
  flex: none;
  transition: transform 200ms var(--ease-standard);
}
.faq-item[open] summary::after { transform: rotate(45deg); }
.faq-item p { color: var(--ink-muted); margin-top: var(--space-sm); max-width: 62ch; }
.faq-item summary:focus-visible { outline: 2px solid var(--certa-green); outline-offset: 4px; }
```

- [ ] **Step 3: Add the reduced-motion override**

In `assets/styles.css`, inside the final `@media (prefers-reduced-motion: reduce) { .mobile-nav { transition: none; } }` block, add a second rule:

```css
  .faq-item summary::after { transition: none; }
```

- [ ] **Step 4: Manual verification**

Open `index.html` in a browser, scroll between Clients and Careers.

Pass criteria:
- Six FAQ rows appear, each collapsed by default, with a "+" marker.
- Clicking (or pressing Enter/Space while focused via Tab) any question expands it, rotating its marker to "×"; clicking again collapses it.
- Multiple items can be open at once (native `<details>` behavior — not enforced single-open).
- Tabbing through the page reaches each `<summary>` and shows a visible focus outline.
- With JavaScript disabled entirely, the accordion still opens/closes (native HTML behavior, zero dependency on `script.js`).
- Every answer's content also appears (verbatim or as a clear paraphrase) elsewhere on the page — no new facts.
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add index.html assets/styles.css
git commit -m "Add FAQ section with native details/summary accordion

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Full-page integration pass

**Files:** none (verification only — no code changes expected; this task exists to catch anything the six isolated per-task checks above couldn't, such as spacing between adjacent new/old sections, and cumulative regressions).

**Interfaces:** none.

- [ ] **Step 1: Full scroll-through at desktop width (≥1320px)**

Open `index.html`. Scroll from the very top to the footer in one continuous pass.

Pass criteria:
- Section order is: Hero → Services → Process (with new stat row) → Outsourcing comparison (new) → Why Us (with new icons) → Security (new) → Team → Clients → FAQ (new) → Careers → Contact → Footer.
- Every section's top/bottom spacing looks consistent with its neighbors (no doubled-up or missing `var(--space-xl)` padding at any of the four new-section boundaries).
- Tint/white section backgrounds still alternate sensibly through the new sections (no two tinted sections touching without a white section between them, unless intentional).

- [ ] **Step 2: Full scroll-through at mobile width (375px)**

Resize the browser (or use devtools device emulation) to 375px width and repeat the scroll-through.

Pass criteria:
- No element causes horizontal page scroll (check by confirming `document.documentElement.scrollWidth === document.documentElement.clientWidth` in the console, or visually).
- The comparison table scrolls horizontally within its own wrapper only.
- All six Why Us items and three Security cards stack to single columns.
- Mobile nav (hamburger menu) still opens/closes correctly and is unaffected by the new sections.

- [ ] **Step 3: Reduced-motion pass**

Enable `prefers-reduced-motion: reduce` (OS setting or devtools emulation) and reload.

Pass criteria:
- Process stats show "1 week" / "60 days" immediately, no count-up.
- FAQ marker rotation is instant, no animated transition.
- All existing reveal/parallax/preloader reduced-motion behavior (unrelated to this plan) is still intact — spot-check the hero and Why Us visual still render fully visible with no animation.

- [ ] **Step 4: Console and link check**

With devtools console open, reload the page and click through every nav link (`#services`, `#why-us`, `#team`, `#clients`, `#careers`, `#contact`) plus scroll-check the two new unlinked sections (`#outsourcing`, `#security`, `#faq` via direct URL hash).

Pass criteria:
- Zero console errors or warnings at any point.
- Every existing nav anchor still scrolls to the correct (unrenamed) section.
- `index.html#outsourcing`, `index.html#security`, and `index.html#faq` each scroll to the correct new section when opened directly.

- [ ] **Step 5: Content-honesty final check**

Read every new sentence introduced across Tasks 1-6 (credential logos' `title`/`sr-only` text, process stat labels, comparison table cells, Why Us headings, Security cards, FAQ answers) against `index.html`'s pre-existing copy, `PRODUCT.md`, and `DESIGN.md`.

Pass criteria:
- Every new sentence is either a verbatim reuse or a direct, non-exaggerating paraphrase of something already stated in one of those three sources.
- No numbers appear anywhere that aren't "1 week" / "60 days" (already stated in the pre-existing Process intro paragraph) or the four jurisdiction/four software names (already stated throughout the pre-existing site).

- [ ] **Step 6: Commit (only if Steps 1-5 required fixes)**

If any pass criteria above failed and required a code fix, commit that fix now:

```bash
git add index.html assets/styles.css assets/script.js
git commit -m "Fix integration issues found in full-page verification pass

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

If nothing needed fixing, skip this step — there's nothing new to commit.

---

## Self-Review

**Spec coverage:**
1. Confidentiality & Security section → Task 5. ✅
2. Outsourcing vs. building in-house comparison → Task 3. ✅
3. FAQ → Task 6. ✅
4. Hero credential strip → real logos → Task 1. ✅
5. Process section stat callouts → Task 2. ✅
6. Why Us icon grid → Task 4. ✅
7. Visual/motion discipline (reuse `[data-reveal]`, count-up is the only new motion, reduced-motion respected) → enforced in Global Constraints + verified in Tasks 2 and 7 Step 3. ✅
8. Accessibility (semantic table, native details/summary, aria-hidden icons, reduced-motion, AA contrast via existing tokens) → enforced per-task and re-verified in Task 7. ✅
9. Out-of-scope guardrails (no fabricated content, no palette/nav shift, no new deps, no portal changes) → enforced in Global Constraints and re-verified in Task 7 Step 5. ✅

**Placeholder scan:** no "TBD"/"TODO"/"handle appropriately" language anywhere in the tasks above — every step has literal HTML/CSS/JS to write and a concrete pass/fail check.

**Type/naming consistency:** `data-count-to` / `data-count-suffix` (Task 2 markup) match the attribute names read by `script.js` in the same task. `.sr-only` (defined Task 1) is reused verbatim in Task 3. `.why-us__item-head` / `.why-us__icon` (Task 4 CSS) match the class names used in Task 4's HTML. `.security-card__mark` / `.security-grid` (Task 5 CSS) match Task 5's HTML. `.faq-head` / `.faq-list` / `.faq-item` (Task 6 CSS) match Task 6's HTML. `.comparison-table-wrap` / `.comparison-table` (Task 3 CSS) match Task 3's HTML.
