/**
 * S3* Audit - Observability check
 *
 * Can you see what's happening at runtime?
 * - Logging present?
 * - Error tracking present?
 * - Monitoring present?
 */

import type { CodebaseIndex } from '../types'

export interface S3StarAnalysis {
  score: number
  findings: { type: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; message: string; files: string[] }[]
  hasLogging: boolean
  hasErrorTracking: boolean
  hasMonitoring: boolean
}

export function analyzeS3Star(index: CodebaseIndex): S3StarAnalysis {
  const findings: S3StarAnalysis['findings'] = []
  let score = 10

  // Check for logging
  const loggingPatterns = /console\.(log|warn|error|info)|logger\.|log\.(info|warn|error|debug)|pino|winston|bunyan/i
  const hasLogging = Array.from(index.files.values()).some(f => loggingPatterns.test(f.content))

  // Check for error tracking
  const errorPatterns = /sentry|bugsnag|rollbar|errorTracking|captureException/i
  const hasErrorTracking = Array.from(index.files.values()).some(f => errorPatterns.test(f.content))

  // Check for monitoring
  const monitoringPatterns = /prometheus|metrics|statsd|datadog|newrelic|opentelemetry/i
  const hasMonitoring = Array.from(index.files.values()).some(f => monitoringPatterns.test(f.content))

  if (!hasLogging) {
    score -= 4
    findings.push({
      type: 'No-Logging',
      severity: 'HIGH',
      message: 'No logging detected - blind at runtime',
      files: [],
    })
  }

  if (!hasErrorTracking && index.files.size > 10) {
    score -= 2
    findings.push({
      type: 'No-Error-Tracking',
      severity: 'MEDIUM',
      message: 'No error tracking service detected',
      files: [],
    })
  }

  if (!hasMonitoring && index.files.size > 20) {
    score -= 1
    findings.push({
      type: 'No-Monitoring',
      severity: 'LOW',
      message: 'No metrics/monitoring detected',
      files: [],
    })
  }

  return {
    score: Math.max(0, score),
    findings,
    hasLogging,
    hasErrorTracking,
    hasMonitoring,
  }
}

/** Simple pain signal coverage - what % of files have error handling */
export function checkPainSignals(index: CodebaseIndex): { coverage: number; strength: 'strong' | 'weak' | 'absent' } {
  const errorHandling = /try\s*\{|\.catch\(|except:|recover\(\)|\.unwrap_or/
  const filesWithHandling = Array.from(index.files.values()).filter(f => errorHandling.test(f.content)).length
  const coverage = index.files.size > 0 ? filesWithHandling / index.files.size : 0

  return {
    coverage,
    strength: coverage > 0.5 ? 'strong' : coverage > 0.2 ? 'weak' : 'absent',
  }
}
