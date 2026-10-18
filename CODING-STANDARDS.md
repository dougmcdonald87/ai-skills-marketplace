# Coding Standards

Mechanical rules only. Judgement calls go in code review.

1. **Single file where possible.** index.html, skill-page.html, submit.html are standalone — no build step, no framework.
2. **Inline CSS and JS, with one shared stylesheet.** styles.css holds the shared design system because it exceeds 200 lines. Page-specific rules stay inline in a `<style>` block on that page. No other .css or .js files.
3. **Vanilla JavaScript only.** No React, Vue, npm, node_modules, or build pipeline.
4. **Web fonts allowed, from one provider.** Fraunces, IBM Plex Sans, IBM Plex Mono via Google Fonts. No icon libraries, no other CSS frameworks. Fonts must have a system fallback in the CSS variable.
5. **PayPal links only.** No Stripe, no bank accounts, no subscriptions unless PayPal supports them.
6. **One file open at a time.** 4GB RAM constraint — no multi-file editing sessions.
7. **No external images.** No logos, no screenshots, no hero graphics. Inline SVG only.
8. **UTF-8 encoding.** All files UTF-8 without BOM.
9. **UK locale, always.** `lang="en-GB"`, British spelling, prices formatted with `Intl.NumberFormat` in the configured locale and currency. Never hardcode a currency symbol or a date format. Never write USD, "one-time", "color", "behavior", or any other American form.
10. **The register data is the single source of truth.** skills.json drives every page. Changing a price, a description or a publisher must never require touching HTML.
11. **One PayPal seam.** `marketplace.paypalBase` in skills.json is the only place a PayPal handle appears. The amount is appended per entry.
12. **Every page must pass the test.** `node test\page-render.test.js` must be green before any commit.

## Guardrails

- `test/page-render.test.js` — 100 assertions over all three pages. Runs on Node with a DOM shim: no browser, no RAM cost.
- `test/shot.js` — headless Edge over CDP. Renders a page at a true emulated viewport and reports any element overflowing the viewport. `node test\shot.js <url> <out.png> <width> <height> measure`.
- A test that has never been seen red is not a test. Mutate the product code, confirm red, restore, confirm green.
