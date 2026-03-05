/**
 * Tests for variety.ts
 *
 * "Only variety can destroy variety" - Ashby
 */

import { describe, test, expect } from 'bun:test'
import {
  analyzeVariety,
  calculateVarietyProfiles,
  detectVarietyImbalances,
  calculateConcentration,
} from './variety'
import type { CodebaseIndex, CodeFile } from '../types'
import type { ParsedFile } from '../parsers/types'

// Helper to create mock CodeFile
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

// Helper to create mock CodebaseIndex
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

describe('calculateVarietyProfiles', () => {
  test('calculates consumed variety from imports', () => {
    const index = createMockIndex({
      'a.ts': { imports: ['b.ts', 'c.ts'], exports: [] },
    })
    const profiles = calculateVarietyProfiles(index)
    expect(profiles.get('a.ts')?.consumed).toBe(2)
  })

  test('calculates produced variety from exports', () => {
    const index = createMockIndex({
      'a.ts': { imports: [], exports: ['foo', 'bar', 'baz'] },
    })
    const profiles = calculateVarietyProfiles(index)
    expect(profiles.get('a.ts')?.produced).toBe(3)
  })

  test('calculates fanIn from importedBy', () => {
    const index = createMockIndex({
      'a.ts': { importedBy: ['b.ts', 'c.ts', 'd.ts'] },
    })
    const profiles = calculateVarietyProfiles(index)
    expect(profiles.get('a.ts')?.fanIn).toBe(3)
  })

  test('calculates fanOut from imports', () => {
    const index = createMockIndex({
      'a.ts': { imports: ['b.ts', 'c.ts'] },
    })
    const profiles = calculateVarietyProfiles(index)
    expect(profiles.get('a.ts')?.fanOut).toBe(2)
  })

  test('identifies amplifiers (ratio > 1.5)', () => {
    const index = createMockIndex({
      'a.ts': { imports: ['b.ts'], exports: ['x', 'y', 'z'] }, // ratio = 3
    })
    const profiles = calculateVarietyProfiles(index)
    expect(profiles.get('a.ts')?.role).toBe('amplifier')
  })

  test('identifies attenuators (ratio < 0.5)', () => {
    const index = createMockIndex({
      'a.ts': { imports: ['b.ts', 'c.ts', 'd.ts'], exports: ['x'] }, // ratio = 0.33
    })
    const profiles = calculateVarietyProfiles(index)
    expect(profiles.get('a.ts')?.role).toBe('attenuator')
  })

  test('identifies transducers (balanced ratio)', () => {
    const index = createMockIndex({
      'a.ts': { imports: ['b.ts', 'c.ts'], exports: ['x', 'y'] }, // ratio = 1
    })
    const profiles = calculateVarietyProfiles(index)
    expect(profiles.get('a.ts')?.role).toBe('transducer')
  })

  test('identifies isolates (no connections)', () => {
    const index = createMockIndex({
      'a.ts': { imports: [], importedBy: [], exports: ['x'] },
    })
    const profiles = calculateVarietyProfiles(index)
    expect(profiles.get('a.ts')?.role).toBe('isolate')
  })
})

describe('detectVarietyImbalances', () => {
  test('detects variety crush (high fanIn, low exports)', () => {
    const index = createMockIndex({
      'bottleneck.ts': {
        imports: [],
        importedBy: ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'f.ts'],
        exports: ['x', 'y'],
      },
    })
    const profiles = calculateVarietyProfiles(index)
    const imbalances = detectVarietyImbalances(index, profiles)

    expect(imbalances.some(i => i.type === 'crush')).toBe(true)
    expect(imbalances.find(i => i.type === 'crush')?.severity).toBe('HIGH')
  })

  test('detects variety overflow (high exports, low fanIn)', () => {
    const index = createMockIndex({
      'overflow.ts': {
        imports: [],
        importedBy: ['a.ts'],
        exports: Array(20).fill('').map((_, i) => `export${i}`),
      },
    })
    const profiles = calculateVarietyProfiles(index)
    const imbalances = detectVarietyImbalances(index, profiles)

    expect(imbalances.some(i => i.type === 'overflow')).toBe(true)
  })

  test('detects bottleneck (extreme fanIn)', () => {
    const index = createMockIndex({
      'bottleneck.ts': {
        imports: [],
        importedBy: Array(12).fill('').map((_, i) => `dep${i}.ts`),
        exports: ['x'],
        content: 'export const x = 1', // Not a type file
      },
    })
    const profiles = calculateVarietyProfiles(index)
    const imbalances = detectVarietyImbalances(index, profiles)

    expect(imbalances.some(i => i.type === 'bottleneck')).toBe(true)
    expect(imbalances.find(i => i.type === 'bottleneck')?.severity).toBe('HIGH')
  })

  test('does not flag type definition files as bottlenecks', () => {
    const index = createMockIndex({
      'types.ts': {
        imports: [],
        importedBy: Array(12).fill('').map((_, i) => `dep${i}.ts`),
        exports: ['Type1', 'Type2'],
        content: 'export type Type1 = string\nexport interface Type2 {}',
      },
    })
    const profiles = calculateVarietyProfiles(index)
    const imbalances = detectVarietyImbalances(index, profiles)

    expect(imbalances.some(i => i.type === 'bottleneck')).toBe(false)
  })

  test('detects islands (no connections)', () => {
    const index = createMockIndex({
      'island.ts': {
        imports: [],
        importedBy: [],
        exports: ['unused'],
      },
    })
    const profiles = calculateVarietyProfiles(index)
    const imbalances = detectVarietyImbalances(index, profiles)

    expect(imbalances.some(i => i.type === 'island')).toBe(true)
    expect(imbalances.find(i => i.type === 'island')?.severity).toBe('LOW')
  })
})

describe('calculateConcentration', () => {
  test('returns 0 for evenly distributed fanIn', () => {
    const profiles = new Map([
      ['a.ts', { path: 'a.ts', consumed: 0, produced: 0, ratio: 1, fanIn: 2, fanOut: 0, role: 'transducer' as const }],
      ['b.ts', { path: 'b.ts', consumed: 0, produced: 0, ratio: 1, fanIn: 2, fanOut: 0, role: 'transducer' as const }],
      ['c.ts', { path: 'c.ts', consumed: 0, produced: 0, ratio: 1, fanIn: 2, fanOut: 0, role: 'transducer' as const }],
    ])
    const concentration = calculateConcentration(profiles)
    expect(concentration).toBe(0)
  })

  test('returns high value for concentrated fanIn', () => {
    const profiles = new Map([
      ['a.ts', { path: 'a.ts', consumed: 0, produced: 0, ratio: 1, fanIn: 100, fanOut: 0, role: 'transducer' as const }],
      ['b.ts', { path: 'b.ts', consumed: 0, produced: 0, ratio: 1, fanIn: 0, fanOut: 0, role: 'transducer' as const }],
      ['c.ts', { path: 'c.ts', consumed: 0, produced: 0, ratio: 1, fanIn: 0, fanOut: 0, role: 'transducer' as const }],
    ])
    const concentration = calculateConcentration(profiles)
    expect(concentration).toBeGreaterThan(0.5)
  })

  test('returns 0 for empty profiles', () => {
    const profiles = new Map()
    expect(calculateConcentration(profiles)).toBe(0)
  })

  test('returns 0 when all fanIn is 0', () => {
    const profiles = new Map([
      ['a.ts', { path: 'a.ts', consumed: 0, produced: 0, ratio: 1, fanIn: 0, fanOut: 0, role: 'transducer' as const }],
    ])
    expect(calculateConcentration(profiles)).toBe(0)
  })
})

describe('analyzeVariety', () => {
  test('returns complete variety analysis', () => {
    const index = createMockIndex({
      'a.ts': { imports: ['b.ts'], exports: ['x'], importedBy: [] },
      'b.ts': { imports: [], exports: ['y'], importedBy: ['a.ts'] },
    })

    const analysis = analyzeVariety(index)

    expect(analysis.profiles.size).toBe(2)
    expect(analysis.totalVariety).toBe(2) // x + y
    expect(typeof analysis.concentration).toBe('number')
    expect(Array.isArray(analysis.imbalances)).toBe(true)
  })

  test('calculates total variety as sum of exports', () => {
    const index = createMockIndex({
      'a.ts': { exports: ['x', 'y'] },
      'b.ts': { exports: ['z'] },
    })

    const analysis = analyzeVariety(index)
    expect(analysis.totalVariety).toBe(3)
  })
})
