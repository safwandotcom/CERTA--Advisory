# Brand refresh, portal preloader, hero copy, and UK/BD live clock — Design

**Date:** 2026-08-08
**Status:** Approved for planning

## Context

Four related changes to the CERTA& Advisory marketing site (`index.html` + `assets/`) and the client/employee portal (`portal/`, a Next.js App Router app):

1. Replace the logo everywhere with the updated lockup supplied by the user (`Certa& Advisory.Logo.png` / `.pdf`, provided 2026-08-08).
2. Give the portal a branded preloader on every page load/navigation, matching the one the marketing site already has.
3. Remove "ICAB" and the "delivered from Dhaka" hero line; replace with updated copy.
4. Add a live UK time / Bangladesh time display to the hero, to make the UK-hours overlap obvious at a glance.

Source assets for the new logo, as supplied:
- `C:\Users\HP\Downloads\Certa& Advisory.Logo.png` (18750×8466px, RGBA, transparent background)
- `C:\Users\HP\Downloads\Certa& Advisory Logo.pdf` (single page, same artwork, vector)

Only one lockup variant was supplied (full-color, horizontal, on transparent background). All other variants currently in use (white/reversed, mark-only, favicon) must be derived from it.

## 1. Logo replacement

### Current asset inventory

| File | Used by |
|---|---|
| `assets/certa-lockup.png` | marketing header, footer (color) |
| `assets/certa-lockup-white.png` | marketing footer (white, dark background) |
| `assets/certa-mark.png` | marketing preloader, hero visual, mobile nav, why-us visual |
| `assets/certa-mark-white.png` | (currently unused — kept for parity) |
| `assets/favicon.ico` | marketing `<link rel="icon">` |
| `portal/public/brand/certa-lockup.png` | portal sidebar (expanded), onboarding layout |
| `portal/public/brand/certa-mark.png` | portal login page |
| `portal/app/favicon.ico` | portal tab icon |

### Derivation approach

All variants are generated programmatically from the supplied PNG (highest-res source), matching the existing files' conventions exactly:

- **Lockup (color):** tight-cropped to the visible artwork with the same proportional padding as the current `certa-lockup.png` (568×220, transparent background), re-exported at a size appropriate for @2x display without a multi-megabyte file.
- **Lockup (white):** same crop, but every non-transparent pixel forced to solid white — this reproduces the existing convention (confirmed by inspecting the current `certa-lockup-white.png`: the *entire* mark, ring + dash + wordmark, goes white on dark backgrounds, not just the text) and matches `DESIGN.md`'s existing rule ("never recolor the ring or dash; on dark backgrounds, use the all-white reversed lockup rather than tinting the brand colors down").
- **Mark only (color + white):** the ring+dash glyph cropped out of the lockup on its own square transparent canvas (216×216, matching current padding ratio), plus a white version using the same recoloring approach.
- **Favicon:** multi-resolution `.ico` (16/32/48px) generated from the mark-only crop.

All eight resulting files replace their same-named counterparts in `assets/` and `portal/public/brand/` (plus regenerating both `favicon.ico` files) — no HTML/TSX markup changes needed since filenames are unchanged.

### Brand color update

Sampled directly from the supplied artwork at full resolution (solid fill, not anti-aliased):

- Green: `#00904C` — **unchanged**, matches the current `--certa-green` exactly.
- Red/coral: `#ED1C25` — new, replacing the current `--signal-coral` (`#F15A40`).

Both marketing (`assets/styles.css`) and portal (`portal/app/globals.css`) define this as a single CSS custom property each, so the color updates in exactly two places and every consumer (buttons, hover states, badges, error/pending states, hero ring decoration) inherits it automatically. Token names (`--signal-coral`, `--signal-coral-deep`, Tailwind utilities like `bg-signal-coral`) are **not** renamed — only their hex values change — to avoid an unnecessary multi-file rename across the portal's Tailwind class usages.

**Contrast fix:** `#ED1C25` is darker/more saturated than the old coral. Per the user's decision, coral/red buttons switch their label text from `--ink` (dark) to `--white`. The hover/"deep" shade is computed by applying the same HSL lightness/saturation drop the current `signal-coral` → `signal-coral-deep` pair uses, giving a deep shade with strong contrast against white text.

`DESIGN.md`'s color swatch table and contrast notes are updated to reflect the new hex values and the ink→white button-text change.

## 2. Portal preloader

The portal (Next.js App Router) currently has no preloader. A new client component is mounted once in `portal/app/layout.tsx`:

- Visually: same language as the marketing site's preloader (white full-screen overlay, spinning ring mark, iris-out reveal) — reusing the same mark asset and equivalent CSS, adapted into the portal's Tailwind/global CSS setup.
- Trigger: shows on (a) first load of any portal URL, and (b) every client-side navigation to a new route (login → onboarding → dashboard → projects → admin → manager, etc.). Because App Router doesn't emit a native "navigation started" event for client-side transitions between static routes, this is a small hand-built listener: intercept clicks on internal `<Link>`/`<a>` elements to show the overlay immediately, and hide it once `usePathname()` reflects the new route (with a short minimum-display floor, as the marketing site does, so it registers as a moment rather than a flash).
- Timing: minimum display ~400–600ms for in-app navigations (vs. the marketing site's 1.8s one-time landing moment) — long enough to read as intentional, short enough not to make the portal feel slow.
- Respects `prefers-reduced-motion`, same as the marketing site's version.

## 3. Copy changes

Marketing site (`index.html`) only:

- Hero accent line: `"delivered from Dhaka."` → `"built around your working day."` (full headline: *"Accounting certainty, built around your working day."*)
- Why-us item 1 body copy: `"An English-fluent pipeline of ACCA and ICAB-track accountants — we hire and train from the top of it."` → `"An English-fluent pipeline of ACCA-track accountants — we hire and train from the top of it."`
- Why-us visual floater badge: `"ACCA / ICAB"` → `"ACCA-qualified"`
- Footer office address (`81/A, Kakrail, Dhaka-1000, Bangladesh`) and footer bottom bar (`Dhaka, Bangladesh`) are **left unchanged** — real postal/location info, not the removed positioning line.

## 4. UK/BD live clock widget

**Placement:** in the hero's left column, inserted after the CTA buttons (`.hero__actions`) and before the existing "Built for teams in UK/USA/Canada/Europe" tags (`.hero__markets`), so the reading order is: headline → lede → CTA → **live clocks** → trust badges → software chips.

**Content:**
- A short caption above the widget: *"Live in your working day"*.
- Two small clock cards side by side, one per city:
  - An animated analog clock face (SVG circle + hour/minute hands), drawn in brand colors — green ring, red minute hand — matching the existing hand-built motion system already in `script.js` (no chart/clock library, no images).
  - City label (`LONDON`, `DHAKA`) and a live-updating digital time readout underneath (e.g. `09:41`).
  - A status dot + label computed from each city's local time: `● Business hours` (green dot) during that city's working hours, `○ After hours` (muted dot) otherwise.
- Time is computed client-side via `Intl.DateTimeFormat` with `timeZone: 'Europe/London'` and `'Asia/Dhaka'`, so BST/GMT transitions are handled automatically without manual DST logic. Clock hands and digital readout update every second (`setInterval`); a subtle day/night tint on each card's background shifts based on that city's local hour.
- "Business hours" is defined as Mon–Fri, 09:00–18:00 in each city's local time — consistent with the hero copy's "built around your working day" line.
- Respects `prefers-reduced-motion`: hands still show the correct time but skip the smooth sweep transition; the widget itself never auto-scrolls or steals focus.

**Scope note:** this widget is marketing-site-only (hero), not added to the portal.

## Testing / verification

- Visual check of all 8 regenerated logo files against their old counterparts (correct crop, transparency, white-recolor) at actual display size in both codebases.
- Contrast check: new red vs. white button text (target ≥ 4.5:1), confirmed via computed luminance, not eyeballing.
- Portal preloader: manually click through login → dashboard → projects → admin → manager and confirm the overlay fires on each transition without getting "stuck" (i.e., always resolves once the new route mounts) and without breaking Next.js's back/forward navigation.
- Clock widget: verify London/Dhaka times against a known reference at test time, and confirm the business-hours dot flips correctly using both a business-hours and after-hours test time.
- `prefers-reduced-motion` behavior spot-checked for the portal preloader and the clock widget.

## Out of scope

- No changes to the office address / footer location text.
- No third-party fonts, icon packs, or clock/animation libraries added — everything is hand-built to match the existing vanilla CSS/JS craft level.
- No rename of the `signal-coral` CSS variable / Tailwind token names.
- No preloader-on-scroll / section-entry transitions on the one-page marketing site (out of scope per user decision — the marketing site's existing single-load preloader already covers "page load").
