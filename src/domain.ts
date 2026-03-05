/**
 * Domain - Core concepts for viability diagnosis
 */

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW'

/** The five VSM systems */
export type VSMSystem = 'S1' | 'S2' | 'S3' | 'S3*' | 'S4' | 'S5'

/** Clamp score to 0-10 */
export function clampScore(value: number): number {
  return Math.max(0, Math.min(10, value))
}

/** Clamp percentage to 0-100 */
export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

/** Score to severity */
export function scoreSeverity(score: number): Severity {
  if (score >= 8) return 'LOW'
  if (score >= 5) return 'MEDIUM'
  return 'HIGH'
}
