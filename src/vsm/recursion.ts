/**
 * Recursion - Viable subsystem detection
 *
 * Which directories could be hived off as independent units?
 * High internal cohesion + low external coupling = viable subsystem
 */

import type { CodebaseIndex } from '../types'

export interface RecursionAnalysis {
  viableSubsystems: string[]
  coupledSubsystems: string[]
  maxDepth: number
}

export function analyzeRecursion(index: CodebaseIndex): RecursionAnalysis {
  const dirStats = new Map<string, { files: number; internal: number; external: number }>()

  // Collect files by directory
  for (const [path, file] of index.files) {
    const parts = path.split('/')
    if (parts.length < 2) continue

    const dir = parts.slice(0, -1).join('/')
    const stats = dirStats.get(dir) || { files: 0, internal: 0, external: 0 }
    stats.files++

    // Count internal vs external imports
    for (const imp of file.imports) {
      if (!imp.isLocal) continue
      const importPath = imp.source.replace(/^\.\//, '')
      if (path.includes(dir) && importPath.startsWith(dir.split('/').pop() || '')) {
        stats.internal++
      } else {
        stats.external++
      }
    }
    dirStats.set(dir, stats)
  }

  const viableSubsystems: string[] = []
  const coupledSubsystems: string[] = []
  let maxDepth = 0

  for (const [dir, stats] of dirStats) {
    if (stats.files < 2) continue

    const depth = dir.split('/').length
    maxDepth = Math.max(maxDepth, depth)

    const total = stats.internal + stats.external
    const cohesion = total > 0 ? stats.internal / total : 0.5

    if (cohesion >= 0.5) {
      viableSubsystems.push(dir)
    } else if (cohesion < 0.3) {
      coupledSubsystems.push(dir)
    }
  }

  return { viableSubsystems, coupledSubsystems, maxDepth }
}
