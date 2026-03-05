/**
 * S3* Audit Analysis
 *
 * System Three-Star = The audit channel. Sporadic, high-variety
 * interventions that bypass routine reporting.
 *
 * "The audit channel CLOSES THE GAP. Whatever variety isn't
 * absorbed by the other five channels must be handled by
 * S3* audit. This is why audit is necessary, not optional."
 *
 * In code:
 * - Logging (runtime audit trail)
 * - Error tracking (pain signal capture)
 * - Monitoring/metrics (system state observation)
 * - Health checks (sporadic probes)
 *
 * Key question: Can you see what's actually happening at runtime?
 */

import type { CodebaseIndex } from '../types'

export interface S3StarFinding {
  type: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  message: string
  files: string[]
}

export interface S3StarAnalysis {
  score: number
  findings: S3StarFinding[]
  /** Logging mechanisms found */
  loggingMechanisms: string[]
  /** Error tracking found */
  errorTracking: string[]
  /** Monitoring found */
  monitoring: string[]
  /** Algedonic channels (pain signals) */
  algedonicChannels: string[]
  /** Files with silent failures */
  silentFailures: string[]
}

/**
 * Detect logging mechanisms
 */
function detectLogging(index: CodebaseIndex): string[] {
  const logging: string[] = []

  for (const [path, file] of index.files) {
    const content = file.content

    // Structured logging libraries
    if (/pino|winston|bunyan|log4js|loglevel/i.test(content)) {
      logging.push(`${path}: Structured logging library`)
    }
    // Console logging (basic)
    else if (/console\.(log|info|warn|error|debug)\s*\(/g.test(content)) {
      logging.push(`${path}: Console logging`)
    }
    // Custom logger
    else if (/logger\.(log|info|warn|error|debug)\s*\(/i.test(content)) {
      logging.push(`${path}: Custom logger`)
    }
  }

  return [...new Set(logging)]
}

/**
 * Detect error tracking / pain signal capture
 */
function detectErrorTracking(index: CodebaseIndex): string[] {
  const tracking: string[] = []

  for (const [path, file] of index.files) {
    const content = file.content

    // Error tracking services
    if (/sentry/i.test(content)) {
      tracking.push(`${path}: Sentry`)
    }
    if (/bugsnag/i.test(content)) {
      tracking.push(`${path}: Bugsnag`)
    }
    if (/rollbar/i.test(content)) {
      tracking.push(`${path}: Rollbar`)
    }
    if (/airbrake/i.test(content)) {
      tracking.push(`${path}: Airbrake`)
    }

    // Error boundary patterns (React)
    if (/ErrorBoundary|componentDidCatch|getDerivedStateFromError/i.test(content)) {
      tracking.push(`${path}: Error boundary`)
    }

    // Global error handlers
    if (/process\.on\s*\(\s*['"]uncaughtException|unhandledRejection/i.test(content)) {
      tracking.push(`${path}: Global error handler`)
    }
  }

  return [...new Set(tracking)]
}

/**
 * Detect monitoring / metrics
 */
function detectMonitoring(index: CodebaseIndex): string[] {
  const monitoring: string[] = []

  for (const [path, file] of index.files) {
    const content = file.content

    // APM tools
    if (/datadog|newrelic|dynatrace|appdynamics/i.test(content)) {
      monitoring.push(`${path}: APM`)
    }

    // Metrics libraries
    if (/prometheus|prom-client|statsd|metrics/i.test(content)) {
      monitoring.push(`${path}: Metrics`)
    }

    // Health checks
    if (/health.*check|healthcheck|\/health|readiness|liveness/i.test(content)) {
      monitoring.push(`${path}: Health check`)
    }

    // Tracing
    if (/opentelemetry|jaeger|zipkin|trace/i.test(content)) {
      monitoring.push(`${path}: Distributed tracing`)
    }
  }

  return [...new Set(monitoring)]
}

/**
 * Find algedonic channels (emergency pain signals)
 */
function findAlgedonicChannels(index: CodebaseIndex): string[] {
  const channels: string[] = []

  for (const [path, file] of index.files) {
    const content = file.content

    // Alert mechanisms
    if (/alert|pagerduty|opsgenie|slack.*webhook|notify/i.test(content)) {
      channels.push(`${path}: Alerting`)
    }

    // Circuit breakers (automatic pain response)
    if (/circuitBreaker|circuit-breaker|opossum|cockatiel/i.test(content)) {
      channels.push(`${path}: Circuit breaker`)
    }

    // Graceful shutdown (system listening to termination signals)
    if (/SIGTERM|SIGINT|graceful.*shutdown/i.test(content)) {
      channels.push(`${path}: Graceful shutdown`)
    }
  }

  return [...new Set(channels)]
}

/**
 * Find silent failures (blocked pain signals)
 */
function findSilentFailures(index: CodebaseIndex): S3StarFinding[] {
  const findings: S3StarFinding[] = []

  for (const [path, file] of index.files) {
    const content = file.content

    // Find catch blocks
    const catchPattern = /catch\s*\(\s*(\w+)?\s*\)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g
    let match

    while ((match = catchPattern.exec(content)) !== null) {
      const catchBody = match[2]

      // Check if catch block does something meaningful
      const hasLogging = /console\.|log|logger|report|track|throw|rethrow/i.test(catchBody)
      const hasRethrow = /throw\s/i.test(catchBody)
      const isEmpty = catchBody.trim().length < 10

      if (!hasLogging && !hasRethrow) {
        // Find line number
        const beforeMatch = content.substring(0, match.index)
        const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1

        findings.push({
          type: 'Silent-Failure',
          severity: isEmpty ? 'HIGH' : 'MEDIUM',
          message: `${path}:${lineNumber} - catch block ${isEmpty ? 'is empty' : 'swallows error without logging'}`,
          files: [path],
        })
      }
    }

    // Promise without catch
    const promiseNoCatch = /\.then\s*\([^)]+\)\s*(?!\.catch|\.finally)/g
    if (promiseNoCatch.test(content) && !/async|await/.test(content)) {
      findings.push({
        type: 'Unhandled-Promise',
        severity: 'LOW',
        message: `${path}: Promise chain without .catch()`,
        files: [path],
      })
    }
  }

  return findings
}

/**
 * Analyze S3* health
 */
export function analyzeS3Star(index: CodebaseIndex): S3StarAnalysis {
  const findings: S3StarFinding[] = []
  let score = 10

  const loggingMechanisms = detectLogging(index)
  const errorTracking = detectErrorTracking(index)
  const monitoring = detectMonitoring(index)
  const algedonicChannels = findAlgedonicChannels(index)
  const silentFailureFindings = findSilentFailures(index)

  // Check 1: Is there ANY logging?
  if (loggingMechanisms.length === 0) {
    score -= 3
    findings.push({
      type: 'No-Logging',
      severity: 'HIGH',
      message: 'No logging detected - system is blind to runtime behavior',
      files: [],
    })
  } else {
    // Check for structured vs console logging
    const hasStructured = loggingMechanisms.some(m => /library/i.test(m))
    if (!hasStructured && loggingMechanisms.length > 0) {
      score -= 1
      findings.push({
        type: 'Unstructured-Logging',
        severity: 'LOW',
        message: 'Only console.log - consider structured logging for production',
        files: [],
      })
    }
  }

  // Check 2: Error tracking
  if (errorTracking.length === 0) {
    score -= 2
    findings.push({
      type: 'No-Error-Tracking',
      severity: 'MEDIUM',
      message: 'No error tracking service - errors may go unnoticed in production',
      files: [],
    })
  }

  // Check 3: Monitoring
  if (monitoring.length === 0 && index.files.size > 10) {
    score -= 1
    findings.push({
      type: 'No-Monitoring',
      severity: 'MEDIUM',
      message: 'No monitoring/metrics - limited visibility into system health',
      files: [],
    })
  }

  // Check 4: Algedonic channels
  if (algedonicChannels.length === 0 && index.files.size > 10) {
    score -= 1
    findings.push({
      type: 'No-Algedonic',
      severity: 'LOW',
      message: 'No alerting or circuit breakers - pain signals may not get through',
      files: [],
    })
  }

  // Check 5: Silent failures
  const silentFailures: string[] = []
  for (const finding of silentFailureFindings) {
    if (finding.severity === 'HIGH') score -= 1
    else if (finding.severity === 'MEDIUM') score -= 0.5
    findings.push(finding)
    silentFailures.push(...finding.files)
  }

  return {
    score: Math.max(0, Math.min(10, score)),
    findings,
    loggingMechanisms,
    errorTracking,
    monitoring,
    algedonicChannels,
    silentFailures: [...new Set(silentFailures)],
  }
}
