# Marketing Site Redesign — Design

**Date:** 2026-08-09
**Status:** Approved for planning

## Context

CERTA& Advisory's marketing site (`index.html` + `assets/`) needs to read as more credible and substantial to its actual target reader — per `PRODUCT.md`, a risk-aware finance director, controller, or practice owner comparison-shopping against firms like ACE Advisory, RBA Chartered Accountants, and RCI Global, plus (per this request) an investor audience evaluating the business itself. The user asked for a redesign referencing 21st.dev (a React/Tailwind component registry), aceadvisory.com (domain currently unregistered/parked), De Tempete (an accounting-outsourcing competitor with a navy-corporate, dense-nav aesthetic), and KPMG Bangladesh (Big-4 institutional-authority site).

**Explicit direction decision (from brainstorming):** keep the site's existing distinctive brand — white canvas, Certa Green (`#00904C`)/Certa Green Deep (`#00753E`), Signal Coral (`#ED1C25`)/Signal Coral Deep (`#B8232A`), flat single-row nav — rather than pivoting toward the navy-and-gray, dense-nav register of De Tempete/KPMG. This isn't just a preference call: `PRODUCT.md`'s "Anti-references" section already explicitly names that exact territory (dense nested nav, navy-and-gray "safe corporate" palettes) as what the brand rejects. The redesign borrows *structural* credibility patterns (dedicated trust sections, comparison framing, FAQ) from the reference sites, translated into CERTA&'s own visual language — not their look.

**Explicit content decision (from brainstorming):** structure and visual polish only. No invented facts — no fabricated client logos, named staff bios, testimonials, certifications, or statistics. Every new section's content must trace back to a claim already present in `index.html`, `DESIGN.md`, or `PRODUCT.md` today. `PRODUCT.md`'s own design principle #9 ("Honest team/client representation... never fabricate") already establishes this as a standing site-wide rule, not a one-off constraint for this task.

**Research inputs used:**
- `ui-ux-pro-max` skill's `--design-system` search for "accounting outsourcing professional services fintech B2B credible investor" surfaced the "Trust & Authority" pattern (certificates/badges, credentials, case studies with metrics, security badges, metric-reveal animations) — adopted for structure/interaction, not its suggested navy palette (rejected per the direction decision above).
- `ui-ux-pro-max`'s `landing` domain search surfaced the "Enterprise Gateway" pattern (solutions by industry/role, trust signals prominent) and the general principle "social proof before CTA" — informs section ordering.
- 21st.dev browsing (`Heroes`, and the sidebar's `Comparisons`/`FAQs`/`Clients`/`Calls to Action` categories) confirmed these as recognized, well-supported component categories worth having dedicated sections for, and showed stat-embedded hero-card patterns — translated into hand-built vanilla HTML/CSS/JS matching the site's existing zero-dependency convention, not imported as React components (the marketing site has no build step and this redesign doesn't introduce one).

## Scope

`index.html` + `assets/styles.css` + `assets/script.js` only (the one-page marketing site). The Next.js portal (`portal/`) is out of scope. No new runtime dependencies, icon libraries, or component frameworks — every new icon is a hand-drawn inline SVG in the exact style already established by `.service-row__mark` (24×24 viewBox, `stroke-width="2"`, round line caps/joins), matching the site's existing zero-dependency convention (not the portal's `lucide-react`, which is a different codebase with different constraints).

## 1. New section: Confidentiality & Security

**Placement:** after Why Us, before Team (a natural "you can trust the mechanics, now meet the people" progression).

**Why it's honest:** every claim here already exists in the current site — it's given its own section and fuller treatment instead of being one Why-Us bullet among six.

**Content:**

```
Heading: Your data, handled like it's ours to lose.
Subhead: Three structural facts about how an engagement actually runs, not a badge wall.

1. Signed before anything moves.
   Every engagement runs under a signed confidentiality agreement before
   any ledger access, document, or credential changes hands.

2. Role-based access, not open access.
   Only the named team members on your engagement — your Engagement Lead,
   Senior Accountants, and Compliance Reviewer — can see your books. Access
   is scoped to the role, not the office.

3. Your software, not a copy of it.
   We work directly inside your existing Xero, QuickBooks, Sage, or
   FreeAgent — nothing is migrated to a separate system, which means
   nothing exists in a second place to secure.
```

No certification badges (ISO/SOC2/etc.) are claimed anywhere — none are confirmed true, so none appear. If real certifications exist, they can be added later as a fourth, badge-style item.

**Layout:** three-column card row on desktop (stacks on mobile), each card: small icon (new hand-drawn SVG: a shield for #1, a key/lock for #2, a sync-arrows glyph for #3) + bold micro-heading + 1–2 sentence body — same visual grammar as the existing `.service-row` pattern, on a `--surface-tint` section background (alternating with the white Team section above/below it, per the existing section-tint rhythm).

## 2. New section: Outsourcing vs. building in-house

**Placement:** after Process, before Why Us — right after the reader has seen how an engagement runs, before the reasons-to-choose-us list.

**Why it's honest:** every row is either generic, industry-standard reasoning (not a CERTA&-specific invented statistic) or a fact already stated elsewhere on the site (linked below). No cost-savings percentage, headcount number, or "X% faster" claim appears anywhere — those would require real data this project doesn't have.

**Content:** a two-column comparison, framed as a question the reader is already asking themselves, not a hard sales claim:

```
Heading: Building an in-house function, or scoping it out — what actually changes?
Subhead: The honest tradeoffs finance teams weigh before this decision.

Row 1 — Getting started
  In-house: Recruiting, interviewing, and onboarding a new hire — typically weeks to months before they're productive.
  CERTA&: Scoping starts within a week; most clients see their first full reporting cycle inside 60 days. [already stated in Process section]

Row 2 — Coverage
  In-house: One person's leave, turnover, or notice period is a single point of failure for your books.
  CERTA&: A named team with defined roles — Engagement Lead, Senior Accountants, Payroll Specialists, Compliance Reviewers — so coverage doesn't depend on one person. [already stated in Team section]

Row 3 — Cost structure
  In-house: Salary, benefits, software licenses, training, and management time, whether or not workload is steady.
  CERTA&: One scoped, fixed-price engagement — priced before it starts, adjusted only when scope changes. [already stated in Why Us: "Fixed scope, fixed price"]

Row 4 — Scaling up
  In-house: Re-hire and re-train each time the function needs to grow.
  CERTA&: Scope adjusts within the existing engagement and team structure. [already stated in Process step 4: "reviewed and adjusted as your business changes"]
```

**Layout:** a semantic `<table>` (not a styled-div-grid) for accessibility — `<caption>` holding the heading/subhead context, `<th scope="col">` for the two column headers ("Building in-house" / "CERTA& Advisory"), `<th scope="row">` for each row label. Visually styled to match the site (white/surface-tint alternating rows, Certa Green Deep for the CERTA& column's row `<th>` accents, no color used for the in-house column — deliberately neutral, not painted as "the bad option").

## 3. New section: FAQ

**Placement:** after Clients, before Careers — last substantive content before the closing CTA band, addressing final objections right before the ask.

**Why it's honest:** every answer restates a fact already present elsewhere on the site; nothing new is asserted.

**Content:**

```
Heading: Questions finance teams ask before they scope a call.

Q: How do you keep our data secure?
A: Every engagement runs under a signed confidentiality agreement first,
   access is role-based to your named team only, and we work inside your
   own software rather than migrating your data anywhere else.

Q: What happens if our main contact is unavailable?
A: You're never staffed by one freelancer. Each engagement has a named
   Engagement Lead plus Senior Accountants, Payroll Specialists, and a
   Compliance Reviewer, so coverage doesn't depend on a single person.

Q: Do we have to migrate to new software?
A: No. We work directly in Xero, QuickBooks, Sage, or FreeAgent — whichever
   you already use.

Q: How much of the working day do we actually overlap?
A: Our working hours are structured to overlap with UK, US, Canadian, and
   European business hours — see the live London/Dhaka times in the hero
   above.

Q: What if our scope needs to change later?
A: Every engagement is reviewed on a regular cadence and adjusted as your
   business changes — scope isn't fixed forever, just fixed and clear at
   any given time.

Q: Which jurisdictions and software do you support?
A: UK, USA, Canada, and Europe for jurisdictions; Xero, QuickBooks, Sage,
   and FreeAgent for software.
```

The overlap-hours FAQ deliberately cross-references the hero's live UK/BD clock widget by name — ties the newest hero feature into the credibility narrative instead of leaving it decorative.

**Layout:** native `<details>`/`<summary>` accordion (no JS required, keyboard/screen-reader accessible by default) — one open at a time is not enforced (native behavior allows multiple open), styled to match `.service-row` borders/spacing.

## 4. Upgrade: hero credential strip → real software logos

**Current:** `.credential-strip` shows the four software names as plain text chips ("Xero", "QuickBooks", "Sage", "FreeAgent").

**Change:** replace the text chips with each product's real wordmark/logo (official brand SVGs, sourced correctly — not guessed or redrawn from memory), sized consistently (fixed height, auto width), grayscale-by-default with full color on hover (a common, low-risk "we integrate with" treatment used industry-wide — this states a factual tooling relationship, not a testimonial or endorsement claim). Falls back to the existing text-chip treatment if a clean official SVG can't be sourced for a given product at implementation time — never a redrawn/approximated logo.

## 5. Upgrade: process section stat callouts

**Current:** the four process steps are plain numbered cards; the "within a week... inside 60 days" claim lives only in the section's intro paragraph.

**Change:** pull those two figures out as a small stat pair displayed prominently above or alongside the 4-step row (e.g., "1 week" / "to scoping" and "60 days" / "to first reporting cycle"), styled per `ui-ux-pro-max`'s "metric reveal" suggestion — a restrained count-up-on-scroll-into-view animation (respecting `prefers-reduced-motion`, matching the existing reveal system's already-established reduced-motion handling), not a dashboard-style widget. No new numbers — same two figures already in the existing paragraph, just given visual prominence.

## 6. Upgrade: Why Us icon grid

**Current:** six Why-Us items are a numbered list (`why-us__num`), no icons.

**Change:** add a small hand-drawn icon per item (same 24×24 stroke-SVG convention as `.service-row__mark`), replacing or sitting alongside the existing number — e.g., a graduation-cap-style glyph for "Qualified and part-qualified accountants," a plug/sync glyph for "Your software, not ours," a scale/balance glyph for "Meaningful cost efficiency," a clock glyph for "Built around your working day," a document/check glyph for "Fixed scope, fixed price," a lock glyph for "Confidentiality by default." Layout otherwise unchanged (same two-column `why-us__col` structure).

## Visual/motion discipline

All new sections use the reveal-on-scroll system already in `assets/script.js` (`[data-reveal]`, default-visible until JS arms the hidden state) — no new animation system introduced. The process stat callout is the only new *motion* pattern (a count-up), scoped to those two numbers only, per `PRODUCT.md` principle #8 ("full scale, not full noise") and `DESIGN.md`'s existing Static-By-Default Rule, which this spec does not relax — parallax and idle-float remain reserved for the hero and Why Us visual only, exactly as already documented.

## Accessibility

- Comparison table: semantic `<table>`/`<caption>`/`<th scope>` as specified above.
- FAQ: native `<details>`/`<summary>`, no custom JS accordion.
- New icons: `aria-hidden="true"` (decorative, paired with visible text labels in every case — never icon-only).
- Stat count-up animation: respects `prefers-reduced-motion` (shows final value immediately, matching the existing reveal system's pattern).
- All new copy blocks checked against WCAG 2.1 AA contrast per `PRODUCT.md`'s accessibility baseline (reuses existing `--ink`/`--ink-muted` text tokens, already verified AA-safe).

## Out of scope

- No client logos, testimonials, staff photos/bios, certifications, or statistics beyond what's already stated on the site today.
- No navy/gray palette shift, no dense/nested navigation — flat single-row nav and the existing brand palette are unchanged.
- No new fonts, icon libraries, animation libraries, or frameworks.
- No changes to the portal (`portal/`).
- No changes to Team or Clients section *structure* (still role-based / sector-profile) — visual polish only, if any, deferred to implementation-time judgment and not specified further here since no structural change was requested.
