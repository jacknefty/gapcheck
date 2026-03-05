/**
 * Tests for posiwid.ts
 */

import { describe, test, expect } from 'bun:test'
import { analyzePOSIWID } from './posiwid'
import type { CodebaseIndex, CodeFile } from '../types'
import type { ParsedFile } from '../parsers/types'

function createMockFile(overrides: Partial<CodeFile> = {}): CodeFile {
  return {
    path: 'test.ts',
    language: 'typescript',
    imports: [],
    importedBy: [],
    exports: [],
    loc: 10,
    content: '',
    parsed: {} as ParsedFile,
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

describe('analyzePOSIWID', () => {
  test('returns POSIWID analysis structure', () => {
    const index = createMockIndex({
      'src/app.ts': { content: 'export function main() {}' },
    })

    const result = analyzePOSIWID(index)

    expect(result).toHaveProperty('findings')
    expect(result).toHaveProperty('testCoverage')
    expect(result).toHaveProperty('untestedComplexFunctions')
    expect(Array.isArray(result.findings)).toBe(true)
  })

  test('identifies untested complex functions', () => {
    const index = createMockIndex({
      'src/complex.ts': {
        content: `
          export function complexFunction(x: number) {
            if (x > 0) {
              if (x > 10) {
                if (x > 100) {
                  if (x > 1000) {
                    return 'big'
                  }
                  return x * 2
                }
                return x + 1
              }
            }
            return 0
          }
        `,
      },
    })

    const result = analyzePOSIWID(index)

    expect(result.untestedComplexFunctions).toBeGreaterThan(0)
  })

  test('does not flag simple functions', () => {
    const index = createMockIndex({
      'src/simple.ts': {
        content: 'export function add(a: number, b: number) { return a + b }',
      },
    })

    const result = analyzePOSIWID(index)

    expect(result.untestedComplexFunctions).toBe(0)
  })

  test('recognizes test files', () => {
    const index = createMockIndex({
      'src/app.ts': { content: 'export function foo() { if (x) { if (y) { if (z) { if (w) {} } } } }' },
      'src/app.test.ts': { content: "it('foo works', () => {})" },
    })

    const result = analyzePOSIWID(index)

    // foo is tested, so should not be flagged
    expect(result.findings.some(f => f.function === 'foo')).toBe(false)
  })

  test('testCoverage is a ratio between 0 and 1', () => {
    const index = createMockIndex({
      'src/a.ts': { content: 'export function a() { if (x) { if (y) { if (z) { if (w) {} } } } }' },
      'src/b.ts': { content: 'export function b() { if (x) { if (y) { if (z) { if (w) {} } } } }' },
    })

    const result = analyzePOSIWID(index)

    expect(result.testCoverage).toBeGreaterThanOrEqual(0)
    expect(result.testCoverage).toBeLessThanOrEqual(1)
  })
})

describe('test file detection', () => {
  test('recognizes .test.ts files', () => {
    const index = createMockIndex({
      'src/app.test.ts': { content: "it('works', () => {})" },
    })

    const result = analyzePOSIWID(index)
    expect(result.findings.every(f => f.file !== 'src/app.test.ts')).toBe(true)
  })

  test('recognizes .spec.ts files', () => {
    const index = createMockIndex({
      'src/app.spec.ts': { content: "it('works', () => {})" },
    })

    const result = analyzePOSIWID(index)
    expect(result.findings.every(f => f.file !== 'src/app.spec.ts')).toBe(true)
  })

  test('recognizes __tests__ directory', () => {
    const index = createMockIndex({
      '__tests__/app.ts': { content: "it('works', () => {})" },
    })

    const result = analyzePOSIWID(index)
    expect(result.findings.every(f => !f.file.includes('__tests__'))).toBe(true)
  })
})

describe('findings structure', () => {
  test('findings have file, function, complexity', () => {
    const index = createMockIndex({
      'src/complex.ts': {
        content: 'export function foo() { if (a) { if (b) { if (c) { if (d) {} } } } }',
      },
    })

    const result = analyzePOSIWID(index)

    if (result.findings.length > 0) {
      expect(result.findings[0]).toHaveProperty('file')
      expect(result.findings[0]).toHaveProperty('function')
      expect(result.findings[0]).toHaveProperty('complexity')
    }
  })

  test('limits findings to 10', () => {
    const files: Record<string, Partial<CodeFile>> = {}
    for (let i = 0; i < 20; i++) {
      files[`src/f${i}.ts`] = {
        content: `export function f${i}() { if (a) { if (b) { if (c) { if (d) {} } } } }`,
      }
    }
    const index = createMockIndex(files)

    const result = analyzePOSIWID(index)

    expect(result.findings.length).toBeLessThanOrEqual(10)
  })
})
