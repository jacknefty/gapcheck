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

```bash
# Clone and run
git clone https://github.com/YOUR_USERNAME/gapcheck
cd gapcheck
bun install

# Or link globally
bun link
gapcheck ./any-project
```

## Usage

```bash
# Analyze a project
bun ./src/index.ts /path/to/project

# JSON output
bun ./src/index.ts /path/to/project --json

# Verbose (all findings)
bun ./src/index.ts /path/to/project -v
```

## Output

```
GapCheck Viability Report
============================================================

Project:   my-project
Scanned:   47 files, 12,340 lines
Languages: typescript (42), python (5)
Score:     64/100

Variety Engineering
------------------------------------------------------------
Total variety: 260 exports
Concentration: 49% (distributed)
Viable subsystems: src/features, src/api

VSM Assessment
------------------------------------------------------------
+ S1 Operations:    9.0/10  Operations (viable units)
+ S2 Coordination:  10.0/10 Coordination (anti-oscillation)
~ S3 Control:       6.5/10  Control (inside & now)
- S3* Audit:        3.5/10  Audit (observability)
+ S4 Intelligence:  8.5/10  Intelligence (outside & then)
- S5 Identity:      4.0/10  Identity (closure)
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
- **Cohesion**: Can this subsystem be hived off?

A module with 50 exports isn't automatically bad. A module with 50 exports and 2 consumers has **unabsorbed variety** — that's the pathology.

## License

MIT
