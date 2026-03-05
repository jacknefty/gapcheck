/**
 * Analyzer - Run VSM diagnosis on a codebase
 */

import type { CodebaseIndex, Finding, VSMScores } from './types'
import {
  analyzeVariety, type VarietyAnalysis,
  analyzeRecursion, type RecursionAnalysis,
  analyzeS1, type S1Analysis,
  analyzeS2, type S2Analysis,
  analyzeS3, type S3Analysis,
  analyzeS3Star, checkPainSignals, type S3StarAnalysis,
  analyzeS4, type S4Analysis,
  analyzeS5, type S5Analysis,
  checkAxioms, type AxiomResult,
  analyzePOSIWID, type POSIWIDAnalysis,
  traceAlgedonicChannels, type AlgedonicAnalysis,
} from './vsm'

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
  axioms: AxiomResult[]
  posiwid: POSIWIDAnalysis
  painSignals: { coverage: number; strength: string }
  algedonic: AlgedonicAnalysis
}

export function analyze(index: CodebaseIndex): Analysis {
  // Variety analysis
  const variety = analyzeVariety(index)
  const recursion = analyzeRecursion(index)

  // Five systems
  const s1 = analyzeS1(index, variety.profiles, [])
  const s2 = analyzeS2(index, variety.profiles)
  const s3 = analyzeS3(index, variety.profiles)
  const s3Star = analyzeS3Star(index)
  const s4 = analyzeS4(index)
  const s5 = analyzeS5(index, variety.profiles)

  // Viability checks
  const axioms = checkAxioms(index, variety, s1, s3, s4, s5)
  const posiwid = analyzePOSIWID(index)
  const painSignals = checkPainSignals(index)
  const algedonic = traceAlgedonicChannels(index)

  // Calculate variety score
  let varietyScore = 10
  if (variety.concentration > 0.7) varietyScore -= 3
  else if (variety.concentration > 0.5) varietyScore -= 2
  for (const imb of variety.imbalances) {
    varietyScore -= imb.severity === 'HIGH' ? 1.5 : imb.severity === 'MEDIUM' ? 1 : 0.5
  }
  varietyScore = Math.max(0, Math.min(10, varietyScore))

  // Adjust S3* score based on actual alert coverage from flow tracing
  let s3StarScore = s3Star.score
  if (algedonic.paths.length > 0) {
    // Weight: 50% presence detection, 50% actual coverage
    const coverageScore = algedonic.coverage * 10
    s3StarScore = Math.round((s3Star.score + coverageScore) / 2 * 10) / 10

    // Penalize silent zones
    if (algedonic.silentZones.length > 3) {
      s3StarScore = Math.max(0, s3StarScore - 2)
    }
  }

  const scores: VSMScores = {
    s1Operations: s1.score,
    s2Coordination: s2.score,
    s3Control: s3.score,
    s3StarAudit: s3StarScore,
    s4Intelligence: s4.score,
    s5Identity: s5.score,
    varietyBalance: varietyScore,
    overall: Math.round(
      (s1.score + s2.score + s3.score + s3StarScore + s4.score + s5.score + varietyScore) / 7 * 10
    ),
  }

  // Collect findings
  const findings: Finding[] = [
    ...s1.findings.map(f => ({ ...f, system: 'S1' as const })),
    ...s2.findings.map(f => ({ ...f, system: 'S2' as const })),
    ...s3.findings.map(f => ({ ...f, system: 'S3' as const })),
    ...s3Star.findings.map(f => ({ ...f, system: 'S3*' as const })),
    ...s4.findings.map(f => ({ ...f, system: 'S4' as const })),
    ...s5.findings.map(f => ({ ...f, system: 'S5' as const })),
    ...variety.imbalances.map(imb => ({
      system: 'Variety' as const,
      type: imb.type,
      severity: imb.severity,
      message: imb.message,
      files: imb.files,
    })),
  ]

  // Add axiom findings
  for (const ax of axioms) {
    if (!ax.ok) {
      findings.push({
        system: 'S3' as const, // Axioms are meta-system concerns
        type: `Axiom-${ax.axiom}`,
        severity: 'MEDIUM',
        message: ax.message,
        files: [],
      })
    }
  }

  // Sort by severity
  findings.sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 }
    return order[a.severity] - order[b.severity]
  })

  return {
    findings,
    scores,
    variety,
    recursion,
    s1, s2, s3, s3Star, s4, s5,
    axioms,
    posiwid,
    painSignals,
    algedonic,
  }
}
