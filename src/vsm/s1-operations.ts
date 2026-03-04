/**
 * S1 Operations Analysis
 *
 * System One = The operational units that do the actual work.
 * Each S1 must be viable in its own right - able to survive
 * independently if separated from the whole.
 *
 * In code: Feature modules, services, handlers that DO things.
 * NOT: utilities, helpers, shared code.
 *
 * Key question: Can this module be hived off?
 */

import type { CodebaseIndex } from '../scanner'
import type { VarietyProfile } from './variety'
import type { RecursionLevel } from './recursion'

export interface S1Finding {
  type: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  message: string
  files: string[]
}

export interface S1Analysis {
  score: number
  findings: S1Finding[]
  /** Modules identified as operational units */
  operationalUnits: string[]
  /** Modules that are support functions (not S1) */
  supportFunctions: string[]
}

/**
 * Identify which modules are operational (S1) vs support
 */
function classifyModules(
  index: CodebaseIndex,
  profiles: Map<string, VarietyProfile>
): { operational: string[]; support: string[] } {
  const operational: string[] = []
  const support: string[] = []

  // Heuristics for operational vs support:
  // - Operational: handlers, services, features, commands, routes
  // - Support: utils, helpers, lib, shared, common, types

  const supportPatterns = /\/(utils?|helpers?|lib|shared|common|types|constants|config)\//i
  const operationalPatterns = /\/(handlers?|services?|features?|commands?|routes?|api|controllers?|modules?)\//i

  for (const [path, profile] of profiles) {
    if (supportPatterns.test('/' + path)) {
      support.push(path)
    } else if (operationalPatterns.test('/' + path)) {
      operational.push(path)
    } else {
      // Use variety profile: high fan-in = support, high fan-out = operational
      if (profile.fanIn > profile.fanOut * 2) {
        support.push(path)
      } else {
        operational.push(path)
      }
    }
  }

  return { operational, support }
}

/**
 * Analyze S1 health
 */
export function analyzeS1(
  index: CodebaseIndex,
  profiles: Map<string, VarietyProfile>,
  recursionLevels: RecursionLevel[]
): S1Analysis {
  const findings: S1Finding[] = []
  let score = 10

  const { operational, support } = classifyModules(index, profiles)

  // Check 1: Do operational units have clear boundaries?
  for (const path of operational) {
    const profile = profiles.get(path)
    if (!profile) continue

    // S1 should be relatively autonomous - not too many external deps
    if (profile.fanOut > 10) {
      score -= 0.5
      findings.push({
        type: 'S1-Too-Weak',
        severity: 'MEDIUM',
        message: `${path} has ${profile.fanOut} dependencies - lacks autonomy`,
        files: [path],
      })
    }
  }

  // Check 2: Is there an S1 at all? (Can't have viable system without operations)
  if (operational.length === 0) {
    score -= 3
    findings.push({
      type: 'S1-Missing',
      severity: 'HIGH',
      message: 'No clear operational units identified - where is the work done?',
      files: [],
    })
  }

  // Check 3: Are S1 units cohesive? (Check recursion levels)
  for (const level of recursionLevels) {
    const isOperational = operational.some(op => op.startsWith(level.path + '/'))
    if (isOperational && level.cohesion < 0.3) {
      score -= 1
      findings.push({
        type: 'S1-Fragmentation',
        severity: 'MEDIUM',
        message: `${level.path} has low cohesion (${(level.cohesion * 100).toFixed(0)}%) - operations scattered`,
        files: level.files.slice(0, 3),
      })
    }
  }

  // Check 4: Support functions bleeding into operations?
  for (const path of support) {
    const profile = profiles.get(path)
    if (!profile) continue

    // If "support" has very high fan-in, it might be doing operational work
    if (profile.fanIn > 8 && profile.produced > 10) {
      findings.push({
        type: 'S1-Misclassified',
        severity: 'LOW',
        message: `${path} looks like support but has high coupling - may be hidden S1`,
        files: [path],
      })
    }
  }

  return {
    score: Math.max(0, Math.min(10, score)),
    findings,
    operationalUnits: operational,
    supportFunctions: support,
  }
}
