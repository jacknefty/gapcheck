/**
 * S4 Intelligence Analysis (Outside & Then)
 *
 * System Four = Scanning the external environment. Modeling the future.
 * Planning and development. The "biggest switch" connecting
 * future/outside to present/inside.
 *
 * "When S4 is cut back under financial pressure, this is SUICIDAL.
 *  System Four is the organ of adaptation."
 *
 * In code:
 * - Dependency management (what's changing in the ecosystem?)
 * - Deprecation awareness (what's dying?)
 * - Type evolution (how is the contract changing?)
 * - API versioning (managing environmental change)
 * - Tech debt tracking (where are we heading?)
 *
 * Key question: Does this codebase know what's coming?
 */

import type { CodebaseIndex } from '../types'

export interface S4Finding {
  type: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  message: string
  files: string[]
}

export interface S4Analysis {
  score: number
  findings: S4Finding[]
  /** Deprecation warnings found */
  deprecations: string[]
  /** Future-facing patterns detected */
  futurePatterns: string[]
  /** Technical debt markers */
  techDebtMarkers: string[]
  /** Is there versioning/migration awareness? */
  hasVersioning: boolean
}

/**
 * Find deprecation markers in code
 */
function findDeprecations(index: CodebaseIndex): string[] {
  const deprecations: string[] = []

  for (const [path, file] of index.files) {
    const content = file.content

    // @deprecated JSDoc
    if (/@deprecated/i.test(content)) {
      const matches = content.match(/@deprecated[^\n]*/gi) || []
      for (const match of matches) {
        deprecations.push(`${path}: ${match.trim()}`)
      }
    }

    // Deprecated imports/usage patterns
    if (/deprecated|will be removed|scheduled for removal/i.test(content)) {
      deprecations.push(`${path}: Contains deprecation notice`)
    }
  }

  return [...new Set(deprecations)]
}

/**
 * Detect future-facing patterns (signs of S4 thinking)
 */
function detectFuturePatterns(index: CodebaseIndex): string[] {
  const patterns: string[] = []

  for (const [path, file] of index.files) {
    const content = file.content

    // API versioning
    if (/\/v\d+\/|api.*version|ApiVersion|@version/i.test(content)) {
      patterns.push(`${path}: API versioning`)
    }

    // Migration patterns
    if (/migration|migrate|upgrade|schema.*version/i.test(content)) {
      patterns.push(`${path}: Migration support`)
    }

    // Feature flags for gradual rollout
    if (/featureFlag|feature_flag|isEnabled|canary|rollout/i.test(content)) {
      patterns.push(`${path}: Feature flags`)
    }

    // Adapter/Strategy patterns (enabling future change)
    if (/Adapter|Strategy|implements\s+\w+Interface|abstract\s+class/i.test(content)) {
      patterns.push(`${path}: Extensibility pattern`)
    }

    // Dependency abstraction
    if (/interface.*Repository|interface.*Service|Port.*Adapter/i.test(content)) {
      patterns.push(`${path}: Dependency abstraction`)
    }
  }

  return [...new Set(patterns)]
}

/**
 * Find technical debt markers
 */
function findTechDebtMarkers(index: CodebaseIndex): S4Finding[] {
  const findings: S4Finding[] = []

  for (const [path, file] of index.files) {
    const content = file.content

    // TODO/FIXME/HACK comments
    const todoMatches = content.match(/\/\/\s*(TODO|FIXME|HACK|XXX|BUG)[:\s][^\n]*/gi) || []
    if (todoMatches.length > 3) {
      findings.push({
        type: 'Tech-Debt-Accumulation',
        severity: 'LOW',
        message: `${path}: ${todoMatches.length} TODO/FIXME markers`,
        files: [path],
      })
    }

    // Temporary workarounds
    if (/temporary|workaround|quick.?fix|bandaid|band-aid/i.test(content)) {
      findings.push({
        type: 'Temporary-Code',
        severity: 'LOW',
        message: `${path}: Contains temporary/workaround code`,
        files: [path],
      })
    }

    // Disabled tests (only in test files)
    const isTestFile = /\.(test|spec)\.(ts|js|tsx|jsx)$|__tests__/.test(path)
    if (isTestFile && /\.skip\(|xdescribe|xit\(|@Ignore|@Disabled/i.test(content)) {
      findings.push({
        type: 'Disabled-Tests',
        severity: 'MEDIUM',
        message: `${path}: Contains disabled tests - degraded feedback loop`,
        files: [path],
      })
    }

    // Ignored linting (significant suppressions only)
    const ignoreMatches = content.match(/@ts-ignore|@ts-nocheck|eslint-disable(?!-next-line)/gi) || []
    if (ignoreMatches.length > 3) {
      findings.push({
        type: 'Suppressed-Warnings',
        severity: 'MEDIUM',
        message: `${path}: ${ignoreMatches.length} lint suppressions - hiding problems`,
        files: [path],
      })
    }
  }

  return findings
}

/**
 * Check for versioning/migration awareness
 */
function hasVersioningAwareness(index: CodebaseIndex): boolean {
  for (const [path, file] of index.files) {
    // Package.json version
    if (path === 'package.json') {
      return true
    }

    // Schema/API versions
    if (/schemaVersion|apiVersion|SCHEMA_VERSION|API_VERSION/i.test(file.content)) {
      return true
    }

    // Migration files
    if (/migrations?\/|\.migration\./i.test(path)) {
      return true
    }

    // Changelog
    if (/CHANGELOG|CHANGES|HISTORY/i.test(path)) {
      return true
    }
  }

  return false
}

/**
 * Analyze S4 health
 */
export function analyzeS4(index: CodebaseIndex): S4Analysis {
  const findings: S4Finding[] = []
  let score = 10

  const deprecations = findDeprecations(index)
  const futurePatterns = detectFuturePatterns(index)
  const techDebtFindings = findTechDebtMarkers(index)
  const hasVersioning = hasVersioningAwareness(index)

  // Extract tech debt markers as strings for the analysis result
  const techDebtMarkers = techDebtFindings.map(f => f.message)

  // Check 1: Any future-facing patterns?
  if (futurePatterns.length === 0 && index.files.size > 10) {
    score -= 2
    findings.push({
      type: 'S4-Missing',
      severity: 'MEDIUM',
      message: 'No future-facing patterns (versioning, adapters, abstractions) - system may be brittle to change',
      files: [],
    })
  }

  // Check 2: Unaddressed deprecations
  if (deprecations.length > 5) {
    score -= 2
    findings.push({
      type: 'Deprecation-Debt',
      severity: 'HIGH',
      message: `${deprecations.length} deprecation markers - technical debt accumulating`,
      files: [],
    })
  } else if (deprecations.length > 0) {
    score -= 0.5
    findings.push({
      type: 'Deprecations-Present',
      severity: 'LOW',
      message: `${deprecations.length} deprecation markers found`,
      files: [],
    })
  }

  // Check 3: Technical debt
  for (const finding of techDebtFindings) {
    if (finding.severity === 'MEDIUM') score -= 0.5
    else score -= 0.25
    findings.push(finding)
  }

  // Check 4: No versioning awareness
  if (!hasVersioning && index.files.size > 5) {
    score -= 1
    findings.push({
      type: 'No-Versioning',
      severity: 'LOW',
      message: 'No versioning/migration patterns detected',
      files: [],
    })
  }

  // Bonus: Good future-facing practices
  if (futurePatterns.length > 3) {
    score = Math.min(10, score + 1) // Cap at 10
  }

  return {
    score: Math.max(0, Math.min(10, score)),
    findings,
    deprecations,
    futurePatterns,
    techDebtMarkers,
    hasVersioning,
  }
}
