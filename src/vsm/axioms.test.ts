/**
 * Tests for axioms.ts
 */

import { describe, test, expect } from 'bun:test'
import { checkAxioms } from './axioms'
import type { CodebaseIndex, CodeFile } from '../types'
import type { VarietyAnalysis, VarietyProfile } from './variety'
import type { S1Analysis } from './s1-operations'
import type { S3Analysis } from './s3-control'
import type { S4Analysis } from './s4-intelligence'
import type { S5Analysis } from './s5-identity'
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
  for (const [path, partial] of Object.entries(files)) {
    fileMap.set(path, createMockFile({ path, ...partial }))
  }
  return {
    root: '/test',
    files: fileMap,
    totalLoc: 100,
    languages: new Map([['typescript', { files: fileMap.size, loc: 100 }]]),
  }
}

function createMockProfiles(profiles: Record<string, Partial<VarietyProfile>> = {}): Map<string, VarietyProfile> {
  const map = new Map<string, VarietyProfile>()
  for (const [path, partial] of Object.entries(profiles)) {
    map.set(path, {
      path,
      consumed: 0,
      produced: 1,
      ratio: 1,
      fanIn: 0,
      fanOut: 0,
      role: 'transducer',
      ...partial,
    })
  }
  return map
}

function createMockS1(overrides: Partial<S1Analysis> = {}): S1Analysis {
  return {
    score: 8,
    findings: [],
    operationalUnits: ['src/handlers/handler.ts'],
    supportFunctions: [],
    ...overrides,
  }
}

function createMockS3(overrides: Partial<S3Analysis> = {}): S3Analysis {
  return {
    score: 8,
    findings: [],
    orchestrators: ['src/index.ts'],
    resourceMechanisms: ['env config'],
    tunability: 'medium',
    ...overrides,
  }
}

function createMockS4(overrides: Partial<S4Analysis> = {}): S4Analysis {
  return {
    score: 8,
    findings: [],
    deprecations: [],
    futurePatterns: ['versioning', 'adapters'],
    techDebtMarkers: [],
    hasVersioning: true,
    ...overrides,
  }
}

function createMockS5(overrides: Partial<S5Analysis> = {}): S5Analysis {
  return {
    score: 8,
    findings: [],
    domainTypes: ['User', 'Order', 'Product'],
    validationSchemas: ['userSchema'],
    identityClarity: 'clear',
    identityFiles: ['src/types.ts'],
    ...overrides,
  }
}

function createMockVariety(overrides: Partial<VarietyAnalysis> = {}): VarietyAnalysis {
  return {
    profiles: createMockProfiles(),
    imbalances: [],
    totalVariety: 50,
    concentration: 0.3,
    ...overrides,
  }
}

describe('checkAxioms', () => {
  test('returns three axiom results', () => {
    const index = createMockIndex()
    const variety = createMockVariety()
    const s1 = createMockS1()
    const s3 = createMockS3()
    const s4 = createMockS4()
    const s5 = createMockS5()

    const results = checkAxioms(index, variety, s1, s3, s4, s5)

    expect(results).toHaveLength(3)
    expect(results[0].axiom).toBe(1)
    expect(results[1].axiom).toBe(2)
    expect(results[2].axiom).toBe(3)
  })

  test('returns ok boolean and message for each axiom', () => {
    const index = createMockIndex()
    const variety = createMockVariety()
    const s1 = createMockS1()
    const s3 = createMockS3()
    const s4 = createMockS4()
    const s5 = createMockS5()

    const results = checkAxioms(index, variety, s1, s3, s4, s5)

    for (const result of results) {
      expect(typeof result.ok).toBe('boolean')
      expect(typeof result.message).toBe('string')
    }
  })
})

describe('Axiom 1: Operations vs Management', () => {
  test('ok when balanced', () => {
    const index = createMockIndex()
    // Low variety to balance with management
    const variety = createMockVariety({ totalVariety: 10 })
    const s1 = createMockS1({ operationalUnits: [] })
    // Strong management mechanisms
    const s3 = createMockS3({ resourceMechanisms: ['env', 'config', 'limits'] })
    const s4 = createMockS4({ futurePatterns: ['versioning', 'adapters', 'migration'] })
    const s5 = createMockS5({ domainTypes: ['User', 'Order', 'Product', 'Account'] })

    const results = checkAxioms(index, variety, s1, s3, s4, s5)
    const axiom1 = results.find(r => r.axiom === 1)!

    expect(axiom1.ok).toBe(true)
    expect(axiom1.message).toContain('balanced')
  })

  test('fails when operations overwhelm management', () => {
    const index = createMockIndex()
    const variety = createMockVariety({ totalVariety: 100 })
    const s1 = createMockS1({
      operationalUnits: ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'f.ts'],
    })
    const s3 = createMockS3({ resourceMechanisms: [] })
    const s4 = createMockS4({ futurePatterns: [] })
    const s5 = createMockS5({ domainTypes: [] })

    const results = checkAxioms(index, variety, s1, s3, s4, s5)
    const axiom1 = results.find(r => r.axiom === 1)!

    expect(axiom1.ok).toBe(false)
    expect(axiom1.message).toContain('heavy')
  })
})

describe('Axiom 2: Present vs Future', () => {
  test('ok when S3 and S4 are balanced', () => {
    const index = createMockIndex()
    const variety = createMockVariety()
    const s1 = createMockS1()
    const s3 = createMockS3()
    const s4 = createMockS4()
    const s5 = createMockS5()

    const results = checkAxioms(index, variety, s1, s3, s4, s5)
    const axiom2 = results.find(r => r.axiom === 2)!

    expect(axiom2.ok).toBe(true)
    expect(axiom2.message).toContain('balanced')
  })

  test('fails when S3 >> S4', () => {
    const index = createMockIndex()
    const variety = createMockVariety()
    const s1 = createMockS1()
    const s3 = createMockS3({
      orchestrators: ['a.ts', 'b.ts', 'c.ts', 'd.ts'],
      resourceMechanisms: ['env', 'config', 'flags', 'limits'],
    })
    const s4 = createMockS4({ futurePatterns: [], hasVersioning: false })
    const s5 = createMockS5()

    const results = checkAxioms(index, variety, s1, s3, s4, s5)
    const axiom2 = results.find(r => r.axiom === 2)!

    expect(axiom2.ok).toBe(false)
    expect(axiom2.message).toContain('Present')
  })
})

describe('Axiom 3: Identity absorbs residual', () => {
  test('ok when no residual variety', () => {
    const index = createMockIndex()
    const variety = createMockVariety({ imbalances: [] })
    const s1 = createMockS1()
    const s3 = createMockS3()
    const s4 = createMockS4()
    const s5 = createMockS5()

    const results = checkAxioms(index, variety, s1, s3, s4, s5)
    const axiom3 = results.find(r => r.axiom === 3)!

    expect(axiom3.ok).toBe(true)
    expect(axiom3.message).toContain('No residual')
  })

  test('fails when identity is weak and residual is high', () => {
    const index = createMockIndex()
    const variety = createMockVariety({
      imbalances: [
        { type: 'crush', severity: 'HIGH', message: 'Test', files: [] },
        { type: 'crush', severity: 'HIGH', message: 'Test', files: [] },
        { type: 'crush', severity: 'HIGH', message: 'Test', files: [] },
      ],
    })
    const s1 = createMockS1()
    const s3 = createMockS3()
    const s4 = createMockS4()
    const s5 = createMockS5({ domainTypes: [], identityFiles: [] })

    const results = checkAxioms(index, variety, s1, s3, s4, s5)
    const axiom3 = results.find(r => r.axiom === 3)!

    expect(axiom3.ok).toBe(false)
    expect(axiom3.message).toContain('Weak')
  })

  test('ok when strong identity absorbs residual', () => {
    const index = createMockIndex()
    const variety = createMockVariety({
      imbalances: [{ type: 'crush', severity: 'LOW', message: 'Test', files: [] }],
    })
    const s1 = createMockS1()
    const s3 = createMockS3()
    const s4 = createMockS4()
    const s5 = createMockS5({
      domainTypes: ['A', 'B', 'C', 'D', 'E'],
      identityFiles: ['types.ts', 'schemas.ts'],
    })

    const results = checkAxioms(index, variety, s1, s3, s4, s5)
    const axiom3 = results.find(r => r.axiom === 3)!

    expect(axiom3.ok).toBe(true)
  })
})
