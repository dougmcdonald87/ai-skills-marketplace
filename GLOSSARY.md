# Glossary

**Skill**: a self-contained capability for an AI agent. Has an interface (what the agent does) and an implementation (how it works). Ships as a SKILL.md file plus optional scripts and references.

**Platform**: the AI agent environment a skill runs in — Claude Code, Cursor, opencode, Continue, etc. Skills on this marketplace are platform-agnostic by default.

**Module**: anything with an interface and an implementation. A skill is a module.

**Interface**: everything a caller must know to use a skill correctly — type signature, invariants, ordering constraints, error modes, required configuration.

**Depth**: leverage at the interface. A deep skill has a small interface with lots of behavior behind it.

**Seam**: a place where behavior can be altered without editing in that place. Where a skill's interface lives.

**Adapter**: a concrete thing that satisfies a skill's interface at a seam. Describes role, not substance.

**Leverage**: what callers get from depth — more capability per unit of interface learned.

**Locality**: what maintainers get from depth — change, bugs, knowledge, and verification concentrate in one place.

**Freemium**: free skills link to GitHub; paid skills have a PayPal checkout button.

**Verified**: a skill the marketplace author has tested and confirmed working.