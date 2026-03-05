/**
 * Comprehensive tests for Python parser
 *
 * Testing extractDocstring and related functions
 * These were flagged as HIGH POSIWID findings
 */

import { describe, test, expect } from 'bun:test'
import { pythonParser } from './python'

const parse = (content: string) => pythonParser.parse(content, 'test.py')

// Helper functions
const hasSymbol = (symbols: { name: string }[], name: string) =>
  symbols.some(s => s.name === name)

const getSymbol = (symbols: { name: string; documentation?: string }[], name: string) =>
  symbols.find(s => s.name === name)

describe('extractDocstring', () => {
  describe('single line docstrings', () => {
    test('extracts double-quoted docstring', () => {
      const result = parse(`
def my_func():
    """This is a docstring."""
    pass
      `)
      const sym = getSymbol(result.symbols, 'my_func')
      expect(sym?.documentation).toBe('This is a docstring.')
    })

    test('extracts single-quoted docstring', () => {
      const result = parse(`
def my_func():
    '''Single quoted docstring.'''
    pass
      `)
      const sym = getSymbol(result.symbols, 'my_func')
      expect(sym?.documentation).toBe('Single quoted docstring.')
    })

    test('handles docstring with internal quotes', () => {
      const result = parse(`
def my_func():
    """Contains 'single' quotes."""
    pass
      `)
      const sym = getSymbol(result.symbols, 'my_func')
      expect(sym?.documentation).toContain("'single'")
    })
  })

  describe('multiline docstrings', () => {
    test('extracts multiline docstring', () => {
      const result = parse(`
def my_func():
    """
    This is a multiline
    docstring with multiple lines.
    """
    pass
      `)
      const sym = getSymbol(result.symbols, 'my_func')
      expect(sym?.documentation).toContain('multiline')
      expect(sym?.documentation).toContain('multiple lines')
    })

    test('handles blank lines in docstring', () => {
      const result = parse(`
def my_func():
    """
    First paragraph.

    Second paragraph.
    """
    pass
      `)
      const sym = getSymbol(result.symbols, 'my_func')
      expect(sym?.documentation).toContain('First paragraph')
      expect(sym?.documentation).toContain('Second paragraph')
    })

    test('handles single-quoted multiline', () => {
      const result = parse(`
def my_func():
    '''
    Single quoted
    multiline docstring.
    '''
    pass
      `)
      const sym = getSymbol(result.symbols, 'my_func')
      expect(sym?.documentation).toContain('Single quoted')
    })
  })

  describe('class docstrings', () => {
    test('extracts class docstring', () => {
      const result = parse(`
class MyClass:
    """Class documentation here."""
    pass
      `)
      const sym = getSymbol(result.symbols, 'MyClass')
      expect(sym?.documentation).toBe('Class documentation here.')
    })

    test('extracts class multiline docstring', () => {
      const result = parse(`
class MyClass:
    """
    This class does something.

    Attributes:
        name: The name.
    """
    pass
      `)
      const sym = getSymbol(result.symbols, 'MyClass')
      expect(sym?.documentation).toContain('This class does something')
    })
  })

  describe('edge cases', () => {
    test('returns undefined when no docstring', () => {
      const result = parse(`
def no_doc():
    pass
      `)
      const sym = getSymbol(result.symbols, 'no_doc')
      expect(sym?.documentation).toBeUndefined()
    })

    test('handles blank lines between def and docstring', () => {
      const result = parse(`
def my_func():

    """Docstring after blank."""
    pass
      `)
      const sym = getSymbol(result.symbols, 'my_func')
      expect(sym?.documentation).toBe('Docstring after blank.')
    })

    test('handles empty docstring', () => {
      const result = parse(`
def my_func():
    """"""
    pass
      `)
      const sym = getSymbol(result.symbols, 'my_func')
      // Parser treats """""" as start of multiline, not empty single-line
      // This documents current behavior
      expect(sym?.documentation).toBeDefined()
    })

    test('handles docstring at end of file', () => {
      const result = parse(`
def my_func():
    """Final docstring."""`)
      const sym = getSymbol(result.symbols, 'my_func')
      expect(sym?.documentation).toBe('Final docstring.')
    })
  })
})

describe('extractImports', () => {
  test('extracts simple import', () => {
    const result = parse('import os')
    expect(result.imports.some(i => i.source === 'os')).toBe(true)
  })

  test('extracts from import', () => {
    const result = parse('from typing import List, Dict')
    const imp = result.imports.find(i => i.source === 'typing')
    expect(imp?.symbols).toContain('List')
    expect(imp?.symbols).toContain('Dict')
  })

  test('extracts relative import as local', () => {
    const result = parse('from .module import func')
    const imp = result.imports.find(i => i.source === '.module')
    expect(imp?.isLocal).toBe(true)
  })

  test('marks stdlib as non-local', () => {
    const result = parse('import sys')
    const imp = result.imports.find(i => i.source === 'sys')
    expect(imp?.isLocal).toBe(false)
  })

  test('handles import with alias', () => {
    const result = parse('from typing import Dict as D')
    const imp = result.imports.find(i => i.source === 'typing')
    expect(imp?.symbols).toContain('Dict')
  })
})

describe('extractExports', () => {
  test('exports public functions', () => {
    const result = parse('def public_func(): pass')
    expect(result.exports.some(e => e.name === 'public_func')).toBe(true)
  })

  test('does not export private functions', () => {
    const result = parse('def _private_func(): pass')
    expect(result.exports.some(e => e.name === '_private_func')).toBe(false)
  })

  test('uses __all__ when defined', () => {
    const result = parse(`
__all__ = ['exported_func']

def exported_func(): pass
def not_exported(): pass
    `)
    expect(result.exports.some(e => e.name === 'exported_func')).toBe(true)
    expect(result.exports.some(e => e.name === 'not_exported')).toBe(false)
  })

  test('exports public classes', () => {
    const result = parse('class PublicClass: pass')
    expect(result.exports.some(e => e.name === 'PublicClass')).toBe(true)
  })
})

describe('extractSymbols', () => {
  test('extracts async functions', () => {
    const result = parse('async def async_func(): pass')
    expect(hasSymbol(result.symbols, 'async_func')).toBe(true)
  })

  test('identifies methods as indented functions', () => {
    const result = parse(`
class MyClass:
    def method(self):
        pass
    `)
    const sym = getSymbol(result.symbols, 'method')
    expect(sym?.kind).toBe('method')
  })

  test('extracts top-level constants', () => {
    const result = parse('MAX_SIZE = 100')
    expect(hasSymbol(result.symbols, 'MAX_SIZE')).toBe(true)
  })

  test('extracts type aliases', () => {
    const result = parse('StringList = List[str]')
    expect(hasSymbol(result.symbols, 'StringList')).toBe(true)
  })
})

describe('countLoc', () => {
  test('excludes blank lines', () => {
    const result1 = parse('x = 1')
    const result2 = parse('x = 1\n\n\n')
    expect(result1.loc).toBe(result2.loc)
  })

  test('excludes comments', () => {
    const result1 = parse('x = 1')
    const result2 = parse('# comment\nx = 1')
    expect(result1.loc).toBe(result2.loc)
  })

  test('excludes docstrings from loc', () => {
    const result1 = parse('x = 1')
    const result2 = parse('"""docstring"""\nx = 1')
    expect(result1.loc).toBe(result2.loc)
  })

  test('handles multiline docstrings', () => {
    const result = parse(`
"""
This is a
multiline docstring
"""
x = 1
    `)
    expect(result.loc).toBe(1)
  })
})
