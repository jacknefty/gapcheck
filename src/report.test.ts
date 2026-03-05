/**
 * Tests for report.ts
 */

import { describe, test, expect } from 'bun:test'
import { generateReport, type ReportOptions } from './report'
import type { CodebaseIndex, VSMScores, Finding } from './types'
import type { Analysis } from './analyzer'
import type { AxiomResult } from './vsm/axioms'
import type { POSIWIDAnalysis } from './vsm/posiwid'
import type { AlgedonicAnalysis } from './vsm/flow'

function createMockIndex(overrides: Partial<CodebaseIndex> = {}): CodebaseIndex {
  return {
    root: '/test',
    files: new Map(),
    totalLoc: 100,
    languages: new Map([['typescript', { files: 5, loc: 100 }]]),
    ...overrides,
  }
}

function createMockScores(overrides: Partial<VSMScores> = {}): VSMScores {
  return {
    s1Operations: 8,
    s2Coordination: 7,
    s3Control: 9,
    s3StarAudit: 8,
    s4Intelligence: 7,
    s5Identity: 8,
    varietyBalance: 8,
    overall: 80,
    ...overrides,
  }
}

function createMockAnalysis(overrides: Partial<Analysis> = {}): Analysis {
  return {
    findings: [],
    scores: createMockScores(),
    variety: {
      profiles: new Map(),
      imbalances: [],
      totalVariety: 50,
      concentration: 0.3,
    },
    recursion: {
      viableSubsystems: ['src'],
      coupledSubsystems: [],
      maxDepth: 2,
    },
    s1: { score: 8, findings: [], operationalUnits: [], supportFunctions: [] },
    s2: { score: 7, findings: [], circularDeps: [], coordinationMechanisms: [] },
    s3: { score: 9, findings: [], orchestrators: [], resourceMechanisms: [], tunability: 'medium' },
    s3Star: { score: 8, findings: [], loggingMechanisms: [], errorTracking: [], monitoring: [] },
    s4: { score: 7, findings: [], deprecations: [], futurePatterns: [], techDebtMarkers: [], hasVersioning: true },
    s5: { score: 8, findings: [], domainTypes: [], validationSchemas: [], identityClarity: 'moderate', identityFiles: [] },
    axioms: [
      { axiom: 1, ok: true, message: 'Operations/management balanced' },
      { axiom: 2, ok: true, message: 'Present/future balanced' },
      { axiom: 3, ok: true, message: 'No residual variety' },
    ] as AxiomResult[],
    posiwid: {
      untestedComplexFunctions: 0,
      testCoverage: 0.8,
      findings: [],
    } as POSIWIDAnalysis,
    painSignals: { coverage: 0.7, strength: 'strong' },
    algedonic: {
      paths: [],
      coverage: 0.8,
      silentZones: [],
      brokenChannels: [],
    } as AlgedonicAnalysis,
    ...overrides,
  }
}

describe('generateReport', () => {
  test('markdown format includes header', () => {
    const report = generateReport('MyProject', createMockIndex(), createMockAnalysis(), { format: 'markdown', verbose: false })
    expect(report).toContain('GapCheck Report')
    expect(report).toContain('MyProject')
  })

  test('includes VSM scores', () => {
    const report = generateReport('Test', createMockIndex(), createMockAnalysis(), { format: 'markdown', verbose: false })
    expect(report).toContain('S1 Operations:')
    expect(report).toContain('S2 Coordination:')
    expect(report).toContain('S3 Control:')
    expect(report).toContain('S3* Audit:')
    expect(report).toContain('S4 Intelligence:')
    expect(report).toContain('S5 Identity:')
  })

  test('includes axioms', () => {
    const report = generateReport('Test', createMockIndex(), createMockAnalysis(), { format: 'markdown', verbose: false })
    expect(report).toContain('Viability Axioms')
    expect(report).toContain('Axiom 1')
    expect(report).toContain('Axiom 2')
    expect(report).toContain('Axiom 3')
  })

  test('includes pain signals', () => {
    const report = generateReport('Test', createMockIndex(), createMockAnalysis(), { format: 'markdown', verbose: false })
    expect(report).toContain('Pain Signals')
  })

  test('json format returns valid JSON', () => {
    const report = generateReport('Test', createMockIndex(), createMockAnalysis(), { format: 'json', verbose: false })
    expect(() => JSON.parse(report)).not.toThrow()
  })

  test('json includes project and scores', () => {
    const report = generateReport('MyProject', createMockIndex(), createMockAnalysis(), { format: 'json', verbose: false })
    const json = JSON.parse(report)
    expect(json.project).toBe('MyProject')
    expect(json.scores.overall).toBe(80)
  })
})

describe('score emoji', () => {
  test('high scores show + emoji', () => {
    const analysis = createMockAnalysis({ scores: createMockScores({ s1Operations: 9 }) })
    const report = generateReport('Test', createMockIndex(), analysis, { format: 'markdown', verbose: false })
    expect(report).toContain('+ S1 Operations:')
  })

  test('medium scores show ~ emoji', () => {
    const analysis = createMockAnalysis({ scores: createMockScores({ s1Operations: 6 }) })
    const report = generateReport('Test', createMockIndex(), analysis, { format: 'markdown', verbose: false })
    expect(report).toContain('~ S1 Operations:')
  })

  test('low scores show - emoji', () => {
    const analysis = createMockAnalysis({ scores: createMockScores({ s1Operations: 3 }) })
    const report = generateReport('Test', createMockIndex(), analysis, { format: 'markdown', verbose: false })
    expect(report).toContain('- S1 Operations:')
  })
})

describe('findings', () => {
  test('shows HIGH severity findings', () => {
    const analysis = createMockAnalysis({
      findings: [{
        system: 'S1',
        type: 'Critical',
        severity: 'HIGH',
        message: 'Critical issue found',
        files: [],
      }],
    })
    const report = generateReport('Test', createMockIndex(), analysis, { format: 'markdown', verbose: false })
    expect(report).toContain('HIGH')
    expect(report).toContain('Critical issue found')
  })

  test('verbose shows LOW findings', () => {
    const analysis = createMockAnalysis({
      findings: [{
        system: 'S1',
        type: 'Minor',
        severity: 'LOW',
        message: 'Minor issue',
        files: [],
      }],
    })
    const report = generateReport('Test', createMockIndex(), analysis, { format: 'markdown', verbose: true })
    expect(report).toContain('LOW')
    expect(report).toContain('Minor issue')
  })

  test('non-verbose hides LOW details', () => {
    const analysis = createMockAnalysis({
      findings: [{
        system: 'S1',
        type: 'Minor',
        severity: 'LOW',
        message: 'Minor issue',
        files: [],
      }],
    })
    const report = generateReport('Test', createMockIndex(), analysis, { format: 'markdown', verbose: false })
    expect(report).toContain('LOW')
    expect(report).not.toContain('Minor issue')
  })
})

describe('axiom display', () => {
  test('shows ok axioms with +', () => {
    const analysis = createMockAnalysis({
      axioms: [
        { axiom: 1, ok: true, message: 'Balanced' },
        { axiom: 2, ok: true, message: 'Balanced' },
        { axiom: 3, ok: true, message: 'Balanced' },
      ] as AxiomResult[],
    })
    const report = generateReport('Test', createMockIndex(), analysis, { format: 'markdown', verbose: false })
    expect(report).toContain('+ Axiom 1')
  })

  test('shows failed axioms with -', () => {
    const analysis = createMockAnalysis({
      axioms: [
        { axiom: 1, ok: false, message: 'Imbalanced' },
        { axiom: 2, ok: true, message: 'Balanced' },
        { axiom: 3, ok: true, message: 'Balanced' },
      ] as AxiomResult[],
    })
    const report = generateReport('Test', createMockIndex(), analysis, { format: 'markdown', verbose: false })
    expect(report).toContain('- Axiom 1')
  })
})

describe('posiwid', () => {
  test('shows untested functions when present', () => {
    const analysis = createMockAnalysis({
      posiwid: {
        untestedComplexFunctions: 3,
        testCoverage: 0.5,
        findings: [
          { file: 'test.ts', function: 'foo', complexity: 5 },
        ],
      } as POSIWIDAnalysis,
    })
    const report = generateReport('Test', createMockIndex(), analysis, { format: 'markdown', verbose: false })
    expect(report).toContain('POSIWID')
    expect(report).toContain('3 complex functions without tests')
  })
})
