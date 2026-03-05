/**
 * Tests for analyzer.ts
 */

import { describe, test, expect } from 'bun:test'
import { analyze } from './analyzer'
import type { CodebaseIndex, CodeFile } from './types'
import type { ParsedFile } from './parsers/types'

function createMockFile(overrides: Partial<CodeFile> = {}): CodeFile {
  return {
    path: 'test.ts',
    language: 'typescript',
    imports: [],
    importedBy: [],
    exports: [],
    loc: 10,
    content: '',
    parsed: {
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      types: [],
    } as ParsedFile,
    ...overrides,
  }
}

function createMockIndex(files: Record<string, Partial<CodeFile>> = {}): CodebaseIndex {
  const fileMap = new Map<string, CodeFile>()
  let totalLoc = 0

  for (const [path, partial] of Object.entries(files)) {
    const file = createMockFile({ path, ...partial })
    fileMap.set(path, file)
    totalLoc += file.loc
  }

  return {
    root: '/test',
    files: fileMap,
    totalLoc,
    languages: new Map([['typescript', { files: fileMap.size, loc: totalLoc }]]),
  }
}

describe('analyze', () => {
  test('returns complete Analysis structure', () => {
    const index = createMockIndex({
      'src/index.ts': { content: 'export function main() {}' },
    })

    const result = analyze(index)

    expect(result).toHaveProperty('findings')
    expect(result).toHaveProperty('scores')
    expect(result).toHaveProperty('variety')
    expect(result).toHaveProperty('recursion')
    expect(result).toHaveProperty('s1')
    expect(result).toHaveProperty('s2')
    expect(result).toHaveProperty('s3')
    expect(result).toHaveProperty('s3Star')
    expect(result).toHaveProperty('s4')
    expect(result).toHaveProperty('s5')
    expect(result).toHaveProperty('axioms')
    expect(result).toHaveProperty('posiwid')
    expect(result).toHaveProperty('painSignals')
    expect(result).toHaveProperty('algedonic')
  })

  test('returns valid VSMScores', () => {
    const index = createMockIndex({
      'src/index.ts': { content: 'export function main() {}' },
    })

    const result = analyze(index)

    expect(result.scores.s1Operations).toBeGreaterThanOrEqual(0)
    expect(result.scores.s1Operations).toBeLessThanOrEqual(10)
    expect(result.scores.s2Coordination).toBeGreaterThanOrEqual(0)
    expect(result.scores.s2Coordination).toBeLessThanOrEqual(10)
    expect(result.scores.overall).toBeGreaterThanOrEqual(0)
    expect(result.scores.overall).toBeLessThanOrEqual(100)
  })

  test('findings are sorted by severity', () => {
    const index = createMockIndex({
      'src/index.ts': { content: 'export function main() { console.log("test") }' },
    })

    const result = analyze(index)

    const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 }
    for (let i = 1; i < result.findings.length; i++) {
      const prev = severityOrder[result.findings[i - 1].severity]
      const curr = severityOrder[result.findings[i].severity]
      expect(prev).toBeLessThanOrEqual(curr)
    }
  })

  test('handles empty codebase', () => {
    const index = createMockIndex({})

    const result = analyze(index)

    expect(result.scores).toBeDefined()
    expect(result.findings).toBeDefined()
    expect(result.axioms).toBeDefined()
  })
})

describe('axioms', () => {
  test('returns three axiom results', () => {
    const index = createMockIndex({
      'src/index.ts': { content: 'export function main() {}' },
    })

    const result = analyze(index)

    expect(result.axioms).toHaveLength(3)
    expect(result.axioms[0].axiom).toBe(1)
    expect(result.axioms[1].axiom).toBe(2)
    expect(result.axioms[2].axiom).toBe(3)
  })
})

describe('pain signals', () => {
  test('returns coverage and strength', () => {
    const index = createMockIndex({
      'src/index.ts': { content: 'console.log("test")' },
    })

    const result = analyze(index)

    expect(result.painSignals.coverage).toBeGreaterThanOrEqual(0)
    expect(result.painSignals.coverage).toBeLessThanOrEqual(1)
    expect(['strong', 'weak', 'absent']).toContain(result.painSignals.strength)
  })
})

describe('posiwid', () => {
  test('returns test coverage info', () => {
    const index = createMockIndex({
      'src/complex.ts': { content: 'export function f() { if(x){if(y){if(z){}}} }' },
    })

    const result = analyze(index)

    expect(result.posiwid.untestedComplexFunctions).toBeGreaterThanOrEqual(0)
    expect(result.posiwid.testCoverage).toBeGreaterThanOrEqual(0)
  })
})

describe('variety', () => {
  test('calculates variety profiles', () => {
    const index = createMockIndex({
      'a.ts': { imports: ['b.ts'], exports: ['x'] },
      'b.ts': { imports: [], exports: ['y'], importedBy: ['a.ts'] },
    })

    const result = analyze(index)

    expect(result.variety.profiles.size).toBe(2)
  })
})

describe('recursion', () => {
  test('detects subsystems', () => {
    const index = createMockIndex({
      'src/module/a.ts': { imports: ['src/module/b.ts'] },
      'src/module/b.ts': { imports: [], importedBy: ['src/module/a.ts'] },
    })

    const result = analyze(index)

    expect(result.recursion).toBeDefined()
    expect(result.recursion.viableSubsystems).toBeDefined()
  })
})
