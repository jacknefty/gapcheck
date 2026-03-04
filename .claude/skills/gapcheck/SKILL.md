---
name: gapcheck
description: Analyze codebase viability using Stafford Beer's VSM
allowed-tools: Bash
---

# GapCheck - Codebase Viability Analysis

Analyze the current project using the Viable System Model (VSM).

## Usage

```
/gapcheck           # Analyze current directory
/gapcheck src/      # Analyze specific path
/gapcheck --json    # JSON output
/gapcheck -v        # Verbose (all findings)
```

## Run Analysis

```bash
bun $(dirname "$SKILL_PATH")/../../../src/index.ts ${ARGUMENTS:-.} 2>&1
```

## Interpret Results

After running the analysis, explain the findings to the user:

1. **Variety Engineering** - Is variety concentrated (bottleneck) or distributed?
2. **VSM Scores** - Which systems are weak? What does that mean?
3. **Findings** - Explain each pathology in plain language
4. **Recommendations** - Prioritize the most impactful fixes

### VSM Quick Reference

| System | What It Means |
|--------|---------------|
| S1 Operations | Can modules be hived off? Clear boundaries? |
| S2 Coordination | What prevents oscillation? Events, state management? |
| S3 Control | Is there a synoptic view? Config, orchestration? |
| S3* Audit | Can you see what's happening? Logging, errors? |
| S4 Intelligence | Does the system know what's coming? Deprecations, versioning? |
| S5 Identity | What IS this system? Domain types, validation? |

### Severity Guide

- **HIGH** - Viability threat, fix soon
- **MEDIUM** - Degraded health, plan to address
- **LOW** - Minor issue, fix when convenient
