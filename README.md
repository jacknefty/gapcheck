# GapCheck

Diagnose codebase viability using Stafford Beer's Viable System Model (VSM).

```bash
bun ./src/index.ts ./my-project
```

## What It Does

GapCheck analyzes your codebase through a cybernetic lens, measuring **variety flows** rather than just counting metrics. It answers:

- Can subsystems be hived off? (S1 Operations)
- What prevents oscillation? (S2 Coordination)
- Is there a synoptic view? (S3 Control)
- Can pain signals get through? (S3* Audit)
- Does the system know what's coming? (S4 Intelligence)
- What IS this system? (S5 Identity)

## Installation

### CLI Tool

```bash
bun add -g gapcheck
```

Or from source:

```bash
git clone https://github.com/jacknefty/gapcheck
cd gapcheck
bun install
bun link
```

### Claude Code Plugin

Install the plugin to get the `/gapcheck` skill:

```
/plugin install gapcheck@claude-plugin-directory
```

Or manually add the skill by copying `skills/gapcheck/SKILL.md` to `~/.claude/skills/gapcheck/`.

## Usage

```bash
gapcheck ./my-project          # Analyze a project
gapcheck .                     # Analyze current directory
gapcheck ./src --json          # JSON output
gapcheck ./my-project -v       # Verbose (all findings)
```

## Claude Code Skill

After running `bun link`, the `/gapcheck` skill is available in Claude Code:

```
/gapcheck              # Analyze current directory
/gapcheck src/         # Analyze specific path
```

The skill uses the Stafford Beer VSM framework to diagnose your codebase and suggest interventions.

## Output

```
GapCheck Report
==================================================
Project: my-project
Files:   47 (12,340 LOC)
Score:   64/100

VSM Assessment
--------------------------------------------------
+ S1 Operations:   9.0/10
+ S2 Coordination: 10.0/10
~ S3 Control:      6.5/10
- S3* Audit:       3.5/10
+ S4 Intelligence: 8.5/10
- S5 Identity:     4.0/10

Viability Axioms
--------------------------------------------------
+ Axiom 1: Operations/management balanced
+ Axiom 2: Present/future balanced
- Axiom 3: Weak identity - variety leaking

Algedonic Channels
--------------------------------------------------
~ 48 error sources traced
  35% reach alerting services
  12 reach logs only
  3 swallowed silently

POSIWID
--------------------------------------------------
8 complex functions without tests
  src/api/handler.ts: processRequest()
  src/core/engine.ts: runPipeline()

Findings
--------------------------------------------------
HIGH (2)
  [S3*] Silent error zones in src/utils/
  [S5] Domain types defined but not consumed
MEDIUM (3)
  ...
```

## Supported Languages

- TypeScript / JavaScript
- Python
- Go
- Rust

## The VSM Mapping

| System | Name | Code Equivalent |
|--------|------|-----------------|
| S1 | Operations | Feature modules, services, handlers |
| S2 | Coordination | Events, queues, state management |
| S3 | Control | Config, DI, orchestration |
| S3* | Audit | Logging, error tracking, monitoring |
| S4 | Intelligence | Deprecations, versioning, migrations |
| S5 | Identity | Domain types, validation, invariants |

## Philosophy

> "Only variety can destroy variety" — Ashby's Law

Traditional static analysis counts symptoms. GapCheck measures **variety flows**:

- **Fan-in**: How many modules depend on this one?
- **Fan-out**: How many modules does this depend on?
- **Concentration**: Is variety evenly distributed or bottlenecked?
- **Cohesion**: How self-contained is this module?

A module with 50 exports isn't automatically bad. A module with 50 exports and 2 consumers has **unabsorbed variety** — that's the pathology.

## License

MIT
