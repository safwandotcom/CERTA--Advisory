# Signature Motion Redesign — Design

**Date:** 2026-08-11
**Status:** Approved for planning

## Context

The marketing site's content redesign (security section, outsourcing comparison table, FAQ, Why-Us icons, credential logos, process stat callouts — `docs/superpowers/specs/2026-08-09-marketing-site-redesign-design.md`) shipped and merged. This spec covers a different, later request: the user asked for a full visual + motion redesign on top of that content — "how it moves, how it makes transition or behaves," investor-friendly, amazing on first open — using the color palette already locked to the logo (Certa Green + Signal Coral, unchanged) and extending the preloader's brand-mark moment into more of the site.

**Explicit direction decisions (from brainstorming):**
- Full redesign scope: layout, motion, and new sections are all in play (not just a motion layer over unchanged layout).
- Motion direction: a synthesis of the CERTA ring+dash logo gesture as a recurring signature motif, choreographed with Apple-style cinematic scroll storytelling, engineered with Stripe/Linear-level precision (tight easing, restraint, no bounce/gimmick).
- Motion intensity: expand from DESIGN.md's current 2 signature moments (hero, Why Us visual) to roughly 4-6 signature moments — more than today, still far short of "motion on every element."
- Preloader: animate the mark drawing itself (ring strokes on, coral dash snaps in to complete it) rather than the current spin-and-iris treatment.
- Tech approach: stay zero-dependency — no build step, no animation libraries (GSAP etc. explicitly declined) — all choreography hand-built on `IntersectionObserver` and the existing single shared `rAF` loop pattern already used for parallax/idle-float in `assets/script.js`.
- Content: copy and facts stay locked. No new claims, stats, client names, or staff bios. Any new section must be built entirely from facts already stated on the page, PRODUCT.md, or DESIGN.md.
- New sections: proposed by research (ui-ux-pro-max design-system search, 21st.dev catalog inspiration for hero/scroll/count-up/timeline patterns) rather than user-specified, translated by hand into the site's existing vanilla convention — not imported as React components.

**Research inputs used:**
- `ui-ux-pro-max` skill, consulted for animation/style guidance for a professional-services/fintech-adjacent product (duration-timing, transform/opacity-only performance rule, reduced-motion handling — all already practiced in the current codebase and reconfirmed here).
- 21st.dev catalog search (`get_inspiration`) surfaced patterns translated into hand-built vanilla equivalents, not adopted as-is: a "growing vertical progress line synced with numbered content" pattern (informs the Process section's scroll-choreographed line), a "Process Timeline" scroll-trigger pattern, several "Count Up" number-reveal patterns (already partially implemented; this spec extends the pattern to a new stat band), and a "curtain reveal" footer pattern (informs the closing CTA/footer moment). Dark-mode, glassmorphism, and neon-gradient hero patterns surfaced in the same search were explicitly rejected — they sit in the visual territory PRODUCT.md's anti-references section already rules out.

## Scope

`index.html` + `assets/styles.css` + `assets/script.js` only. The Next.js portal (`portal/`) is out of scope. No new runtime dependencies, no build step. One new visual asset is required: an inline SVG reconstruction of the brand mark (see Prerequisite below) — everything else reuses assets already in `assets/`.

## Prerequisite: inline SVG brand mark

The mark (`assets/certa-mark.png`, `certa-mark-white.png`) exists only as a raster PNG today, used identically in the preloader, hero, mobile nav, and Why Us visual (`index.html:20,51,146,344`). None of the new signature moments below (draw-on stroke animation, shared-element morph) are possible against a raster image — they require SVG stroke paths.

**Action:** reconstruct the mark as inline SVG — a ring (open circle stroke, per DESIGN.md's "open ring — a 'C' that never quite closes") plus a separate short coral dash/arc element that completes the gap. This is a geometric reconstruction of a simple two-part abstract mark the project already owns and fully controls (not a third-party logo requiring exact-source sourcing, per the different caution that applied to Xero/QuickBooks/Sage in the prior redesign). Calibrate proportions against the existing PNG by eye (ring diameter, gap angle, dash position/thickness) so the SVG reads as visually identical at rest; if the original `Certa Letter Head pad.ai` file yields cleanly extractable path data at implementation time, prefer that over freehand reconstruction. The reconstructed SVG becomes the single source used everywhere the mark appears (preloader, hero, Why Us visual, mobile nav) — the PNG fallback stays available for `<meta>`/favicon/OG-image contexts that require a raster format.

## 1. Motion language: "Certainty completes"

DESIGN.md already frames the logo as a "Certainty Mark" — an open ring finished by a coral dash — but that idea currently lives only in the static logo. This redesign makes it the site's motion signature: each signature moment below literally **completes** something (a ring closes, a line draws to its end, a number locks to its final value, an icon finishes drawing itself), rather than using generic fade/slide effects borrowed from a template. This directly extends DESIGN.md's existing "Key Characteristics" bullet about restrained, intentional brand-color use into motion.

**Engineering discipline (applies to every moment below):**
- One shared timing/easing vocabulary: reuse `--ease-standard` (`cubic-bezier(0.22, 1, 0.36, 1)`) as the default; a single additional `--ease-draw` curve may be added specifically for stroke-draw animations if `--ease-standard` reads too soft for that effect, but no more than one extra curve is introduced.
- `transform`/`opacity`/SVG `stroke-dashoffset` only — no animating `width`/`height`/`top`/`left`, consistent with the existing parallax/float system's own discipline.
- Every moment has a full `prefers-reduced-motion: reduce` fallback that shows the end state immediately — extending the pattern already established for `[data-reveal]`, parallax/float, and the process count-up.
- Pin/sticky-scroll and heavy parallax are disabled under `(max-width: 860px)` (the site's existing breakpoint) and `(hover: none)` — matching the project's existing mobile-simplification pattern, not a new one.
- New scroll-driven work reuses the existing single shared `rAF` loop (`assets/script.js`'s `tick()` function) by extending it, or uses `IntersectionObserver` for enter/exit triggers — no second competing animation loop is introduced.

## 2. Signature moment 1: Preloader → Hero handoff (new, flagship)

**Current behavior:** the preloader shows the PNG mark spinning continuously (`certa-spin`, 1.6s linear loop) for a minimum 1800ms, then the panel irises open via `clip-path: circle()` while the inner mark scales up 2.6x (`styles.css:158-201`).

**New behavior:** replace the spin with a draw-on sequence using the new inline SVG mark:
1. Ring strokes on via `stroke-dashoffset` (0 → full circumference), ~600ms.
2. The coral dash snaps into its gap, ~150ms, slight overshoot easing (not a bounce — a single restrained overshoot, per the "engineered, not playful" register).
3. Brief hold (~150ms) so the completed mark registers before anything else happens.
4. The completed mark morphs (translate + scale, FLIP technique: measure the preloader mark's final screen rect and the hero mark's target rect, animate a transform between them) into the hero mark's position as the clip-path iris opens — so the hero doesn't start fresh, it continues the same object the visitor just watched complete.

Total budget: kept close to the current ~1.8s minimum display plus the existing ~950ms iris transition; the draw-on sequence replaces dead spinning time rather than adding new wait time on top of it.

**Reduced motion:** skips straight to today's reduced-motion fallback (opacity-only cross-fade, `styles.css:195-201`) — no draw, no morph. This is a superset of the existing fallback, not a new one.

## 3. Signature moment 2: Hero decorative rings + mark (kept)

The existing hero parallax rings and floating mark (`index.html:70-74,145-147`, driven by `data-parallax`/`data-float`) are kept as-is structurally. Only the easing/timing constants are audited against the new `--ease-standard`/`--ease-draw` vocabulary for consistency with the other moments — no new visual elements added here.

## 4. Signature moment 3: "By the numbers" (new section)

**Placement:** immediately after Hero, before Services — an investor/comparison-shopper reader gets a scale/credibility read in seconds, before the service detail. This follows the "social proof before the offer" ordering principle already used to place the prior redesign's new sections.

**Why it's honest:** every figure already exists elsewhere on the page today — this section aggregates them into one glanceable band, it does not introduce anything new.

**Content:**
```
1 week        — to scoping                          [existing: Process section]
60 days       — to first reporting cycle             [existing: Process section]
4             — jurisdictions covered (UK, USA, Canada, Europe) [existing: Hero, Why Us, FAQ]
4             — software platforms supported (Xero, QuickBooks, Sage, FreeAgent) [existing: Hero, Why Us, FAQ, Security]
4             — named roles on every engagement (Engagement Lead, Senior Accountants, Payroll Specialists, Compliance Reviewers) [existing: Team, Security, FAQ]
```
No heading claims anything not already true elsewhere on the page (e.g. no "trusted by X companies" — no such number exists).

**Layout:** a five-stat horizontal band (wraps to 2-3 per row on tablet, stacks on mobile), styled consistent with the existing `.process-stat` treatment (`styles.css`'s Process block) — large `--font-display` numeral, small `--ink-muted` label beneath.

**Motion:** each number counts up on scroll-in, reusing the existing `[data-count-to]`/`[data-count-suffix]` convention and `animateCount()` logic from `assets/script.js` verbatim (no new count-up implementation) — this section is additional markup using an existing, already-reduced-motion-safe behavior. The final stat in the row gets one extra flourish once it locks: a small ring-completes mark (a miniature version of the same SVG ring+dash used in the preloader) draws in beside it, reinforcing the section's "this row is now complete" read. This is the only place besides the preloader/CTA where the full ring+dash motif repeats — kept rare deliberately.

## 5. Signature moment 4: Process section scroll choreography

**Current:** four `.process-step` cards reveal via the standard `[data-reveal]` fade-up, no connecting element between them (`index.html:233-254`).

**New (desktop only, `min-width: 861px` and no `hover: none`):** the four steps gain a connecting line (a simple vertical or horizontal stroke, matching the section's existing layout direction) that draws progressively as the visitor scrolls through the section — the stroke's `stroke-dashoffset` is driven by scroll position (via the shared `rAF` loop, reading the section's scroll progress the same way `[data-parallax]` already reads element position), not by a full pin/sticky lock. Each step's text weight/color shifts to its "active" state as the line's leading edge passes it, then settles. This extends the ring-drawing language from the preloader/stat-band into a line instead of a circle — same visual grammar, different shape.

**Mobile/touch fallback:** the connecting line is not drawn at all; the four steps use the existing plain `[data-reveal]` stacked treatment unchanged. This avoids introducing pin/sticky-scroll jank on small screens, per the engineering discipline above.

## 6. Signature moment 5: Why Us visual (kept)

The existing signature visual (`index.html:341-351` — blob, ring outline, floating mark, floating chips, all `data-parallax`/`data-float`) is kept as-is structurally, with the same easing-vocabulary audit as the hero (Moment 2) — no new elements, no restructuring.

## 7. Signature moment 6: Security cards → closing CTA

**Security cards (`index.html:389-422`):** each card's icon (shield / lock / sync-arrows, already inline SVG stroke icons per the prior redesign) draws itself in via `stroke-dashoffset` as the card enters view, instead of appearing instantly with the card's fade-up. This ties the animation directly to what the copy is saying (a shield "sealing," a lock "closing," arrows "syncing into place") using the same stroke-draw technique as the ring elsewhere — not a new animation idea, a consistent application of the existing one.

**Closing CTA (`index.html:553-566`, the `#contact` section):** as the visitor reaches the final CTA band, the full ring+dash mark completes once more (same SVG, same draw sequence as the preloader, scaled down) as a sign-off gesture before the footer — the narrative's last "certainty completes" beat. The footer itself (`index.html:570-613`) gets a restrained reveal-on-scroll (reusing `[data-reveal]`, not a new curtain/parallax system) rather than the heavier "curtain reveal" pattern seen in 21st.dev research, which read as too SaaS-marketing-site for this brand's register.

## 8. Navigation

The nav gains a thin (2px) scroll-progress line along its bottom edge, filled in Certa Green as the visitor scrolls through the page (0-100%), and the header already hides-on-scroll-down/reveals-on-scroll-up per its current `.is-scrolled` behavior (`assets/script.js`'s `updateHeaderState`) — unchanged. This is the only persistent (non-scoped-to-one-section) motion element on the page; deliberately restrained (no floating badges, no persistent ring widget) to avoid competing with the six scoped signature moments above.

## 9. Micro-interactions

- Comparison table rows (`index.html:258-298`) and FAQ items (`index.html:496-529`) gain the same hover-lift/background-tint treatment already defined for cards elsewhere in DESIGN.md's Elevation section — extending an existing pattern, not introducing a new one.
- The primary hero CTA (`.btn-coral`, "Book a discovery call") gains a subtle cursor-proximity pull — a few pixels of translate toward the cursor within a small radius, reusing the shared `rAF` loop — restrained specifically to avoid the "magnetic button" pattern reading as playful/startup-register, per PRODUCT.md's explicit rejection of "playful startup affectations."

## 10. DESIGN.md update

The existing "Static-By-Default Rule" ("parallax is reserved for the hero and Why Us visual only... if it's not one of the two named signature moments, it does not get parallax") is superseded by a new "Signature Moments Rule" naming all six moments in this spec (preloader→hero handoff, hero rings/mark, by-the-numbers stat band, process line choreography, Why Us visual, security cards→closing CTA) as the complete, exhaustive list — motion outside this list stays limited to the existing `[data-reveal]` fade-up and standard hover/focus states. This is a documented, deliberate expansion (2 → 6 named moments), not a quiet loosening of the rule.

## Accessibility

- All six signature moments retain full `prefers-reduced-motion: reduce` fallbacks showing end states immediately, per the Engineering Discipline section above — no moment is exempt.
- The SVG brand mark (preloader, hero, Why Us, closing CTA) stays `aria-hidden="true"` with existing visible/`sr-only` text labels unchanged.
- Process section's scroll-choreographed line is decorative only — the four step headings/bodies remain in normal document order and are fully readable with the line disabled (mobile fallback, reduced motion, or no-JS).
- "By the numbers" stat band: each stat's final value is present in raw HTML (no-JS-safe), matching the existing `[data-count-to]` convention's progressive-enhancement guarantee.
- Nav scroll-progress line is decorative (`aria-hidden="true"`) — does not replace any existing navigation affordance.
- Cursor-proximity CTA pull is capped at a few pixels specifically so it never obscures the button or misleads a keyboard/touch user who never triggers it (a mouse-only enhancement, invisible by absence rather than broken for non-mouse input).

## Out of scope

- No new brand colors, no dark mode, no glassmorphism, no neon gradients — several 21st.dev research patterns used these; all rejected per PRODUCT.md's anti-references.
- No copy rewrites beyond what a layout change literally requires (e.g. none are anticipated; the "By the numbers" section reuses existing phrases verbatim).
- No new client logos, testimonials, staff photos/bios, or statistics beyond the five figures already stated elsewhere on the site.
- No animation libraries or other new runtime dependencies (GSAP explicitly declined) — everything hand-built in vanilla JS.
- No changes to the portal (`portal/`).
- No section reordering beyond inserting the one new "By the numbers" band — all other section order stays as shipped in the prior redesign.
