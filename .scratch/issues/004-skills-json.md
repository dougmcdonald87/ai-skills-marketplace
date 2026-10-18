# Ticket 004 — Skill registry (skills.json)

## From spec
MVP scope item 4: skills.json — single source of truth for skill registry.

## Acceptance criteria
- skills.json exists in repo root
- Contains all 4 seed skills from index.html
- Each skill has: id, name, desc, platform, category, price, paypal, github, free, verified
- price is number (0 = free)
- free = true when price is 0, false when > 0

## Blocking edges
None

## Definition of done
- File committed to git
- Valid JSON
- Matches skills shown on index.html