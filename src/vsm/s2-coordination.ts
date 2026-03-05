/**
 * S2 Coordination Analysis
 *
 * System Two = Anti-oscillation. Prevents S1 units from
 * fighting each other and wasting energy.
 *
 * "The sickness of the homeostat is OSCILLATION.
 *  The cure for the sickness is: OSCILLATION must be DAMPED."
 *
 * In code: Event systems, message queues, shared schedulers,
 * locks, semaphores, coordination protocols.
 *
 * S2 does NOT command - it coordinates. It's accepted as
 * authoritative without exercising authority.
 *
 * Key question: What prevents modules from stepping on each other?
 */

import type { CodebaseIndex } from '../types'
import type { VarietyProfile } from './variety'

export interface S2Finding {
  type: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  message: string
  files: string[]
}

export interface S2Analysis {
  score: number
  findings: S2Finding[]
  /** Detected coordination mechanisms */
  coordinationMechanisms: string[]
  /** Circular dependencies (oscillation risk) */
  circularDeps: string[][]
  /** Modules that SHOULD coordinate but don't */
  missingCoordination: Array<{ a: string; b: string; reason: string }>
}

/**
 * Find circular dependencies (direct oscillation risk)
 */
export function findCircularDependencies(index: CodebaseIndex): string[][] {
  const cycles: string[][] = []
  const visited = new Set<string>()
  const recursionStack = new Set<string>()

  function resolveImport(imp: string): string | null {
    if (index.files.has(imp)) return imp
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      if (index.files.has(imp + ext)) return imp + ext
      if (index.files.has(`${imp}/index${ext}`)) return `${imp}/index${ext}`
    }
    return null
  }

  function dfs(path: string, stack: string[]): void {
    if (recursionStack.has(path)) {
      const cycleStart = stack.indexOf(path)
      if (cycleStart !== -1) {
        const cycle = [...stack.slice(cycleStart), path]
        const normalized = normalizeCycle(cycle)
        if (!cycles.some(c => normalizeCycle(c) === normalized)) {
          cycles.push(cycle)
        }
      }
      return
    }

    if (visited.has(path)) return

    visited.add(path)
    recursionStack.add(path)

    const file = index.files.get(path)
    if (file) {
      for (const imp of file.imports) {
        const resolved = resolveImport(imp)
        if (resolved) {
          dfs(resolved, [...stack, path])
        }
      }
    }

    recursionStack.delete(path)
  }

  for (const path of index.files.keys()) {
    visited.clear()
    recursionStack.clear()
    dfs(path, [])
  }

  return cycles
}

function normalizeCycle(cycle: string[]): string {
  const minIdx = cycle.indexOf(cycle.slice().sort()[0])
  const rotated = [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)]
  return rotated.join(' -> ')
}

/**
 * Detect coordination mechanisms in the codebase
 */
function detectCoordinationMechanisms(index: CodebaseIndex): string[] {
  const mechanisms: string[] = []

  for (const [path, file] of index.files) {
    const content = file.content

    // Event emitters / pub-sub
    if (/EventEmitter|\.on\(|\.emit\(|addEventListener|pubsub|subscribe|publish/i.test(content)) {
      mechanisms.push(`${path}: Event system`)
    }

    // Message queues
    if (/queue|rabbitmq|kafka|redis.*pub|bull|bee-queue/i.test(content)) {
      mechanisms.push(`${path}: Message queue`)
    }

    // Locks / semaphores
    if (/mutex|semaphore|lock\(|unlock\(|synchronized/i.test(content)) {
      mechanisms.push(`${path}: Locking mechanism`)
    }

    // State management (central coordination)
    if (/redux|zustand|mobx|recoil|jotai|createStore|useStore/i.test(content)) {
      mechanisms.push(`${path}: State management`)
    }

    // Scheduler patterns
    if (/cron|scheduler|setInterval|setTimeout.*recursive|agenda/i.test(content)) {
      mechanisms.push(`${path}: Scheduler`)
    }
  }

  return [...new Set(mechanisms)]
}

/**
 * Find modules that share resources but lack coordination
 */
function findMissingCoordination(
  index: CodebaseIndex,
  profiles: Map<string, VarietyProfile>
): Array<{ a: string; b: string; reason: string }> {
  const missing: Array<{ a: string; b: string; reason: string }> = []

  // Find modules that import the same "shared" resources
  const sharedResources = new Map<string, string[]>()

  for (const [path, file] of index.files) {
    for (const imp of file.imports) {
      // Track who imports shared/common resources
      if (/shared|common|state|store|db|database|cache/i.test(imp)) {
        if (!sharedResources.has(imp)) {
          sharedResources.set(imp, [])
        }
        sharedResources.get(imp)!.push(path)
      }
    }
  }

  // If multiple modules share a resource but don't coordinate...
  for (const [resource, consumers] of sharedResources) {
    if (consumers.length > 2) {
      // Check if consumers have any coordination between them
      const consumerSet = new Set(consumers)
      let hasCoordination = false

      for (const consumer of consumers) {
        const file = index.files.get(consumer)
        if (file) {
          // Do they import each other or a coordinator?
          for (const imp of file.imports) {
            const resolved = resolveImportPath(imp, index)
            if (resolved && consumerSet.has(resolved)) {
              hasCoordination = true
              break
            }
          }
        }
        if (hasCoordination) break
      }

      if (!hasCoordination && consumers.length <= 5) {
        missing.push({
          a: consumers[0],
          b: consumers[1],
          reason: `Both access ${resource} but no coordination detected`,
        })
      }
    }
  }

  return missing
}

function resolveImportPath(imp: string, index: CodebaseIndex): string | null {
  if (index.files.has(imp)) return imp
  for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
    if (index.files.has(imp + ext)) return imp + ext
  }
  return null
}

/**
 * Analyze S2 health
 */
export function analyzeS2(
  index: CodebaseIndex,
  profiles: Map<string, VarietyProfile>
): S2Analysis {
  const findings: S2Finding[] = []
  let score = 10

  const circularDeps = findCircularDependencies(index)
  const coordinationMechanisms = detectCoordinationMechanisms(index)
  const missingCoordination = findMissingCoordination(index, profiles)

  // Check 1: Circular dependencies = oscillation
  for (const cycle of circularDeps) {
    score -= 2
    findings.push({
      type: 'Oscillation',
      severity: 'HIGH',
      message: `Circular dependency: ${cycle.join(' -> ')}`,
      files: cycle.slice(0, -1),
    })
  }

  // Check 2: Do we have ANY coordination mechanism?
  if (coordinationMechanisms.length === 0 && index.files.size > 5) {
    score -= 2
    findings.push({
      type: 'S2-Missing',
      severity: 'MEDIUM',
      message: 'No coordination mechanisms detected (events, queues, state management)',
      files: [],
    })
  }

  // Check 3: Shared mutable state without coordination
  for (const [path, file] of index.files) {
    const exportsMutable = /export\s+(?:let|var)\s+\w+/.test(file.content)
    if (exportsMutable) {
      score -= 1
      findings.push({
        type: 'Uncoordinated-State',
        severity: 'MEDIUM',
        message: `${path} exports mutable state - oscillation risk without coordination`,
        files: [path],
      })
    }
  }

  // Check 4: Missing coordination between coupled modules
  for (const missing of missingCoordination.slice(0, 3)) {
    score -= 0.5
    findings.push({
      type: 'Missing-Coordination',
      severity: 'LOW',
      message: `${missing.a} and ${missing.b}: ${missing.reason}`,
      files: [missing.a, missing.b],
    })
  }

  return {
    score: Math.max(0, Math.min(10, score)),
    findings,
    coordinationMechanisms,
    circularDeps,
    missingCoordination,
  }
}
