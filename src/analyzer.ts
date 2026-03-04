/**
 * Analyzer - VSM Viability Analysis
 *
 * Orchestrates the five systems analysis using proper cybernetic thinking:
 * - Variety flows, not just file counts
 * - Recursion levels, not flat analysis
 * - Channel capacity, not just symptom detection
 */

import type { CodebaseIndex } from './scanner'
import { analyzeVariety, type VarietyAnalysis, type VarietyImbalance } from './vsm/variety'
import { analyzeRecursion, type RecursionAnalysis } from './vsm/recursion'
import { analyzeS1, type S1Analysis } from './vsm/s1-operations'
import { analyzeS2, type S2Analysis } from './vsm/s2-coordination'
import { analyzeS3, type S3Analysis } from './vsm/s3-control'
import { analyzeS3Star, type S3StarAnalysis } from './vsm/s3-star-audit'
import { analyzeS4, type S4Analysis } from './vsm/s4-intelligence'
import { analyzeS5, type S5Analysis } from './vsm/s5-identity'

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW'

export interface Finding {
  system: 'S1' | 'S2' | 'S3' | 'S3*' | 'S4' | 'S5' | 'Variety' | 'Recursion'
  type: string
  severity: Severity
  message: string
  files: string[]
}

export interface VSMScores {
  s1Operations: number
  s2Coordination: number
  s3Control: number
  s3StarAudit: number
  s4Intelligence: number
  s5Identity: number
  varietyBalance: number
  overall: number
}

export interface Analysis {
  findings: Finding[]
  scores: VSMScores
  variety: VarietyAnalysis
  recursion: RecursionAnalysis
  s1: S1Analysis
  s2: S2Analysis
  s3: S3Analysis
  s3Star: S3StarAnalysis
  s4: S4Analysis
  s5: S5Analysis
}

/**
 * Calculate variety balance score
 */
function calculateVarietyScore(variety: VarietyAnalysis): number {
  let score = 10

  // Penalize high concentration
  if (variety.concentration > 0.7) {
    score -= 3
  } else if (variety.concentration > 0.5) {
    score -= 2
  } else if (variety.concentration > 0.3) {
    score -= 1
  }

  // Penalize imbalances
  for (const imbalance of variety.imbalances) {
    if (imbalance.severity === 'HIGH') score -= 1.5
    else if (imbalance.severity === 'MEDIUM') score -= 1
    else score -= 0.5
  }

  return Math.max(0, Math.min(10, score))
}

/**
 * Convert variety imbalances to findings
 */
function varietyToFindings(variety: VarietyAnalysis): Finding[] {
  return variety.imbalances.map(imb => ({
    system: 'Variety' as const,
    type: imb.type,
    severity: imb.severity,
    message: imb.message,
    files: imb.files,
  }))
}

/**
 * Convert recursion issues to findings
 */
function recursionToFindings(recursion: RecursionAnalysis): Finding[] {
  const findings: Finding[] = []

  // Flag highly coupled subsystems
  for (const coupled of recursion.coupledSubsystems.slice(0, 3)) {
    const level = recursion.levels.find(l => l.path === coupled)
    if (level) {
      findings.push({
        system: 'Recursion',
        type: 'Coupled-Subsystem',
        severity: 'MEDIUM',
        message: `${coupled}: ${(level.cohesion * 100).toFixed(0)}% cohesion - too coupled to separate`,
        files: level.files.slice(0, 3),
      })
    }
  }

  return findings
}

/**
 * Run complete VSM analysis
 */
export function analyze(index: CodebaseIndex): Analysis {
  // First: calculate variety flows
  const variety = analyzeVariety(index)

  // Second: identify recursion levels
  const recursion = analyzeRecursion(index)

  // Third: analyze each system using variety data
  const s1 = analyzeS1(index, variety.profiles, recursion.levels)
  const s2 = analyzeS2(index, variety.profiles)
  const s3 = analyzeS3(index, variety.profiles)
  const s3Star = analyzeS3Star(index)
  const s4 = analyzeS4(index)
  const s5 = analyzeS5(index, variety.profiles)

  // Calculate variety balance score
  const varietyScore = calculateVarietyScore(variety)

  // Aggregate scores
  const scores: VSMScores = {
    s1Operations: s1.score,
    s2Coordination: s2.score,
    s3Control: s3.score,
    s3StarAudit: s3Star.score,
    s4Intelligence: s4.score,
    s5Identity: s5.score,
    varietyBalance: varietyScore,
    // Weighted average (S3* and variety are implicit, weight less)
    overall: Math.round(
      (s1.score * 1.5 +
        s2.score * 1.5 +
        s3.score * 1.0 +
        s3Star.score * 1.0 +
        s4.score * 1.0 +
        s5.score * 1.5 +
        varietyScore * 0.5) *
        (100 / 80)
    ),
  }

  // Aggregate findings
  const findings: Finding[] = [
    ...s1.findings.map(f => ({ ...f, system: 'S1' as const })),
    ...s2.findings.map(f => ({ ...f, system: 'S2' as const })),
    ...s3.findings.map(f => ({ ...f, system: 'S3' as const })),
    ...s3Star.findings.map(f => ({ ...f, system: 'S3*' as const })),
    ...s4.findings.map(f => ({ ...f, system: 'S4' as const })),
    ...s5.findings.map(f => ({ ...f, system: 'S5' as const })),
    ...varietyToFindings(variety),
    ...recursionToFindings(recursion),
  ]

  // Sort by severity
  const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 }
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return {
    findings,
    scores,
    variety,
    recursion,
    s1,
    s2,
    s3,
    s3Star,
    s4,
    s5,
  }
}
