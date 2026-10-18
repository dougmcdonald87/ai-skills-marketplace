# Glossary

**Skill**: a self-contained capability for an AI agent. Has an interface (what the agent does) and an implementation (how it works). Ships as a SKILL.md file plus optional scripts and references.

**Platform**: the AI agent environment a skill runs in — Claude Code, Cursor, opencode, Continue, etc. Skills on this marketplace are platform-agnostic by default.

**Module**: anything with an interface and an implementation. A skill is a module.

**Interface**: everything a caller must know to use a skill correctly — type signature, invariants, ordering constraints, error modes, required configuration.

**Depth**: leverage at the interface. A deep skill has a small interface with lots of behaviour behind it.

**Seam**: a place where behaviour can be altered without editing in that place. Where a skill's interface lives.

**Adapter**: a concrete thing that satisfies a skill's interface at a seam. Describes role, not substance.

**Leverage**: what callers get from depth — more capability per unit of interface learned.

**Locality**: what maintainers get from depth — change, bugs, knowledge, and verification concentrate in one place.

**Register**: the marketplace itself. A numbered catalogue of agent skills published from Arbroath. The name is deliberate: a register is a record of what exists, and a catalogue is a list with prices.

**Entry**: one skill in the register. Carries a number, a name, a description, a category, a price, a publisher and a verification mark. Entries are the unit of sale.

**Number**: the position of an entry in the register, shown as "No. 001". Assigned in the order entries are accepted, and never reused.

**Issue**: a numbered edition of the register. The masthead names the current one.

**Specification**: the sheet on an entry page stating format, platform, publisher, price, payment method and verification. Derived entirely from the entry's own data, never asserted separately.

**Colophon**: the printed footer of the register. Carries the place of publication, the currency and the payment terms. This is where the Arbroath address lives.

**Freemium**: free entries link to GitHub; paid entries have a PayPal checkout button.

**Verified**: an entry the register author has tested and confirmed working. A trust mark, not a guarantee.

**Publisher**: whoever stands behind the entry. Either The Register, for entries published here, or a named third party.
