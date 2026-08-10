---
name: CERTA& Advisory
description: Outsourced accounting, bookkeeping, payroll and tax compliance for UK, US, Canadian and European companies and accounting practices, delivered from Bangladesh.
colors:
  certa-green: "#00904C"
  certa-green-deep: "#00753E"
  certa-green-tint: "#E4F3EA"
  signal-coral: "#ED1C25"
  signal-coral-deep: "#B8232A"
  ink: "#231F20"
  ink-muted: "#55565A"
  surface-tint: "#F6F9F7"
  border: "#E3E5E4"
  white: "#FFFFFF"
typography:
  display:
    fontFamily: "Poppins, 'Segoe UI', sans-serif"
    fontSize: "clamp(2.75rem, 5vw, 4.25rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Poppins, 'Segoe UI', sans-serif"
    fontSize: "clamp(1.75rem, 2.6vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Poppins, 'Segoe UI', sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, 'Segoe UI', sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, 'Segoe UI', sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.02em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "48px"
  xl: "96px"
components:
  button-primary:
    backgroundColor: "{colors.certa-green-deep}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "15px 28px"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "15px 28px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-tint}"
    textColor: "{colors.ink}"
  button-coral:
    backgroundColor: "{colors.signal-coral}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "15px 28px"
  button-coral-hover:
    backgroundColor: "{colors.signal-coral-deep}"
    textColor: "{colors.white}"
  credential-chip:
    backgroundColor: "{colors.surface-tint}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
---

# Design System: CERTA& Advisory

## 1. Overview

**Creative North Star: "The Certainty Mark"**

The name is the brief: *Certa*, certainty. The logo mark is an open ring — a "C" that never quite closes — completed by a short coral dash standing in for the missing arc, like a checkmark of confidence. Everything in this system extends that one gesture: a calm, mostly-neutral field that lets two decisive brand colors do the convincing, rather than a page shouting for attention. This is a system for a skeptical reader — a finance director or practice owner comparing accounting outsourcing partners with three other tabs open — who is scanning for evidence of accounting-specific rigor in fifteen seconds: qualifications, named software platforms, jurisdictional familiarity. Not a pitch.

The system explicitly rejects the territory of ACE Advisory, RBA Chartered Accountants, and RCI Global: dense nested navigation, navy-and-gray "safe corporate" palettes with no real brand color presence, cramped and inconsistently-spaced sections, and stock-photo warmth standing in for a point of view. It also rejects reading as a generalist BPO — every claim on the page should be legible as accounting-specific, not "any back-office function." CERTA& should read as newer, sharper, and more considered than the competitor references, while being unmistakably an accounting practice's back office rather than a startup's marketing site.

The system carries a second, full-scale layer on top of that restraint: full-bleed sections, a taller and more confident hero, and considered scroll motion (fades-up on entry, slow idle float and scroll parallax on the brand mark and a small set of signature visuals). This was added deliberately to read as a firm operating at real scale — reference points were defyelement.com (full-bleed layout, scroll-triggered reveals, a numbered "why choose us" flanking a center visual) and grantthornton.com.bd (bold full-bleed confident type blocks, "Meet our people"/"Careers" as expected nav items for a real accounting network). Both were filtered hard through the accounting-firm register: no dark mode, no neon gradients, no 3D emoji/device mockups, no stock photography of invented "team" people — the added motion is editorial and restrained, not a startup pitch reel.

**Key Characteristics:**
- Mostly white/near-white canvas; green and coral appear with intent, never as decoration
- Confident, tight typography carries hierarchy — not boxes, not icons-in-circles
- Flat by default; depth comes from tonal surfaces and spacing, not drop shadows
- One accent color per decision point: green for structure and trust, coral for the single next action
- Credibility carried by specifics — qualifications, named software (Xero, QuickBooks, Sage, FreeAgent), jurisdictions — never by unsupported adjectives like "trusted" or "reliable"
- Full-bleed scale with restrained, purposeful scroll motion — signature moments only, not a uniform reflex applied to every element

## 2. Colors

Two brand colors inherited directly from the mark, deployed with discipline against a quiet neutral field.

### Primary
- **Certa Green** (#00904C): the mark's ring color. Used for icons, dividers, large decorative surfaces, section accents, and any headline-scale text or large UI elements (≥18px / bold ≥14px only — see contrast rule below).
- **Certa Green Deep** (#007A3E / `#00753E`): a darkened working shade of Certa Green, used wherever green carries small text or sits behind white text (primary buttons, links, hover states). Exists specifically because raw Certa Green fails AA contrast at small sizes.

### Secondary
- **Signal Coral** (#ED1C25): the mark's dash color. Reserved for the single highest-priority action per screen — the primary CTA, a key stat, a rare highlight. Its scarcity is what makes it register as urgency against the green-and-neutral field.
- **Signal Coral Deep** (#B8232A): the UI-safe working shade of Signal Coral, used wherever coral carries small text, sits behind white text, or fills a button — coral buttons, error states, badges. Exists specifically because raw Signal Coral fails AA contrast at small sizes, the same reasoning as Certa Green Deep.

### Neutral
- **Ink** (#231F20): primary text and headline color. This is the same near-black used in the logo's wordmark — 16.3:1 contrast on white.
- **Ink Muted** (#55565A): secondary and supporting body text, captions, metadata. 7.3:1 contrast on white — resist going lighter for "elegance."
- **Certa Green Tint** (#E4F3EA): soft brand-tinted background for callouts, active states, and badges.
- **Surface Tint** (#F6F9F7): the field color for alternating sections — a near-white tinted a hair toward Certa Green's own hue, not generic warm gray.
- **Border** (#E3E5E4): hairline dividers, card outlines, input borders.
- **White** (#FFFFFF): base canvas.

### Named Rules
**The Contrast-Safe Brand Rule.** Raw Certa Green (#00904C, 4.1:1) and raw Signal Coral (#ED1C25, 3.7:1 against Ink, 4.4:1 against white) all fail AA for small text on white. Never set body copy or button labels directly in either raw color. Use Certa Green Deep for small green text/UI, and Signal Coral Deep (6.3:1 against white) for small coral text/UI and coral button fills — reserve raw Signal Coral strictly for large decorative surfaces (the mark's dash, hero accent rings, large graphic strokes), never as a small-text or button-fill color.

**The One Action Rule.** Signal Coral marks exactly one action per screen — the primary CTA. If two elements compete for coral, one of them is wrong.

## 3. Typography

**Display Font:** Poppins (with `'Segoe UI', sans-serif` fallback)
**Body Font:** Inter (with `'Segoe UI', sans-serif` fallback)

**Character:** Poppins is the closest widely-available match to the logo's bold geometric wordmark — confident, slightly rounded, unmistakably modern. Inter carries body copy: a grotesque built for long-form legibility at small sizes, giving the pairing a contrast axis (geometric display / grotesque body) instead of two similar sans-serifs competing for the same job.

### Hierarchy
- **Display** (700, `clamp(2.75rem, 5vw, 4.25rem)`, 1.05): hero headline only, one per page.
- **Headline** (600, `clamp(1.75rem, 2.6vw, 2.5rem)`, 1.15): section headings.
- **Title** (600, 1.25rem, 1.3): card titles, service names, sub-section headings.
- **Body** (400, 1.0625rem, 1.6): paragraph copy. Cap measure at 65–75ch — this is a reading audience, not a skimming one, once they've committed to a section.
- **Label** (600, 0.8125rem, 1.2, +0.02em tracking): buttons, nav items, form labels, tags. Sentence case, not uppercase — uppercase tracked labels are reserved for the rare tag/badge, not routine UI text.

### Named Rules
**The Wordmark-Weight Rule.** "CERTA&" in the logo is set bold; "Advisory" underneath sits in a lighter weight. Echo that same bold/light contrast anywhere the two words appear together in UI (e.g. footer sign-off, loading states) rather than setting them in a single uniform weight.

## 4. Elevation

Flat by default. Depth is conveyed through the Surface Tint / White alternation between sections and through generous spacing, not shadows — a shadow-heavy interface would undercut the "sharp, precise" personality with SaaS-dashboard softness. The one exception is interactive lift: primary buttons and cards gain a small ambient shadow only on hover, signaling interactivity without implying permanent elevation.

### Shadow Vocabulary
- **hover-lift** (`box-shadow: 0 8px 20px rgba(35, 31, 32, 0.12)`): buttons and clickable cards on hover only, paired with a 2px translateY.

### Named Rules
**The Flat-At-Rest Rule.** Nothing has a shadow in its default state. Shadows are a response to hover/focus, never a resting decoration.

## 5. Components

### Buttons
- **Shape:** moderately rounded (`border-radius: 10px`, `rounded.md`) — not a full pill. A full pill reads as startup-casual; this system needs to hold a finance conversation, so the shape is measured rather than playful, while still departing from the squared-off, dense-menu feel of the competitor set.
- **Primary:** Certa Green Deep background, white label text, `15px 28px` padding. Used for the main conversion action ("Book a discovery call").
- **Coral (single-use):** Signal Coral Deep background, white label text. Reserved for the one highest-priority CTA on the page — typically the hero.
- **Secondary/Ghost:** white background, Ink text, 1px Border outline. Used for lower-priority actions ("See our services").
- **Hover / Focus:** background shifts one step darker (Deep variants) or to Surface Tint (ghost); adds `hover-lift` shadow and a 2px upward translate over 180ms ease-out-quart. Focus-visible adds a 2px Certa Green outline offset 2px, on every variant, keyboard or not.

### Credential Chips
- **Style:** Surface Tint background, Ink text, 6px radius (`rounded.sm`), `10px 16px` padding — small, understated, factual. Used for named software platforms (Xero, QuickBooks, Sage, FreeAgent) and professional qualifications, never for decorative tags.
- **Rule:** every chip must name something specific and checkable (a real software platform, a real qualification, a real jurisdiction) — never a generic trust word like "certified" or "expert" on its own.

### Cards / Containers
- **Corner Style:** 16px radius (`rounded.lg`).
- **Background:** White on Surface Tint sections, Surface Tint on White sections — always the opposite of the section field so cards read as distinct without a border.
- **Shadow Strategy:** flat at rest per Elevation; no shadow unless hover-interactive.
- **Border:** 1px Border color only when the card sits on a background of the same tone as itself (rare).
- **Internal Padding:** `spacing.md` (24px) minimum, `spacing.lg` (48px) for feature-level cards.

### Inputs / Fields
- **Style:** white background, 1px Border stroke, 10px radius (`rounded.md`), 14px/16px padding, Ink text, Ink-Muted placeholder set at Ink-Muted's own color (not a lighter gray — placeholders must clear 4.5:1 too).
- **Focus:** border shifts to Certa Green Deep, 2px Certa Green Tint glow ring.
- **Error:** border and helper text shift to Signal Coral Deep (never raw Signal Coral, for contrast).

### Navigation
- **Style:** single-row, flat navigation — six links maximum, no nested dropdowns. Grew from five to six deliberately (Services, Why Us, Team, Clients, Careers, Contact) to cover the fuller site; still a direct rejection of the competitor set's deep menu trees.
- **Typography:** Label style, Ink text; active/current item underlined in Certa Green (2px, offset 4px).
- **Hover:** text shifts to Certa Green Deep, underline animates in from the left over 150ms.
- **Mobile:** collapses to a full-screen overlay menu at the same flat single-level depth — never an accordion of sub-items.

### Logo Lockup (signature)
The mark (open green ring + coral dash) always keeps clear space equal to the ring's own diameter on all sides. Minimum digital size: 32px ring height. Never recolor the ring or dash; on dark backgrounds, use the all-white reversed lockup rather than tinting the brand colors down.

### Scroll Reveal & Parallax (signature)
- **Reveal:** elements marked for reveal fade up from 28px with a 700ms ease-standard transition. Default state is fully visible; only when JS confirms it can drive the animation does the pre-reveal hidden state arm — so no-JS, slow-JS, and headless contexts always show full content, never a blank page.
- **Where it appears:** hero headline (two-line stagger), section headers, service/team rows, the Why Us numbered list, and client profiles. It does not appear on every single element on the page — the Static-By-Default Rule below is the guardrail against that.
- **Parallax:** reserved for two signature moments only — the hero's decorative background rings and mark, and the Why Us center visual (blob, ring outline, mark, floating chips). Each element drifts at its own slow rate (`data-speed`, roughly -0.1 to 0.12) tied to scroll position via a single rAF-throttled listener.
- **Idle float:** the hero mark and the Why Us visual's mark and floating chips bob gently on a 6s loop, independent of scroll, to keep the signature visuals from ever looking static.
- **Reduced motion:** both systems fully disable under `prefers-reduced-motion: reduce` — reveals show their end state immediately, parallax transforms are removed, idle float animations stop.

### Named Rules
**The Signature Moments Rule** (supersedes the earlier two-moment Static-By-Default Rule, expanded 2026-08-11). Full-scale, full-bleed layout and signature scroll motion are not the same thing as decorating every element. Scroll-driven and stroke-draw motion beyond the standard `[data-reveal]` fade-up and hover/focus states is reserved for exactly six named moments: (1) the preloader's ring-draws/dash-snaps sequence and its shared-element morph into the hero mark, (2) the hero's decorative rings and floating mark, (3) the "By the numbers" stat band's count-up and closing ring flourish, (4) the Process section's scroll-choreographed connecting line (desktop only), (5) the Why Us visual, and (6) the Security cards' icon draw-in plus the closing CTA's ring-complete flourish. If it's not one of these six, it does not get scroll-driven or stroke-draw motion — it gets the standard reveal-on-scroll treatment or nothing.

## 6. Do's and Don'ts

### Do:
- **Do** keep navigation to a single flat row, six links maximum — no nested menus.
- **Do** use Certa Green Deep (#00753E), not raw Certa Green, for any small text or white-on-green button.
- **Do** pair Signal Coral Deep with white text for buttons and interactive fills; reserve raw Signal Coral for large decorative surfaces only, never as a small-text or button-fill color.
- **Do** let Surface Tint (#F6F9F7) and White alternate section-by-section as the primary rhythm device.
- **Do** cap body paragraphs at 65–75ch and keep one clear idea per section.
- **Do** reserve Signal Coral for exactly one action per screen.
- **Do** back every credibility claim with a specific: a named software platform, a qualification, a jurisdiction, a number.
- **Do** use moderately rounded 10px buttons (`rounded.md`), not full pills.
- **Do** reserve scroll-driven and stroke-draw motion for the six named Signature Moments only; use reveal-on-scroll for everything else, per the Signature Moments Rule.
- **Do** default every `[data-reveal]` element to fully visible; only arm the hidden pre-reveal state once JS confirms it can animate.
- **Do** present Team, Clients, and Careers content honestly: role-based structure instead of invented named staff, sector/market profiles instead of fabricated client logos.

### Don't:
- **Don't** use a navy-and-gray "safe corporate" palette — that is the RBA/ACE/RCI territory this brand explicitly rejects.
- **Don't** build dense, deeply-nested navigation menus that bury the actual offer.
- **Don't** use stock-photo hero imagery as a substitute for a point of view.
- **Don't** add drop shadows to resting cards or buttons — shadows appear only on hover.
- **Don't** set raw Certa Green (#00904C) or raw Signal Coral (#ED1C25) as small body text or button-label color on white — both fail AA contrast at that size; use their Deep variants instead.
- **Don't** use uppercase tracked "eyebrow" labels above every section heading — pick one deliberate typographic cadence instead of the generic AI-landing-page kicker.
- **Don't** list or imply HR, EOR, or general BPO services — this is an accounting-only practice; every service line must be an accounting-firm function.
- **Don't** use full-pill buttons or casual, startup-register copy — this needs to hold a finance conversation, not a product demo.
- **Don't** adopt dark mode, neon gradients, 3D emoji, or device mockups even when a reference site (e.g. defyelement.com) uses them — filter every borrowed pattern through the accounting-firm register first.
- **Don't** apply parallax or scroll motion uniformly across every element — it is reserved for the two named signature moments only.
