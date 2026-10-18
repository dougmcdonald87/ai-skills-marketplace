# AI Agent Skills Marketplace — Spec

## Goal
A platform-agnostic web marketplace for AI agent skills (Claude Code, Cursor, opencode, Continue, etc.) that makes profit via freemium + paid skills with PayPal-only payments.

## Guiding constraints (from user)
- **Customer:** All markets — individuals, teams, enterprise
- **Pricing:** Freemium + paid skills (one-time via PayPal), no subscriptions yet
- **Payments:** PayPal only — no bank account until revenue justifies it
- **Scope:** Universal, platform-agnostic — works with every AI agent, not locked to Cursor or Claude Code
- **Stack:** Best free route — static HTML/JS + PayPal buttons, free hosting (GitHub Pages/Netlify)
- **Moat:** Cross-platform neutrality + verified/tested skills + creator PayPal monetization tools

## Domain model (from GLOSSARY.md)
- **Skill:** self-contained capability for an AI agent. Ships as SKILL.md + optional scripts/references.
- **Platform:** the AI agent environment (Cursor, Claude Code, opencode, Continue). Skills are platform-agnostic by default.
- **Module:** anything with an interface and implementation.
- **Interface:** everything a caller must know — type signature, invariants, error modes, required config.
- **Depth:** leverage at the interface — lots of behavior behind small interface.
- **Seam:** place where behavior can be altered without editing in that place.
- **Adapter:** concrete thing satisfying an interface at a seam.
- **Freemium:** free skills link to GitHub; paid skills have PayPal checkout button.
- **Verified:** marketplace author has tested the skill.

## MVP scope
1. Landing page (index.html) — skill directory grid, free + paid
2. Individual skill page (skill-page.html) — skill detail + PayPal buy button OR GitHub install link
3. Creator submission (submit.html) — form to add a skill
4. skills.json — skill registry (single source of truth)
5. GLOSSARY.md, CODING-STANDARDS.md, ADR-0001.md

## Out of scope (YAGNI)
- User accounts / auth
- Database / backend
- Search / filtering
- Analytics beyond PayPal
- Subscriptions / recurring billing
- Stripe / any non-PayPal processor

## Success criteria
- Site loads on GitHub Pages free tier
- Free skills install via GitHub link
- Paid skills checkout via PayPal button
- Creator can submit a skill via form (manual review for MVP)

## Next step
Write `.scratch/issues/` tickets from this spec.