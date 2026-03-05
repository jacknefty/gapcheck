/**
 * S3 Control Analysis (Inside & Now)
 *
 * System Three = Synoptic view of operations. Optimizes the whole,
 * not just the parts. Allocates resources, sets operational rules.
 *
 * "Responsible for here-and-now day-to-day management"
 *
 * In code:
 * - Configuration management (resource allocation)
 * - Feature flags (operational rules)
 * - Dependency injection (wiring the system)
 * - Entry points that orchestrate S1 units
 *
 * Key question: Is there a synoptic view? Can resources be reallocated?
 */

import type { CodebaseIndex } from '../types'
import type { VarietyProfile } from './variety'

export interface S3Finding {
  type: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  message: string
  files: string[]
}

export interface S3Analysis {
  score: number
  findings: S3Finding[]
  /** Files that provide synoptic/orchestration function */
  orchestrators: string[]
  /** Resource allocation mechanisms found */
  resourceMechanisms: string[]
  /** Is the system tunable at runtime? */
  tunability: 'high' | 'medium' | 'low' | 'none'
}

/**
 * Find orchestrator files (synoptic view of operations)
 */
function findOrchestrators(
  index: CodebaseIndex,
  profiles: Map<string, VarietyProfile>
): string[] {
  const orchestrators: string[] = []

  for (const [path, profile] of profiles) {
    const file = index.files.get(path)!

    // Orchestrators typically:
    // 1. Have high fan-out (coordinate many things)
    // 2. Named main, index, app, server, bootstrap
    // 3. Import many S1 units

    const isEntryPoint = /^(main|index|app|server|bootstrap|start)\.(ts|js)$/.test(
      path.split('/').pop() || ''
    )

    const hasHighFanOut = profile.fanOut > 5
    const importsOperational = file.imports.some(imp =>
      /handler|service|controller|route|feature|module/i.test(imp)
    )

    if (isEntryPoint || (hasHighFanOut && importsOperational)) {
      orchestrators.push(path)
    }
  }

  return orchestrators
}

/**
 * Detect resource allocation mechanisms
 */
function detectResourceMechanisms(index: CodebaseIndex): {
  mechanisms: string[]
  tunability: 'high' | 'medium' | 'low' | 'none'
} {
  const mechanisms: string[] = []
  let hasEnvConfig = false
  let hasFeatureFlags = false
  let hasDI = false
  let hasRuntimeConfig = false

  for (const [path, file] of index.files) {
    const content = file.content

    // Environment configuration
    if (/process\.env|Bun\.env|import\.meta\.env|dotenv/i.test(content)) {
      hasEnvConfig = true
      mechanisms.push(`${path}: Environment config`)
    }

    // Feature flags
    if (/featureFlag|feature_flag|isEnabled|toggles?|unleash|launchdarkly/i.test(content)) {
      hasFeatureFlags = true
      mechanisms.push(`${path}: Feature flags`)
    }

    // Dependency injection
    if (/inject|@Injectable|Container|provide|useValue|tsyringe|inversify|awilix/i.test(content)) {
      hasDI = true
      mechanisms.push(`${path}: Dependency injection`)
    }

    // Runtime configuration
    if (/config.*\.load|loadConfig|ConfigService|getConfig/i.test(content)) {
      hasRuntimeConfig = true
      mechanisms.push(`${path}: Runtime config`)
    }

    // Resource limits / budgets
    if (/rateLimit|throttle|maxConnections|poolSize|timeout|budget/i.test(content)) {
      mechanisms.push(`${path}: Resource limits`)
    }
  }

  // Determine tunability
  let tunability: 'high' | 'medium' | 'low' | 'none'
  if (hasFeatureFlags && hasDI && hasRuntimeConfig) {
    tunability = 'high'
  } else if (hasEnvConfig && (hasFeatureFlags || hasDI)) {
    tunability = 'medium'
  } else if (hasEnvConfig) {
    tunability = 'low'
  } else {
    tunability = 'none'
  }

  return { mechanisms: [...new Set(mechanisms)], tunability }
}

/**
 * Check for hardcoded values that should be configurable
 */
function findHardcodedResources(index: CodebaseIndex): S3Finding[] {
  const findings: S3Finding[] = []

  for (const [path, file] of index.files) {
    const content = file.content

    // Hardcoded URLs (not localhost or example)
    const urlMatches = content.match(/['"]https?:\/\/(?!localhost|127\.0\.0\.1|example)[^'"]+['"]/g)
    if (urlMatches && urlMatches.length > 0) {
      findings.push({
        type: 'Hardcoded-Resource',
        severity: 'LOW',
        message: `${path}: Hardcoded URL - should be configurable`,
        files: [path],
      })
    }

    // Hardcoded credentials (potential)
    if (/password\s*[:=]\s*['"][^'"]+['"]|api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i.test(content)) {
      findings.push({
        type: 'Hardcoded-Secret',
        severity: 'HIGH',
        message: `${path}: Possible hardcoded credentials`,
        files: [path],
      })
    }

    // Magic numbers in resource contexts
    if (/maxRetries\s*[:=]\s*\d+|timeout\s*[:=]\s*\d{4,}|poolSize\s*[:=]\s*\d+/i.test(content)) {
      // Only flag if not in a config file
      if (!/config/i.test(path)) {
        findings.push({
          type: 'Magic-Number',
          severity: 'LOW',
          message: `${path}: Resource limits should be in config`,
          files: [path],
        })
      }
    }
  }

  return findings
}

/**
 * Analyze S3 health
 */
export function analyzeS3(
  index: CodebaseIndex,
  profiles: Map<string, VarietyProfile>
): S3Analysis {
  const findings: S3Finding[] = []
  let score = 10

  const orchestrators = findOrchestrators(index, profiles)
  const { mechanisms, tunability } = detectResourceMechanisms(index)
  const hardcodedFindings = findHardcodedResources(index)

  // Check 1: Is there a synoptic view (orchestrator)?
  if (orchestrators.length === 0) {
    score -= 2
    findings.push({
      type: 'S3-Missing',
      severity: 'MEDIUM',
      message: 'No clear orchestration point - system lacks synoptic view',
      files: [],
    })
  }

  // Check 2: Tunability
  switch (tunability) {
    case 'none':
      score -= 3
      findings.push({
        type: 'No-Tunability',
        severity: 'HIGH',
        message: 'No configuration mechanism - system cannot be tuned',
        files: [],
      })
      break
    case 'low':
      score -= 1
      findings.push({
        type: 'Low-Tunability',
        severity: 'MEDIUM',
        message: 'Only basic env config - limited resource allocation control',
        files: [],
      })
      break
  }

  // Check 3: Hardcoded resources
  for (const finding of hardcodedFindings) {
    if (finding.severity === 'HIGH') score -= 2
    else if (finding.severity === 'MEDIUM') score -= 1
    else score -= 0.5
    findings.push(finding)
  }

  // Check 4: Too many orchestrators (fragmented S3)
  if (orchestrators.length > 3) {
    score -= 1
    findings.push({
      type: 'S3-Fragmented',
      severity: 'LOW',
      message: `${orchestrators.length} potential orchestrators - synoptic view may be scattered`,
      files: orchestrators,
    })
  }

  return {
    score: Math.max(0, Math.min(10, score)),
    findings,
    orchestrators,
    resourceMechanisms: mechanisms,
    tunability,
  }
}
