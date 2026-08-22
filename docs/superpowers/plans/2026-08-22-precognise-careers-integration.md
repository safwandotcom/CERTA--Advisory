# PreCognise Careers Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded, generic role-chip list in `index.html#careers` with real, clickable links to the 3 CERTA& Advisory job postings already live on PreCognise, each opening that job's existing `precognise.co/j/{slug}` page (full description + apply flow) in a new tab.

**Architecture:** Vanilla HTML/CSS, no build step, no JS, no fetch, no PreCognise-repo changes. One markup block in `index.html` is hand-edited to list the current openings by title + PreCognise URL; matching CSS is added to `assets/styles.css` following the file's existing `/* ---------- Name ---------- */` block convention. This is a static site — future postings/closures are a manual `index.html` edit + push, not an automated sync.

**Tech Stack:** Static HTML5, CSS custom properties (design tokens already in `assets/styles.css:2-37`). No npm, no framework, no icon library, no new dependency of any kind.

**Spec:** `docs/superpowers/specs/2026-08-22-precognise-careers-integration-design.md`

## Global Constraints

- **Scope:** only `index.html` and `assets/styles.css`. `E:\PreCognize\frontend` (the PreCognise repo) is not touched by this plan — do not open or edit any file there. `assets/script.js` and the CERTA `portal/` subapp are also untouched.
- **No fabricated job data.** Every title, location, and URL placed into `index.html` must be copied from the actual live posting at its `precognise.co/j/{slug}` URL, verified by opening it — never guessed or invented (`PRODUCT.md` principle #9: never fabricate Careers content).
- **No new runtime dependencies, JS, or build step.** This site is deployed on Vercel as static files with zero build step — that must remain true after this change.
- **Brand tokens only** — reuse existing custom properties from `assets/styles.css:2-37` (`--ink`, `--ink-muted`, `--certa-green`, `--certa-green-deep`, `--surface-tint`, `--border`, `--radius-md`, `--space-sm`, `--space-md`, `--ease-standard`, `--shadow-hover`). No new colors introduced.
- **External-link convention:** every link to `precognise.co` opens in a new tab (`target="_blank" rel="noopener"`) and visually signals it leaves the site (arrow glyph, `aria-hidden="true"`, never the only indicator — link text itself says "PreCognise").
- **Accessibility baseline (WCAG 2.1 AA per `PRODUCT.md`):** visible focus states on every link (matching the existing `:focus-visible` pattern at `assets/styles.css:870`), body text ≥4.5:1 contrast, link text descriptive on its own (no bare "Apply" or "Click here").
- **No test framework exists for this static site.** No `package.json` at the repo root, no e2e harness wired to `index.html`. Every verification step below is a manual browser check with an explicit pass/fail criterion, run by opening `index.html` directly (double-click, or a `file://` URL) — no server required.

---

## Task 1: Replace the Careers role chips with real PreCognise job links

**Files:**
- Modify: `index.html:580-585` (`.careers-roles` block inside `#careers`)
- Modify: `assets/styles.css:884-885` (append new rules to the `/* ---------- Careers ---------- */` block, right after `.careers-grid`)

**Interfaces:**
- Produces: `.careers-jobs` (container), `.careers-job` (link row), `.careers-job__title`, `.careers-job__cta` — no other file depends on these; this is the only task in the plan.
- Consumes: existing tokens `--ink`, `--ink-muted`, `--certa-green`, `--certa-green-deep`, `--surface-tint`, `--border`, `--radius-md`, `--space-sm`, `--space-md`, `--ease-standard`, `--shadow-hover` from `assets/styles.css:2-37`.

- [ ] **Step 1: Verify the current live postings before writing anything**

Open each of these three URLs in a browser and note the exact job title and location shown on the page (confirmed at plan-writing time, but PreCognise postings can be edited — re-check before typing them into `index.html`):

| Slug | URL | Title (verify) | Location (verify) |
|---|---|---|---|
| `6tt8u7ag` | `https://precognise.co/j/6tt8u7ag` | Senior Accountant/Client Accounts Manager | On-site |
| `wejpef2s` | `https://precognise.co/j/wejpef2s` | BookKeeper | Kakrail, Dhaka |
| `k4tjg37j` | `https://precognise.co/j/k4tjg37j` | Client Services Coordinator (Bangladesh Office) | Kakrail, Dhaka |

If any title/location has changed since this table was written, use the current live text in Step 2 instead — never the stale value from this table.

- [ ] **Step 2: Replace the `.careers-roles` chip block in `index.html`**

Find this block at `index.html:580-585`:

```html
          <div class="careers-roles">
            <span class="credential-chip">Senior Accountants</span>
            <span class="credential-chip">Payroll Associates</span>
            <span class="credential-chip">Bookkeepers</span>
            <span class="credential-chip">Tax &amp; Compliance Associates</span>
          </div>
```

Replace it with:

```html
          <div class="careers-jobs" data-reveal style="--reveal-delay:80">
            <a class="careers-job" href="https://precognise.co/j/6tt8u7ag" target="_blank" rel="noopener">
              <span class="careers-job__title">Senior Accountant/Client Accounts Manager</span>
              <span class="careers-job__cta">View &amp; apply on PreCognise <span aria-hidden="true">↗</span></span>
            </a>
            <a class="careers-job" href="https://precognise.co/j/wejpef2s" target="_blank" rel="noopener">
              <span class="careers-job__title">BookKeeper</span>
              <span class="careers-job__cta">View &amp; apply on PreCognise <span aria-hidden="true">↗</span></span>
            </a>
            <a class="careers-job" href="https://precognise.co/j/k4tjg37j" target="_blank" rel="noopener">
              <span class="careers-job__title">Client Services Coordinator (Bangladesh Office)</span>
              <span class="careers-job__cta">View &amp; apply on PreCognise <span aria-hidden="true">↗</span></span>
            </a>
          </div>
```

(Use the verified title text from Step 1 if it differs from the table above. Do not change the surrounding `<h2>`/`<p class="prose">` above this block, or the `.careers-note` block below it — both stay exactly as they are today.)

- [ ] **Step 3: Add the `.careers-jobs` / `.careers-job` CSS**

In `assets/styles.css`, in the `/* ---------- Careers ---------- */` block, immediately after the `.careers-grid { ... }` rule (`assets/styles.css:879-884`) and before the existing `.careers-roles` rule, add:

```css
.careers-jobs { display: flex; flex-direction: column; margin-top: var(--space-md); border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; }
.careers-job {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: var(--space-sm);
  color: var(--ink);
  text-decoration: none;
  border-bottom: 1px solid var(--border);
  transition: background 200ms var(--ease-standard);
}
.careers-job:last-child { border-bottom: none; }
.careers-job:hover { background: var(--surface-tint); }
.careers-job:focus-visible { outline: 2px solid var(--certa-green); outline-offset: -2px; }
.careers-job__title { font-weight: 600; }
.careers-job__cta {
  flex: none;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--certa-green-deep);
  white-space: nowrap;
}
```

The existing `.careers-roles { ... }` rule at `assets/styles.css:885` is now dead CSS — nothing in the HTML uses `.careers-roles` after Step 2. Delete it in this same step to avoid leaving unused rules behind:

Delete this line:

```css
.careers-roles { display: flex; gap: 10px; flex-wrap: wrap; margin-top: var(--space-md); }
```

- [ ] **Step 4: Manual verification in a browser**

Open `index.html` directly in a browser (double-click the file, or its `file://` path) and check:

1. Scroll to the Careers section (or click "Careers" in the nav). **Pass:** you see 3 rows, each showing a job title on the left and "View & apply on PreCognise ↗" on the right, styled as a bordered card matching the section's existing visual language (not the old pill-shaped chips).
2. Hover each row. **Pass:** background tints to the light green-gray surface color, cursor shows a pointer.
3. Tab through the page with the keyboard until each job row is focused. **Pass:** a visible green outline appears on the focused row.
4. Click each of the 3 rows (or open each URL directly if your browser blocks `file://` → `https://` navigation from a click). **Pass:** each opens the correct PreCognise job page in a new tab — `6tt8u7ag` → Senior Accountant/Client Accounts Manager, `wejpef2s` → BookKeeper, `k4tjg37j` → Client Services Coordinator — and that page shows a full description and an apply option.
5. Confirm the "Don't see your role listed? Send your CV" block still renders unchanged directly below the job list.
6. Resize the browser to a narrow (mobile) width. **Pass:** the job rows stack cleanly with no horizontal overflow or clipped text (the existing `.careers-grid { grid-template-columns: 1fr; }` mobile rule at `assets/styles.css:973` already handles the two-column-to-one-column collapse; this task doesn't need a new media-query rule for `.careers-jobs` itself since it's already a single-column flex list).

If any check fails, fix the HTML/CSS from Step 2/3 and re-run Step 4 before continuing.

- [ ] **Step 5: Commit**

```bash
cd "E:\CERTA ADVISORY"
git add index.html assets/styles.css
git commit -m "Replace Careers role chips with live PreCognise job links

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

This is the only task in the plan — once Step 5's commit lands and is pushed (`git push`, triggering Vercel's auto-deploy per this repo's existing deploy model), the feature is live at certaadvisory.com.
