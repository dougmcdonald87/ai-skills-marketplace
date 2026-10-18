# Coding Standards

Mechanical rules only. Judgement calls go in code review.

1. **Single file where possible.** index.html, skill-page.html, submit.html are standalone — no build step, no framework.
2. **Inline CSS and JS.** No separate .css or .js files unless a file exceeds 200 lines.
3. **Vanilla JavaScript only.** No React, Vue, npm, node_modules, or build pipeline.
4. **System fonts.** No web fonts, no icon libraries, no external CSS frameworks.
5. **PayPal links only.** No Stripe, no bank accounts, no subscriptions unless PayPal supports them.
6. **One file open at a time.** 4GB RAM constraint — no multi-file editing sessions.
7. **No external images.** No logos, no screenshots, no hero graphics.
8. **UTF-8 encoding.** All files UTF-8 without BOM.