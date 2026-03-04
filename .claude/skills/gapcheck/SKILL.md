---
name: gapcheck
description: Analyze codebase viability using Stafford Beer's VSM
---

# GapCheck - Codebase Viability Analysis

Analyze the current project using the Viable System Model (VSM).

## Instructions

Run this command to analyze the codebase:

```bash
bun /Users/lionsmane/Desktop/GapCheck/src/index.ts $ARGUMENTS
```

If `$ARGUMENTS` is empty, analyze the current working directory (`.`).

## After Analysis

Interpret the results for the user:

1. **Variety Engineering** - Is variety concentrated (bottleneck) or distributed?
2. **VSM Scores** - Which systems are weak and why?
3. **Findings** - Explain each pathology in plain terms
4. **Recommendations** - What to fix first

### VSM Reference

| System | Meaning |
|--------|---------|
| S1 Operations | Can modules be hived off? Clear boundaries? |
| S2 Coordination | What prevents oscillation? Events, state management? |
| S3 Control | Synoptic view? Config, orchestration? |
| S3* Audit | Observability? Logging, error tracking? |
| S4 Intelligence | Future awareness? Deprecations, versioning? |
| S5 Identity | What IS this system? Domain types, validation? |

### Severity

- **HIGH** - Viability threat
- **MEDIUM** - Degraded health
- **LOW** - Minor issue
