/**
 * Variety Engineering
 *
 * "Only variety can destroy variety" - Ashby
 *
 * This module calculates variety flows through the codebase:
 * - How much variety each module consumes (imports)
 * - How much variety each module produces (exports)
 * - Whether modules are amplifiers or attenuators
 * - Where variety is being crushed or overwhelming channels
 */

import type { CodebaseIndex, CodeFile } from '../types'

export interface VarietyProfile {
  path: string
  /** Variety consumed - unique imports */
  consumed: number
  /** Variety produced - unique exports */
  produced: number
  /** Ratio: produced/consumed. >1 = amplifier, <1 = attenuator */
  ratio: number
  /** Fan-in: how many modules depend on this one */
  fanIn: number
  /** Fan-out: how many modules this depends on */
  fanOut: number
  /** Role inference based on variety profile */
  role: 'amplifier' | 'attenuator' | 'transducer' | 'isolate'
}

export interface VarietyImbalance {
  type: 'crush' | 'overflow' | 'bottleneck' | 'island'
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  message: string
  files: string[]
}

export interface VarietyAnalysis {
  profiles: Map<string, VarietyProfile>
  imbalances: VarietyImbalance[]
  /** Total variety in system */
  totalVariety: number
  /** Variety concentration (Gini-like coefficient) */
  concentration: number
}

/**
 * Calculate variety profile for each file
 */
export function calculateVarietyProfiles(index: CodebaseIndex): Map<string, VarietyProfile> {
  const profiles = new Map<string, VarietyProfile>()

  for (const [path, file] of index.files) {
    const consumed = file.imports.length
    const produced = file.exports.length
    const fanIn = file.importedBy.length
    const fanOut = file.imports.length

    // Avoid division by zero
    const ratio = consumed === 0 ? (produced > 0 ? Infinity : 1) : produced / consumed

    // Determine role based on variety flow
    let role: VarietyProfile['role']
    if (fanIn === 0 && fanOut === 0) {
      role = 'isolate'
    } else if (ratio > 1.5) {
      role = 'amplifier'  // Produces more variety than it consumes
    } else if (ratio < 0.5) {
      role = 'attenuator' // Consumes more variety than it produces
    } else {
      role = 'transducer' // Roughly balanced - transforms variety
    }

    profiles.set(path, {
      path,
      consumed,
      produced,
      ratio,
      fanIn,
      fanOut,
      role,
    })
  }

  return profiles
}

/**
 * Check if a file is primarily type definitions (shared language, not a bottleneck)
 */
function isTypeDefinitionFile(path: string, content: string): boolean {
  // Explicit type files
  if (/\btypes?\.(ts|d\.ts)$/.test(path)) return true
  if (/\/(types|interfaces|models|schemas)\//.test(path)) return true

  // Check content: mostly type exports, minimal runtime code
  const typeExports = (content.match(/export\s+(type|interface|enum)\s+/g) || []).length
  const runtimeExports = (content.match(/export\s+(function|const|let|var|class|async)\s+/g) || []).length

  // If >70% of exports are types, it's a type definition file
  const total = typeExports + runtimeExports
  return total > 0 && typeExports / total > 0.7
}

/**
 * Detect variety imbalances - where Ashby's Law is violated
 */
export function detectVarietyImbalances(
  index: CodebaseIndex,
  profiles: Map<string, VarietyProfile>
): VarietyImbalance[] {
  const imbalances: VarietyImbalance[] = []

  for (const [path, profile] of profiles) {
    const file = index.files.get(path)!

    // VARIETY CRUSH: High fan-in with low exports
    // This module is a bottleneck - many depend on it but it exposes little
    if (profile.fanIn > 5 && profile.produced < 3) {
      imbalances.push({
        type: 'crush',
        severity: 'HIGH',
        message: `${path}: ${profile.fanIn} modules depend on only ${profile.produced} exports - variety crush`,
        files: [path],
      })
    }

    // VARIETY OVERFLOW: Module produces massive variety with few consumers
    // This variety is being generated but not absorbed
    if (profile.produced > 15 && profile.fanIn < 2) {
      imbalances.push({
        type: 'overflow',
        severity: 'MEDIUM',
        message: `${path}: produces ${profile.produced} exports but only ${profile.fanIn} consumers - unabsorbed variety`,
        files: [path],
      })
    }

    // BOTTLENECK: Extreme fan-in (everything flows through here)
    // Single point of failure, variety concentration
    // Exception: Type definition files are intentional variety attenuators (shared language)
    if (profile.fanIn > 10 && !isTypeDefinitionFile(path, file.content)) {
      imbalances.push({
        type: 'bottleneck',
        severity: 'HIGH',
        message: `${path}: ${profile.fanIn} dependents - dangerous variety concentration`,
        files: [path, ...file.importedBy.slice(0, 5)],
      })
    }

    // ISLAND: No connections at all
    if (profile.fanIn === 0 && profile.fanOut === 0 && profile.produced > 0) {
      imbalances.push({
        type: 'island',
        severity: 'LOW',
        message: `${path}: exports ${profile.produced} symbols but has no connections - dead code?`,
        files: [path],
      })
    }
  }

  return imbalances
}

/**
 * Calculate variety concentration (how evenly distributed is variety?)
 * Returns 0-1 where 0 = perfectly distributed, 1 = all in one place
 */
export function calculateConcentration(profiles: Map<string, VarietyProfile>): number {
  const fanIns = Array.from(profiles.values()).map(p => p.fanIn).sort((a, b) => a - b)
  const n = fanIns.length
  if (n === 0) return 0

  const total = fanIns.reduce((a, b) => a + b, 0)
  if (total === 0) return 0

  // Gini coefficient calculation
  let sumOfDifferences = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumOfDifferences += Math.abs(fanIns[i] - fanIns[j])
    }
  }

  return sumOfDifferences / (2 * n * total)
}

/**
 * Run complete variety analysis
 */
export function analyzeVariety(index: CodebaseIndex): VarietyAnalysis {
  const profiles = calculateVarietyProfiles(index)
  const imbalances = detectVarietyImbalances(index, profiles)

  const totalVariety = Array.from(profiles.values())
    .reduce((sum, p) => sum + p.produced, 0)

  const concentration = calculateConcentration(profiles)

  return {
    profiles,
    imbalances,
    totalVariety,
    concentration,
  }
}
