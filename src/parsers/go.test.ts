/**
 * Comprehensive tests for Go parser
 *
 * Testing extractComment and related functions
 * These were flagged as HIGH POSIWID findings
 */

import { describe, test, expect } from 'bun:test'
import { goParser } from './go'

const parse = (content: string) => goParser.parse(content, 'test.go')

// Helper functions
const hasSymbol = (symbols: { name: string }[], name: string) =>
  symbols.some(s => s.name === name)

const getSymbol = (symbols: { name: string; documentation?: string }[], name: string) =>
  symbols.find(s => s.name === name)

const hasImport = (imports: { source: string }[], source: string) =>
  imports.some(i => i.source === source)

describe('extractComment', () => {
  describe('single line comments', () => {
    test('extracts single line comment before function', () => {
      const result = parse(`
// MyFunc does something
func MyFunc() {}
      `)
      const sym = getSymbol(result.symbols, 'MyFunc')
      expect(sym?.documentation).toBe('MyFunc does something')
    })

    test('extracts multiple comment lines', () => {
      const result = parse(`
// Line one
// Line two
// Line three
func MyFunc() {}
      `)
      const sym = getSymbol(result.symbols, 'MyFunc')
      expect(sym?.documentation).toContain('Line one')
      expect(sym?.documentation).toContain('Line two')
      expect(sym?.documentation).toContain('Line three')
    })

    test('strips comment prefix', () => {
      const result = parse(`
// Documentation here
func MyFunc() {}
      `)
      const sym = getSymbol(result.symbols, 'MyFunc')
      expect(sym?.documentation).not.toContain('//')
    })
  })

  describe('type comments', () => {
    test('extracts comment before struct', () => {
      const result = parse(`
// MyStruct represents something
type MyStruct struct {}
      `)
      const sym = getSymbol(result.symbols, 'MyStruct')
      expect(sym?.documentation).toBe('MyStruct represents something')
    })

    test('extracts comment before interface', () => {
      const result = parse(`
// Reader is an interface for reading
type Reader interface {
    Read() error
}
      `)
      const sym = getSymbol(result.symbols, 'Reader')
      expect(sym?.documentation).toBe('Reader is an interface for reading')
    })
  })

  describe('edge cases', () => {
    test('returns undefined when no comment', () => {
      const result = parse(`func NoDoc() {}`)
      const sym = getSymbol(result.symbols, 'NoDoc')
      expect(sym?.documentation).toBeUndefined()
    })

    test('handles comment not directly preceding', () => {
      const result = parse(`
// This is a comment

func WithGap() {}
      `)
      // Comment should not be attached due to gap
      const sym = getSymbol(result.symbols, 'WithGap')
      expect(sym?.documentation).toBeUndefined()
    })

    test('handles empty comment lines', () => {
      const result = parse(`
// First line
//
// After empty line
func MyFunc() {}
      `)
      const sym = getSymbol(result.symbols, 'MyFunc')
      expect(sym?.documentation).toContain('First line')
    })
  })
})

describe('extractImports', () => {
  describe('single imports', () => {
    test('extracts single import', () => {
      const result = parse(`
package main

import "fmt"
      `)
      expect(hasImport(result.imports, 'fmt')).toBe(true)
    })

    test('extracts import with path', () => {
      const result = parse(`
package main

import "github.com/user/pkg"
      `)
      expect(hasImport(result.imports, 'github.com/user/pkg')).toBe(true)
    })
  })

  describe('import blocks', () => {
    test('extracts from import block', () => {
      const result = parse(`
package main

import (
  "fmt"
  "os"
)
      `)
      expect(hasImport(result.imports, 'fmt')).toBe(true)
      expect(hasImport(result.imports, 'os')).toBe(true)
    })

    test('handles aliased imports', () => {
      const result = parse(`
package main

import (
  f "fmt"
  . "os"
)
      `)
      expect(hasImport(result.imports, 'fmt')).toBe(true)
      expect(hasImport(result.imports, 'os')).toBe(true)
    })
  })

  describe('local vs external', () => {
    test('marks stdlib as local', () => {
      const result = parse(`import "fmt"`)
      const imp = result.imports.find(i => i.source === 'fmt')
      expect(imp?.isLocal).toBe(true)
    })

    test('marks external packages as non-local', () => {
      const result = parse(`import "github.com/user/pkg"`)
      const imp = result.imports.find(i => i.source === 'github.com/user/pkg')
      expect(imp?.isLocal).toBe(false)
    })
  })
})

describe('extractExports', () => {
  test('exports uppercase functions', () => {
    const result = parse('func Public() {}')
    expect(result.exports.some(e => e.name === 'Public')).toBe(true)
  })

  test('does not export lowercase functions', () => {
    const result = parse('func private() {}')
    expect(result.exports.some(e => e.name === 'private')).toBe(false)
  })

  test('exports uppercase types', () => {
    const result = parse('type MyType struct {}')
    expect(result.exports.some(e => e.name === 'MyType')).toBe(true)
  })

  test('does not export lowercase types', () => {
    const result = parse('type myType struct {}')
    expect(result.exports.some(e => e.name === 'myType')).toBe(false)
  })
})

describe('extractSymbols', () => {
  describe('functions', () => {
    test('extracts regular function', () => {
      const result = parse('func myFunc() {}')
      expect(hasSymbol(result.symbols, 'myFunc')).toBe(true)
    })

    test('extracts method with receiver', () => {
      const result = parse('func (s *Server) Handle() {}')
      expect(hasSymbol(result.symbols, 'Handle')).toBe(true)
    })

    test('sets correct line number', () => {
      const result = parse('\n\nfunc onLine3() {}')
      const sym = getSymbol(result.symbols, 'onLine3')
      expect(sym?.line).toBe(3)
    })
  })

  describe('types', () => {
    test('extracts struct', () => {
      const result = parse('type MyStruct struct {}')
      const sym = getSymbol(result.symbols, 'MyStruct')
      expect(sym?.kind).toBe('class')
    })

    test('extracts interface', () => {
      const result = parse('type MyInterface interface {}')
      const sym = getSymbol(result.symbols, 'MyInterface')
      expect(sym?.kind).toBe('interface')
    })

    test('extracts type alias', () => {
      const result = parse('type MyString string')
      const sym = getSymbol(result.symbols, 'MyString')
      expect(sym?.kind).toBe('type')
    })
  })

  describe('constants and variables', () => {
    test('extracts const', () => {
      const result = parse('const MaxSize = 100')
      expect(hasSymbol(result.symbols, 'MaxSize')).toBe(true)
    })

    test('extracts const block', () => {
      const result = parse(`
const (
  A = 1
  B = 2
)
      `)
      expect(hasSymbol(result.symbols, 'A')).toBe(true)
      expect(hasSymbol(result.symbols, 'B')).toBe(true)
    })

    test('extracts var', () => {
      const result = parse('var counter int')
      expect(hasSymbol(result.symbols, 'counter')).toBe(true)
    })
  })
})

describe('countLoc', () => {
  test('excludes blank lines', () => {
    const result1 = parse('func a() {}')
    const result2 = parse('func a() {}\n\n\n')
    expect(result1.loc).toBe(result2.loc)
  })

  test('excludes line comments', () => {
    const result1 = parse('func a() {}')
    const result2 = parse('// comment\nfunc a() {}')
    expect(result1.loc).toBe(result2.loc)
  })

  test('excludes block comments', () => {
    const result1 = parse('func a() {}')
    const result2 = parse('/* comment */\nfunc a() {}')
    expect(result1.loc).toBe(result2.loc)
  })

  test('handles multiline block comments', () => {
    const result = parse(`
/*
  This is a
  multiline comment
*/
func actualCode() {}
    `)
    expect(result.loc).toBe(1)
  })
})
