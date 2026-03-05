/**
 * Tests for domain.ts
 */

import { describe, test, expect } from 'bun:test'
import { clampScore, clampPercent, scoreSeverity } from './domain'

describe('clampScore', () => {
  test('clamps to 0-10 range', () => {
    expect(clampScore(5)).toBe(5)
    expect(clampScore(-5)).toBe(0)
    expect(clampScore(15)).toBe(10)
  })

  test('accepts valid scores', () => {
    expect(clampScore(0)).toBe(0)
    expect(clampScore(10)).toBe(10)
    expect(clampScore(7.5)).toBe(7.5)
  })
})

describe('clampPercent', () => {
  test('clamps to 0-100 range', () => {
    expect(clampPercent(50)).toBe(50)
    expect(clampPercent(-10)).toBe(0)
    expect(clampPercent(150)).toBe(100)
  })

  test('rounds to integer', () => {
    expect(clampPercent(75.7)).toBe(76)
    expect(clampPercent(75.3)).toBe(75)
  })
})

describe('scoreSeverity', () => {
  test('returns LOW for high scores', () => {
    expect(scoreSeverity(10)).toBe('LOW')
    expect(scoreSeverity(8)).toBe('LOW')
  })

  test('returns MEDIUM for mid scores', () => {
    expect(scoreSeverity(7)).toBe('MEDIUM')
    expect(scoreSeverity(5)).toBe('MEDIUM')
  })

  test('returns HIGH for low scores', () => {
    expect(scoreSeverity(4)).toBe('HIGH')
    expect(scoreSeverity(0)).toBe('HIGH')
  })
})
