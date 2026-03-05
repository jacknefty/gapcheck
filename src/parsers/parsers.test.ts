/**
 * Tests for parser modules
 *
 * Testing language-specific parsing functions
 */

import { describe, test, expect } from 'bun:test'
import { typescriptParser } from './typescript'
import { pythonParser } from './python'
import { goParser } from './go'
import { rustParser } from './rust'

// Convenience wrappers
const parseTypeScript = (content: string, path: string) => typescriptParser.parse(content, path)
const parsePython = (content: string, path: string) => pythonParser.parse(content, path)
const parseGo = (content: string, path: string) => goParser.parse(content, path)
const parseRust = (content: string, path: string) => rustParser.parse(content, path)

// Helper to check if imports contain a source
const hasImport = (imports: { source: string }[], source: string) =>
  imports.some(i => i.source === source)

// Helper to check if exports contain a name
const hasExport = (exports: { name: string }[], name: string) =>
  exports.some(e => e.name === name)

describe('TypeScript parser', () => {
  test('extracts imports from import statements', () => {
    const content = `
      import { foo } from './foo'
      import bar from '../bar'
    `
    const result = parseTypeScript(content, 'test.ts')
    expect(hasImport(result.imports, './foo')).toBe(true)
    expect(hasImport(result.imports, '../bar')).toBe(true)
  })

  test('extracts exports from export statements', () => {
    const content = `
      export function myFunc() {}
      export const myConst = 1
      export class MyClass {}
      export type MyType = string
    `
    const result = parseTypeScript(content, 'test.ts')
    expect(hasExport(result.exports, 'myFunc')).toBe(true)
    expect(hasExport(result.exports, 'myConst')).toBe(true)
    expect(hasExport(result.exports, 'MyClass')).toBe(true)
    expect(hasExport(result.exports, 'MyType')).toBe(true)
  })

  test('handles default exports', () => {
    const content = `export default function main() {}`
    const result = parseTypeScript(content, 'test.ts')
    expect(hasExport(result.exports, 'main')).toBe(true)
    expect(result.exports.some(e => e.isDefault)).toBe(true)
  })

  test('handles empty file', () => {
    const result = parseTypeScript('', 'test.ts')
    expect(result.imports).toEqual([])
    expect(result.exports).toEqual([])
  })

  test('returns correct language', () => {
    const result = parseTypeScript('export const x = 1', 'test.ts')
    expect(result.language).toBe('typescript')
  })

  test('returns correct path', () => {
    const result = parseTypeScript('', 'src/foo.ts')
    expect(result.path).toBe('src/foo.ts')
  })
})

describe('Python parser', () => {
  test('extracts function definitions', () => {
    const content = `
def my_function():
    pass

async def async_func():
    pass
    `
    const result = parsePython(content, 'test.py')
    expect(hasExport(result.exports, 'my_function')).toBe(true)
    expect(hasExport(result.exports, 'async_func')).toBe(true)
  })

  test('handles empty file', () => {
    const result = parsePython('', 'test.py')
    expect(result.exports).toEqual([])
  })

  test('returns correct language', () => {
    const result = parsePython('def foo(): pass', 'test.py')
    expect(result.language).toBe('python')
  })
})

describe('Go parser', () => {
  test('extracts imports from import statements', () => {
    const content = `
package main

import (
  "fmt"
  "os"
  "github.com/user/pkg"
)
    `
    const result = parseGo(content, 'main.go')
    expect(hasImport(result.imports, 'fmt')).toBe(true)
    expect(hasImport(result.imports, 'os')).toBe(true)
    expect(hasImport(result.imports, 'github.com/user/pkg')).toBe(true)
  })

  test('handles empty file', () => {
    const result = parseGo('', 'main.go')
    expect(result.imports).toEqual([])
    expect(result.exports).toEqual([])
  })

  test('returns correct language', () => {
    const result = parseGo('package main', 'main.go')
    expect(result.language).toBe('go')
  })
})

describe('Rust parser', () => {
  test('extracts use statements as imports', () => {
    const content = `
use std::io;
use crate::module;
use super::parent;
    `
    const result = parseRust(content, 'lib.rs')
    expect(hasImport(result.imports, 'std::io')).toBe(true)
    expect(hasImport(result.imports, 'crate::module')).toBe(true)
    expect(hasImport(result.imports, 'super::parent')).toBe(true)
  })

  test('extracts pub functions as exports', () => {
    const content = `
pub fn public_func() {}
fn private_func() {}
    `
    const result = parseRust(content, 'lib.rs')
    expect(hasExport(result.exports, 'public_func')).toBe(true)
    expect(hasExport(result.exports, 'private_func')).toBe(false)
  })

  test('extracts pub structs as exports', () => {
    const content = `
pub struct PublicStruct {}
struct PrivateStruct {}
    `
    const result = parseRust(content, 'lib.rs')
    expect(hasExport(result.exports, 'PublicStruct')).toBe(true)
    expect(hasExport(result.exports, 'PrivateStruct')).toBe(false)
  })

  test('extracts pub enums as exports', () => {
    const content = `
pub enum PublicEnum {}
enum PrivateEnum {}
    `
    const result = parseRust(content, 'lib.rs')
    expect(hasExport(result.exports, 'PublicEnum')).toBe(true)
    expect(hasExport(result.exports, 'PrivateEnum')).toBe(false)
  })

  test('handles empty file', () => {
    const result = parseRust('', 'lib.rs')
    expect(result.imports).toEqual([])
    expect(result.exports).toEqual([])
  })

  test('returns correct language', () => {
    const result = parseRust('fn main() {}', 'main.rs')
    expect(result.language).toBe('rust')
  })
})
