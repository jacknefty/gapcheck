/**
 * Axioms - Viability balance checks
 *
 * Three quick checks:
 * 1. Operations vs Management balance
 * 2. Present (S3) vs Future (S4) balance
 * 3. Identity (S5) absorbs residual variety
 */

import type { CodebaseIndex } from '../types'
import type { VarietyAnalysis } from './variety'
import type { S1Analysis } from './s1-operations'
import type { S3Analysis } from './s3-control'
import type { S4Analysis } from './s4-intelligence'
import type { S5Analysis } from './s5-identity'

export interface AxiomResult {
  axiom: 1 | 2 | 3
  ok: boolean
  message: string
}

export function checkAxioms(
  index: CodebaseIndex,
  variety: VarietyAnalysis,
  s1: S1Analysis,
  s3: S3Analysis,
  s4: S4Analysis,
  s5: S5Analysis
): AxiomResult[] {
  const results: AxiomResult[] = []

  // Axiom 1: Operations vs Management
  const opsVariety = variety.totalVariety + s1.operationalUnits.length * 5
  const mgmtVariety = s3.resourceMechanisms.length * 3 + s5.domainTypes.length + s4.futurePatterns.length * 2
  const ratio1 = mgmtVariety > 0 ? opsVariety / mgmtVariety : 999

  results.push({
    axiom: 1,
    ok: ratio1 <= 3,
    message: ratio1 <= 3
      ? 'Operations/management balanced'
      : `Operations heavy (${ratio1.toFixed(1)}x) - needs more control/types`,
  })

  // Axiom 2: Present vs Future
  const s3Strength = s3.orchestrators.length + s3.resourceMechanisms.length
  const s4Strength = s4.futurePatterns.length + (s4.hasVersioning ? 2 : 0)
  const ratio2 = s4Strength > 0 ? s3Strength / s4Strength : s3Strength

  results.push({
    axiom: 2,
    ok: ratio2 >= 0.3 && ratio2 <= 3,
    message: ratio2 >= 0.3 && ratio2 <= 3
      ? 'Present/future balanced'
      : ratio2 > 3 ? 'Present-focused, future-blind' : 'Future-focused, present-weak',
  })

  // Axiom 3: Identity absorbs residual
  const residual = variety.imbalances.length
  const identityStrength = s5.domainTypes.length + s5.identityFiles.length * 2

  results.push({
    axiom: 3,
    ok: residual === 0 || identityStrength >= residual,
    message: residual === 0
      ? 'No residual variety'
      : identityStrength >= residual
        ? 'Identity absorbs residual'
        : 'Weak identity - variety leaking',
  })

  return results
}
