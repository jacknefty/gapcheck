/**
 * POSIWID - Does the system do what it claims?
 *
 * Count untested complex functions. That's it.
 */

import type { CodebaseIndex } from '../types'

export interface POSIWIDAnalysis {
  untestedComplexFunctions: number
  testCoverage: number
  findings: { file: string; function: string; complexity: number }[]
}

export function analyzePOSIWID(index: CodebaseIndex): POSIWIDAnalysis {
  const testFiles = new Set<string>()
  const testedFunctions = new Set<string>()

  // Find test files and extract what they test
  for (const [path, file] of index.files) {
    if (/\.(test|spec)\.|__tests__|_test\./i.test(path)) {
      testFiles.add(path)
      // Extract test names
      const testMatches = file.content.match(/(?:it|test|describe)\s*\(\s*['"`]([^'"`]+)['"`]/g) || []
      for (const m of testMatches) {
        const name = m.match(/['"`]([^'"`]+)['"`]/)?.[1]?.toLowerCase().replace(/[^a-z0-9]/g, '')
        if (name) testedFunctions.add(name)
      }
    }
  }

  const findings: POSIWIDAnalysis['findings'] = []
  let totalFunctions = 0

  // Find untested complex functions
  for (const [path, file] of index.files) {
    if (testFiles.has(path) || /\.d\.ts$/.test(path)) continue

    const content = file.content

    // Extract functions
    const funcMatches = content.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?\(/g) || []

    for (const match of funcMatches) {
      const name = match.match(/(?:function|const)\s+(\w+)/)?.[1]
      if (!name || name.startsWith('_')) continue

      totalFunctions++

      // Count complexity
      const funcStart = content.indexOf(match)
      const funcEnd = Math.min(funcStart + 500, content.length) // Approximate function body
      const funcBody = content.slice(funcStart, funcEnd)
      const complexity = (funcBody.match(/\bif\b|\bfor\b|\bwhile\b|\bswitch\b|\bcatch\b|\?\?|\?:/g) || []).length

      // Check if tested
      const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '')
      const isTested = Array.from(testedFunctions).some(t => t.includes(normalized) || normalized.includes(t))

      if (!isTested && complexity > 3) {
        findings.push({ file: path, function: name, complexity })
      }
    }
  }

  return {
    untestedComplexFunctions: findings.length,
    testCoverage: totalFunctions > 0 ? 1 - (findings.length / totalFunctions) : 1,
    findings: findings.slice(0, 10), // Top 10 only
  }
}
