# Plan 002 — Redesign + UK units

Status: complete
Started: 2026-10-18
Completed: 2026-10-18

## Problem 1 — "looks basic as hell"
The first build was system fonts, a grey page, white rounded cards, a centred column. That is the default
AI-product look, and every AI marketplace looks like it. The site is the entire product, so the design is the pitch.

**Direction: Editorial catalogue / specimen register — "The Agent Register".**
Deliberately inverts the category default (no dark mode, no indigo gradient, no Inter).
- Display: Fraunces (variable, opsz 144). Body: IBM Plex Sans. Technical labels, prices, entry
  numbers: IBM Plex Mono. All from Google Fonts, with system fallbacks in the CSS variables.
- Warm paper ground (`#f2efe7`), warm-black ink, hairline rules, one accent: wax-seal red (`#9a1b16`).
- Entries are numbered ("No. 001") and set like catalogue entries, not product cards.
- Entry pages carry a **specification** sheet derived only from the entry's own data, plus generic
  install steps.
- The footer is a printed **colophon** carrying the place of publication and payment terms.
- Client-side text search and category filter over skills.json. No backend (see ADR-0001 amendment).

DFII = (Impact 4 + Fit 4 + Feasibility 5 + Performance 4) − Consistency Risk 2 = **15**

Differentiation anchor: a letterpress-style technical register published from Angus, with seal-red
accents, numbered entries and a printed colophon.

## Problem 2 — "we arent americans so our units must match arbroath angus dd11 4ax"
- Locale `en-GB`, currency GBP, formatted via `Intl.NumberFormat` — no symbol is ever hardcoded.
- Prices read £29 / £19. "one-time" becomes "one-off".
- `lang="en-GB"` on all pages.
- British spelling throughout (catalogue, one-off, behaviour, colours).
- Address "Arbroath, Angus DD11 4AX, Scotland" in the colophon and the hero facts.
- Not Tayside — that is the police area, not the county.

## Files
- [x] skills.json — marketplace config (locale, currency, place, paypalBase, reviewEmail), entry
      numbers, publisher, format
- [x] styles.css — new shared stylesheet (exceeds the 200-line rule, so it is allowed)
- [x] index.html — masthead, hero, controls, numbered catalogue, how-it-works, colophon
- [x] skill-page.html — entry, specification sheet, install steps
- [x] submit.html — two-column form, GBP, en-GB
- [x] test/page-render.test.js — 100 assertions over all three pages, new DOM + hard UK-units checks
- [x] test/shot.js — headless Edge over CDP, true emulated viewport, reports overflowing elements
- [x] CODING-STANDARDS.md — web fonts allowed, UK-locale rule, register-data rule, PayPal seam
- [x] GLOSSARY.md — new domain terms, British spelling, mojibake em-dashes fixed
- [x] ADR-0002.md — design direction + locale decision
- [x] ADR-0001.md — amendment for client-side search (the "no filtering" limitation was wrong)
- [x] Commit, push, verify live

## Verification
- `node test\page-render.test.js` → 100/100, and confirmed red-capable by mutation testing.
- `node test\shot.js` at 1280px and 390px → zero elements overflowing the viewport.
- Note: Edge's `--window-size=390` does NOT give a 390px layout viewport — it renders wider and crops the
  screenshot. The CDP tool sets a real emulated device viewport instead.

## Still needed from Doug
His PayPal.me handle. It is not on disk anywhere. One line in skills.json:
`"paypalBase": "https://paypal.me/<handle>"`. Until then paid buttons read "Payments opening soon" so
no visitor reaches a broken payment link.
