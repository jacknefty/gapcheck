/**
 * Recursion Analysis
 *
 * "If a viable system contains a viable system, then the
 * organizational structure must be recursive." - Beer
 *
 * This module identifies:
 * - Potential viable sub-systems (directories that could be hived off)
 * - Recursion levels in the codebase
 * - Whether sub-systems have proper autonomy or are too coupled
 */

import type { CodebaseIndex, CodeFile } from '../scanner'
import type { VarietyProfile } from './variety'

export interface RecursionLevel {
  path: string
  depth: number
  files: string[]
  /** Internal connections (within this level) */
  internalEdges: number
  /** External connections (crossing this boundary) */
  externalEdges: number
  /** Cohesion = internal / (internal + external). Higher = more viable */
  cohesion: number
  /** Can this be hived off? */
  viable: boolean
  /** Why or why not */
  viabilityReason: string
}

export interface RecursionAnalysis {
  levels: RecursionLevel[]
  maxDepth: number
  /** Directories that could be independent packages */
  viableSubsystems: string[]
  /** Directories too coupled to separate */
  coupledSubsystems: string[]
}

/**
 * Extract directory structure from file paths
 */
function getDirectories(index: CodebaseIndex): Map<string, string[]> {
  const dirs = new Map<string, string[]>()

  for (const path of index.files.keys()) {
    const parts = path.split('/')
    // Build all ancestor directories
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join('/')
      if (!dirs.has(dir)) {
        dirs.set(dir, [])
      }
      dirs.get(dir)!.push(path)
    }
  }

  return dirs
}

/**
 * Count edges within and across a directory boundary
 */
function countEdges(
  dirPath: string,
  files: string[],
  index: CodebaseIndex
): { internal: number; external: number } {
  const fileSet = new Set(files)
  let internal = 0
  let external = 0

  for (const filePath of files) {
    const file = index.files.get(filePath)
    if (!file) continue

    for (const imp of file.imports) {
      // Resolve import to actual file
      const resolved = resolveImport(imp, index)
      if (!resolved) continue

      if (fileSet.has(resolved)) {
        internal++
      } else {
        external++
      }
    }
  }

  return { internal, external }
}

function resolveImport(imp: string, index: CodebaseIndex): string | null {
  if (index.files.has(imp)) return imp
  for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
    if (index.files.has(imp + ext)) return imp + ext
    if (index.files.has(`${imp}/index${ext}`)) return `${imp}/index${ext}`
  }
  return null
}

/**
 * Analyze a directory as a potential viable system
 */
function analyzeRecursionLevel(
  dirPath: string,
  files: string[],
  index: CodebaseIndex
): RecursionLevel {
  const depth = dirPath.split('/').length
  const { internal, external } = countEdges(dirPath, files, index)

  const total = internal + external
  const cohesion = total === 0 ? 0 : internal / total

  // A viable system should have:
  // 1. High cohesion (>0.5 - more internal than external connections)
  // 2. At least some internal structure (>1 file)
  // 3. Clear boundary (some but not too many external connections)

  let viable = false
  let viabilityReason = ''

  if (files.length < 2) {
    viabilityReason = 'Too small - single file is not a system'
  } else if (cohesion < 0.3) {
    viabilityReason = `Low cohesion (${(cohesion * 100).toFixed(0)}%) - too dependent on external modules`
  } else if (external === 0 && internal === 0) {
    viabilityReason = 'No connections - isolated island'
  } else if (cohesion >= 0.5) {
    viable = true
    viabilityReason = `High cohesion (${(cohesion * 100).toFixed(0)}%) - could be independent package`
  } else {
    viabilityReason = `Moderate cohesion (${(cohesion * 100).toFixed(0)}%) - partial autonomy`
  }

  return {
    path: dirPath,
    depth,
    files,
    internalEdges: internal,
    externalEdges: external,
    cohesion,
    viable,
    viabilityReason,
  }
}

/**
 * Run complete recursion analysis
 */
export function analyzeRecursion(index: CodebaseIndex): RecursionAnalysis {
  const directories = getDirectories(index)
  const levels: RecursionLevel[] = []

  for (const [dirPath, files] of directories) {
    // Skip root and very shallow directories
    if (dirPath === '' || files.length < 2) continue

    const level = analyzeRecursionLevel(dirPath, files, index)
    levels.push(level)
  }

  // Sort by depth then cohesion
  levels.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth
    return b.cohesion - a.cohesion
  })

  const maxDepth = Math.max(...levels.map(l => l.depth), 0)
  const viableSubsystems = levels.filter(l => l.viable).map(l => l.path)
  const coupledSubsystems = levels
    .filter(l => !l.viable && l.cohesion < 0.3 && l.files.length > 2)
    .map(l => l.path)

  return {
    levels,
    maxDepth,
    viableSubsystems,
    coupledSubsystems,
  }
}
