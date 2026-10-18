# Ticket 002 — Individual skill page (skill-page.html)

## From spec
MVP scope item 2: Individual skill page with PayPal buy button or GitHub link.

## Acceptance criteria
- skill-page.html exists in repo root
- Accepts skill ID via URL query param (?id=skill-001)
- Displays skill name, description, platform, category, price
- Free skills: "Install from GitHub" button
- Paid skills: PayPal checkout button with price
- "Back to marketplace" link to index.html

## Blocking edges
Ticket 001 (landing page exists first)

## Definition of done
- File committed to git
- Opens with ?id=skill-001 and renders correct skill
- PayPal button href is valid
- GitHub link href is valid