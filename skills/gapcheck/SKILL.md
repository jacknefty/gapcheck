---
name: gapcheck
description: Analyze codebase viability using Stafford Beer's VSM
---

# GapCheck - Codebase Viability Analysis

Diagnose the current project using the Viable System Model (VSM).

## Instructions

Run this command to analyze the codebase:

```bash
gapcheck ${ARGUMENTS:-.}
```

## After Analysis

Interpret the results for the user with clear, actionable guidance:

1. **Overall Score** - Summarize viability status
2. **VSM Scores** - Present as a table with interpretations for each system
3. **Algedonic Channels** - Explain pain signal coverage (% reaching alerts vs logs)
4. **Key Pathologies** - Group by severity, explain each finding
5. **Recommendations** - Prioritized action list

### VSM Systems Reference

| System | Question | Healthy Signs |
|--------|----------|---------------|
| S1 Operations | Are producers cohesive? | Components could be hived off independently |
| S2 Coordination | What prevents oscillation? | No circular deps, shared state managed |
| S3 Control | Is there synoptic oversight? | Centralized config, orchestration |
| S3* Audit | Can the system see itself? | Errors traced to alerts, not just logs |
| S4 Intelligence | Does it see the future? | Versioning, deprecation handling |
| S5 Identity | What IS this system? | Domain types consumed, not just defined |

### Severity Levels

- **HIGH** - Viability threat, fix immediately
- **MEDIUM** - Degraded health, address soon
- **LOW** - Minor issue, fix when convenient

### Algedonic Coverage

- **Strong (>50%)** - Pain signals reach management
- **Weak (20-50%)** - Some signals get through
- **Absent (<20%)** - System is blind to its own pain
