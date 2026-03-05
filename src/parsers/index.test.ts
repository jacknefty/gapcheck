/**
 * Tests for parser index module
 *
 * Testing getSupportedExtensions, isSupported, getParser, parseFile, getLanguageStats
 * These were flagged as MEDIUM POSIWID findings
 */

import { describe, test, expect } from 'bun:test'
import {
  getSupportedExtensions,
  isSupported,
  getParser,
  parseFile,
  getLanguageStats,
  type ParsedFile,
} from './index'

describe('getSupportedExtensions', () => {
  test('returns array of extensions', () => {
    const exts = getSupportedExtensions()
    expect(Array.isArray(exts)).toBe(true)
    expect(exts.length).toBeGreaterThan(0)
  })

  test('includes TypeScript extensions', () => {
    const exts = getSupportedExtensions()
    expect(exts).toContain('.ts')
    expect(exts).toContain('.tsx')
  })

  test('includes JavaScript extensions', () => {
    const exts = getSupportedExtensions()
    expect(exts).toContain('.js')
    expect(exts).toContain('.jsx')
  })

  test('includes Python extension', () => {
    const exts = getSupportedExtensions()
    expect(exts).toContain('.py')
  })

  test('includes Go extension', () => {
    const exts = getSupportedExtensions()
    expect(exts).toContain('.go')
  })

  test('includes Rust extension', () => {
    const exts = getSupportedExtensions()
    expect(exts).toContain('.rs')
  })

  test('all extensions start with dot', () => {
    const exts = getSupportedExtensions()
    for (const ext of exts) {
      expect(ext.startsWith('.')).toBe(true)
    }
  })
})

describe('isSupported', () => {
  describe('supported files', () => {
    test('returns true for .ts files', () => {
      expect(isSupported('file.ts')).toBe(true)
    })

    test('returns true for .tsx files', () => {
      expect(isSupported('component.tsx')).toBe(true)
    })

    test('returns true for .js files', () => {
      expect(isSupported('script.js')).toBe(true)
    })

    test('returns true for .py files', () => {
      expect(isSupported('script.py')).toBe(true)
    })

    test('returns true for .go files', () => {
      expect(isSupported('main.go')).toBe(true)
    })

    test('returns true for .rs files', () => {
      expect(isSupported('lib.rs')).toBe(true)
    })
  })

  describe('unsupported files', () => {
    test('returns false for .md files', () => {
      expect(isSupported('README.md')).toBe(false)
    })

    test('returns false for .json files', () => {
      expect(isSupported('package.json')).toBe(false)
    })

    test('returns false for .txt files', () => {
      expect(isSupported('notes.txt')).toBe(false)
    })

    test('returns false for files with no extension', () => {
      expect(isSupported('Makefile')).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('handles uppercase extensions', () => {
      expect(isSupported('file.TS')).toBe(true)
    })

    test('handles mixed case extensions', () => {
      expect(isSupported('file.Ts')).toBe(true)
    })

    test('handles full paths', () => {
      expect(isSupported('src/components/Button.tsx')).toBe(true)
    })

    test('handles paths with dots', () => {
      expect(isSupported('./src/module.v2/file.ts')).toBe(true)
    })
  })
})

describe('getParser', () => {
  test('returns parser for .ts files', () => {
    const parser = getParser('file.ts')
    expect(parser).not.toBeNull()
    expect(parser?.languages).toContain('typescript')
  })

  test('returns parser for .py files', () => {
    const parser = getParser('script.py')
    expect(parser).not.toBeNull()
    expect(parser?.languages).toContain('python')
  })

  test('returns parser for .go files', () => {
    const parser = getParser('main.go')
    expect(parser).not.toBeNull()
    expect(parser?.languages).toContain('go')
  })

  test('returns parser for .rs files', () => {
    const parser = getParser('lib.rs')
    expect(parser).not.toBeNull()
    expect(parser?.languages).toContain('rust')
  })

  test('returns null for unsupported files', () => {
    expect(getParser('file.md')).toBeNull()
  })

  test('handles uppercase extensions', () => {
    const parser = getParser('file.TS')
    expect(parser).not.toBeNull()
  })
})

describe('parseFile', () => {
  test('parses TypeScript file', () => {
    const content = 'export const x = 1'
    const result = parseFile(content, 'test.ts')
    expect(result).not.toBeNull()
    expect(result?.language).toBe('typescript')
  })

  test('parses Python file', () => {
    const content = 'def hello(): pass'
    const result = parseFile(content, 'test.py')
    expect(result).not.toBeNull()
    expect(result?.language).toBe('python')
  })

  test('parses Go file', () => {
    const content = 'package main\nfunc main() {}'
    const result = parseFile(content, 'main.go')
    expect(result).not.toBeNull()
    expect(result?.language).toBe('go')
  })

  test('parses Rust file', () => {
    const content = 'fn main() {}'
    const result = parseFile(content, 'main.rs')
    expect(result).not.toBeNull()
    expect(result?.language).toBe('rust')
  })

  test('returns null for unsupported files', () => {
    const result = parseFile('content', 'file.md')
    expect(result).toBeNull()
  })

  test('extracts imports', () => {
    const content = "import { foo } from './foo'"
    const result = parseFile(content, 'test.ts')
    expect(result?.imports.length).toBeGreaterThan(0)
  })

  test('extracts exports', () => {
    const content = 'export function myFunc() {}'
    const result = parseFile(content, 'test.ts')
    expect(result?.exports.some(e => e.name === 'myFunc')).toBe(true)
  })

  test('counts lines of code', () => {
    const content = 'const x = 1\nconst y = 2\nconst z = 3'
    const result = parseFile(content, 'test.ts')
    expect(result?.loc).toBeGreaterThan(0)
  })

  test('preserves file path', () => {
    const result = parseFile('const x = 1', 'src/utils/helper.ts')
    expect(result?.path).toBe('src/utils/helper.ts')
  })
})

describe('getLanguageStats', () => {
  const createMockFile = (language: string, loc: number): ParsedFile => ({
    path: `test.${language === 'typescript' ? 'ts' : language === 'python' ? 'py' : 'go'}`,
    language: language as any,
    imports: [],
    exports: [],
    symbols: [],
    loc,
    content: '',
  })

  test('counts files per language', () => {
    const files = [
      createMockFile('typescript', 100),
      createMockFile('typescript', 200),
      createMockFile('python', 150),
    ]
    const stats = getLanguageStats(files)

    expect(stats.get('typescript')?.files).toBe(2)
    expect(stats.get('python')?.files).toBe(1)
  })

  test('sums LOC per language', () => {
    const files = [
      createMockFile('typescript', 100),
      createMockFile('typescript', 200),
      createMockFile('python', 150),
    ]
    const stats = getLanguageStats(files)

    expect(stats.get('typescript')?.loc).toBe(300)
    expect(stats.get('python')?.loc).toBe(150)
  })

  test('handles empty array', () => {
    const stats = getLanguageStats([])
    expect(stats.size).toBe(0)
  })

  test('handles single file', () => {
    const files = [createMockFile('typescript', 100)]
    const stats = getLanguageStats(files)

    expect(stats.get('typescript')?.files).toBe(1)
    expect(stats.get('typescript')?.loc).toBe(100)
  })

  test('handles multiple languages', () => {
    const files = [
      createMockFile('typescript', 100),
      createMockFile('python', 200),
      createMockFile('go', 300),
      createMockFile('rust', 400),
    ]
    const stats = getLanguageStats(files)

    expect(stats.size).toBe(4)
    expect(stats.has('typescript')).toBe(true)
    expect(stats.has('python')).toBe(true)
    expect(stats.has('go')).toBe(true)
    expect(stats.has('rust')).toBe(true)
  })
})
