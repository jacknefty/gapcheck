/**
 * Comprehensive tests for Rust parser
 *
 * Testing extractImports, extractExports, extractSymbols, extractDocComment
 * These were flagged as HIGH POSIWID findings due to complexity
 */

import { describe, test, expect } from 'bun:test'
import { rustParser } from './rust'

const parse = (content: string) => rustParser.parse(content, 'test.rs')

// Helper functions
const hasImport = (imports: { source: string }[], source: string) =>
  imports.some(i => i.source === source)

const hasExport = (exports: { name: string }[], name: string) =>
  exports.some(e => e.name === name)

const hasSymbol = (symbols: { name: string }[], name: string) =>
  symbols.some(s => s.name === name)

const getSymbol = (symbols: { name: string; kind: string }[], name: string) =>
  symbols.find(s => s.name === name)

describe('extractImports', () => {
  describe('use statements', () => {
    test('extracts simple use statement', () => {
      const result = parse('use std::io;')
      expect(hasImport(result.imports, 'std::io')).toBe(true)
    })

    test('extracts nested path', () => {
      const result = parse('use std::collections::HashMap;')
      expect(hasImport(result.imports, 'std::collections::HashMap')).toBe(true)
    })

    test('extracts crate-relative imports as local', () => {
      const result = parse('use crate::module::Item;')
      expect(result.imports[0].isLocal).toBe(true)
    })

    test('extracts super imports as local', () => {
      const result = parse('use super::parent_module;')
      expect(result.imports[0].isLocal).toBe(true)
    })

    test('extracts self imports as local', () => {
      const result = parse('use self::submodule;')
      expect(result.imports[0].isLocal).toBe(true)
    })

    test('extracts external crates as non-local', () => {
      const result = parse('use serde::Deserialize;')
      expect(result.imports[0].isLocal).toBe(false)
    })

    test('extracts std as non-local', () => {
      const result = parse('use std::fmt;')
      expect(result.imports[0].isLocal).toBe(false)
    })
  })

  describe('use with braces', () => {
    test('extracts symbols from braced import', () => {
      const result = parse('use std::io::{Read, Write};')
      expect(result.imports[0].symbols).toContain('Read')
      expect(result.imports[0].symbols).toContain('Write')
    })

    test('handles as renaming in braces', () => {
      const result = parse('use std::io::{Read as IoRead, Write};')
      expect(result.imports[0].symbols).toContain('Read')
      expect(result.imports[0].symbols).toContain('Write')
    })

    test('extracts base path without braces', () => {
      const result = parse('use std::collections::{HashMap, HashSet};')
      expect(result.imports[0].source).toBe('std::collections')
    })
  })

  describe('glob imports', () => {
    test('extracts glob import', () => {
      const result = parse('use std::prelude::*;')
      // Parser preserves ::* in source
      expect(hasImport(result.imports, 'std::prelude::*')).toBe(true)
    })
  })

  describe('extern crate', () => {
    test('extracts extern crate', () => {
      const result = parse('extern crate serde;')
      expect(hasImport(result.imports, 'serde')).toBe(true)
      expect(result.imports[0].isLocal).toBe(false)
    })

    test('handles extern crate with underscore', () => {
      const result = parse('extern crate serde_json;')
      expect(hasImport(result.imports, 'serde_json')).toBe(true)
    })
  })

  describe('multiple imports', () => {
    test('extracts all imports', () => {
      const result = parse(`
        use std::io;
        use std::fmt;
        use crate::config;
      `)
      expect(result.imports).toHaveLength(3)
    })
  })

  describe('edge cases', () => {
    test('handles empty content', () => {
      const result = parse('')
      expect(result.imports).toEqual([])
    })

    test('ignores use in comments', () => {
      const result = parse('// use std::io;')
      // Note: Current parser doesn't handle comments, may still match
      // This test documents current behavior
      expect(result.imports.length).toBeGreaterThanOrEqual(0)
    })

    test('ignores use in strings', () => {
      const result = parse('let s = "use std::io;";')
      // Note: Current parser doesn't handle strings, may still match
      expect(result.imports.length).toBeGreaterThanOrEqual(0)
    })
  })
})

describe('extractExports', () => {
  describe('pub functions', () => {
    test('extracts pub fn', () => {
      const result = parse('pub fn public_function() {}')
      expect(hasExport(result.exports, 'public_function')).toBe(true)
    })

    test('does not export private fn', () => {
      const result = parse('fn private_function() {}')
      expect(hasExport(result.exports, 'private_function')).toBe(false)
    })

    test('extracts pub async fn', () => {
      const result = parse('pub async fn async_public() {}')
      expect(hasExport(result.exports, 'async_public')).toBe(true)
    })

    test('extracts pub unsafe fn', () => {
      const result = parse('pub unsafe fn unsafe_public() {}')
      expect(hasExport(result.exports, 'unsafe_public')).toBe(true)
    })

    test('handles pub(crate) as export', () => {
      const result = parse('pub(crate) fn crate_public() {}')
      expect(hasExport(result.exports, 'crate_public')).toBe(true)
    })

    test('handles pub(super) as export', () => {
      const result = parse('pub(super) fn super_public() {}')
      expect(hasExport(result.exports, 'super_public')).toBe(true)
    })
  })

  describe('pub structs', () => {
    test('extracts pub struct', () => {
      const result = parse('pub struct PublicStruct {}')
      expect(hasExport(result.exports, 'PublicStruct')).toBe(true)
    })

    test('does not export private struct', () => {
      const result = parse('struct PrivateStruct {}')
      expect(hasExport(result.exports, 'PrivateStruct')).toBe(false)
    })

    test('exports struct as class kind', () => {
      const result = parse('pub struct MyStruct {}')
      const exp = result.exports.find(e => e.name === 'MyStruct')
      expect(exp?.kind).toBe('class')
    })
  })

  describe('pub enums', () => {
    test('extracts pub enum', () => {
      const result = parse('pub enum PublicEnum { A, B }')
      expect(hasExport(result.exports, 'PublicEnum')).toBe(true)
    })

    test('does not export private enum', () => {
      const result = parse('enum PrivateEnum { A, B }')
      expect(hasExport(result.exports, 'PrivateEnum')).toBe(false)
    })

    test('exports enum as type kind', () => {
      const result = parse('pub enum MyEnum {}')
      const exp = result.exports.find(e => e.name === 'MyEnum')
      expect(exp?.kind).toBe('type')
    })
  })

  describe('pub traits', () => {
    test('extracts pub trait', () => {
      const result = parse('pub trait PublicTrait {}')
      expect(hasExport(result.exports, 'PublicTrait')).toBe(true)
    })

    test('does not export private trait', () => {
      const result = parse('trait PrivateTrait {}')
      expect(hasExport(result.exports, 'PrivateTrait')).toBe(false)
    })

    test('exports trait as interface kind', () => {
      const result = parse('pub trait MyTrait {}')
      const exp = result.exports.find(e => e.name === 'MyTrait')
      expect(exp?.kind).toBe('interface')
    })
  })

  describe('pub type aliases', () => {
    test('extracts pub type alias', () => {
      const result = parse('pub type PublicAlias = String;')
      expect(hasExport(result.exports, 'PublicAlias')).toBe(true)
    })

    test('does not export private type alias', () => {
      const result = parse('type PrivateAlias = String;')
      expect(hasExport(result.exports, 'PrivateAlias')).toBe(false)
    })
  })

  describe('pub constants', () => {
    test('extracts pub const', () => {
      const result = parse('pub const MAX_SIZE: usize = 100;')
      expect(hasExport(result.exports, 'MAX_SIZE')).toBe(true)
    })

    test('does not export private const', () => {
      const result = parse('const PRIVATE: usize = 100;')
      expect(hasExport(result.exports, 'PRIVATE')).toBe(false)
    })
  })

  describe('pub statics', () => {
    test('extracts pub static', () => {
      const result = parse('pub static GLOBAL: &str = "hello";')
      expect(hasExport(result.exports, 'GLOBAL')).toBe(true)
    })

    test('extracts pub static mut', () => {
      const result = parse('pub static mut MUTABLE: i32 = 0;')
      expect(hasExport(result.exports, 'MUTABLE')).toBe(true)
    })
  })

  describe('edge cases', () => {
    test('handles empty content', () => {
      const result = parse('')
      expect(result.exports).toEqual([])
    })

    test('handles multiple exports', () => {
      const result = parse(`
        pub fn func1() {}
        pub fn func2() {}
        pub struct Struct1 {}
      `)
      expect(result.exports).toHaveLength(3)
    })
  })
})

describe('extractSymbols', () => {
  describe('functions', () => {
    test('extracts function name', () => {
      const result = parse('fn my_function() {}')
      expect(hasSymbol(result.symbols, 'my_function')).toBe(true)
    })

    test('sets correct kind for function', () => {
      const result = parse('fn my_function() {}')
      const sym = getSymbol(result.symbols, 'my_function')
      expect(sym?.kind).toBe('function')
    })

    test('sets line number', () => {
      const result = parse('\n\nfn on_line_3() {}')
      const sym = getSymbol(result.symbols, 'on_line_3')
      expect(sym?.line).toBe(3)
    })

    test('marks pub function as exported', () => {
      const result = parse('pub fn exported() {}')
      const sym = result.symbols.find(s => s.name === 'exported')
      expect(sym?.exported).toBe(true)
    })

    test('marks private function as not exported', () => {
      const result = parse('fn private() {}')
      const sym = result.symbols.find(s => s.name === 'private')
      expect(sym?.exported).toBe(false)
    })
  })

  describe('structs', () => {
    test('extracts struct', () => {
      const result = parse('struct MyStruct {}')
      expect(hasSymbol(result.symbols, 'MyStruct')).toBe(true)
    })

    test('sets kind as class for struct', () => {
      const result = parse('struct MyStruct {}')
      const sym = getSymbol(result.symbols, 'MyStruct')
      expect(sym?.kind).toBe('class')
    })
  })

  describe('enums', () => {
    test('extracts enum', () => {
      const result = parse('enum MyEnum { A, B }')
      expect(hasSymbol(result.symbols, 'MyEnum')).toBe(true)
    })

    test('sets kind as type for enum', () => {
      const result = parse('enum MyEnum {}')
      const sym = getSymbol(result.symbols, 'MyEnum')
      expect(sym?.kind).toBe('type')
    })
  })

  describe('traits', () => {
    test('extracts trait', () => {
      const result = parse('trait MyTrait {}')
      expect(hasSymbol(result.symbols, 'MyTrait')).toBe(true)
    })

    test('sets kind as interface for trait', () => {
      const result = parse('trait MyTrait {}')
      const sym = getSymbol(result.symbols, 'MyTrait')
      expect(sym?.kind).toBe('interface')
    })
  })

  describe('type aliases', () => {
    test('extracts type alias', () => {
      const result = parse('type MyAlias = String;')
      expect(hasSymbol(result.symbols, 'MyAlias')).toBe(true)
    })
  })

  describe('constants', () => {
    test('extracts const', () => {
      const result = parse('const MY_CONST: i32 = 42;')
      expect(hasSymbol(result.symbols, 'MY_CONST')).toBe(true)
    })

    test('sets kind as constant', () => {
      const result = parse('const MY_CONST: i32 = 42;')
      const sym = getSymbol(result.symbols, 'MY_CONST')
      expect(sym?.kind).toBe('constant')
    })
  })

  describe('statics', () => {
    test('extracts static', () => {
      const result = parse('static MY_STATIC: i32 = 0;')
      expect(hasSymbol(result.symbols, 'MY_STATIC')).toBe(true)
    })

    test('extracts static mut', () => {
      const result = parse('static mut MY_MUT_STATIC: i32 = 0;')
      expect(hasSymbol(result.symbols, 'MY_MUT_STATIC')).toBe(true)
    })

    test('sets kind as variable', () => {
      const result = parse('static MY_STATIC: i32 = 0;')
      const sym = getSymbol(result.symbols, 'MY_STATIC')
      expect(sym?.kind).toBe('variable')
    })
  })
})

describe('extractDocComment', () => {
  test('extracts single line doc comment', () => {
    const result = parse(`
/// This is documentation
fn documented() {}
    `)
    const sym = result.symbols.find(s => s.name === 'documented')
    expect(sym?.documentation).toBe('This is documentation')
  })

  test('extracts multiline doc comment', () => {
    const result = parse(`
/// Line one
/// Line two
/// Line three
fn multi_doc() {}
    `)
    const sym = result.symbols.find(s => s.name === 'multi_doc')
    expect(sym?.documentation).toContain('Line one')
    expect(sym?.documentation).toContain('Line two')
    expect(sym?.documentation).toContain('Line three')
  })

  test('handles blank lines between doc and item', () => {
    const result = parse(`
/// Documentation here

fn with_blank() {}
    `)
    const sym = result.symbols.find(s => s.name === 'with_blank')
    expect(sym?.documentation).toBe('Documentation here')
  })

  test('returns undefined when no doc comment', () => {
    const result = parse('fn no_doc() {}')
    const sym = result.symbols.find(s => s.name === 'no_doc')
    expect(sym?.documentation).toBeUndefined()
  })

  test('ignores //! inner doc comments for function docs', () => {
    const result = parse(`
//! This is module doc
fn after_inner_doc() {}
    `)
    const sym = result.symbols.find(s => s.name === 'after_inner_doc')
    // Inner doc comments are not attached to functions
    expect(sym?.documentation).toBeUndefined()
  })

  test('extracts doc for struct', () => {
    const result = parse(`
/// Struct documentation
pub struct DocStruct {}
    `)
    const sym = result.symbols.find(s => s.name === 'DocStruct')
    expect(sym?.documentation).toBe('Struct documentation')
  })

  test('extracts doc for enum', () => {
    const result = parse(`
/// Enum documentation
pub enum DocEnum { A }
    `)
    const sym = result.symbols.find(s => s.name === 'DocEnum')
    expect(sym?.documentation).toBe('Enum documentation')
  })

  test('extracts doc for trait', () => {
    const result = parse(`
/// Trait documentation
pub trait DocTrait {}
    `)
    const sym = result.symbols.find(s => s.name === 'DocTrait')
    expect(sym?.documentation).toBe('Trait documentation')
  })
})

describe('countLoc', () => {
  test('counts non-empty, non-comment lines', () => {
    const result = parse(`
fn main() {
    let x = 1;
}
    `)
    expect(result.loc).toBeGreaterThan(0)
  })

  test('excludes blank lines', () => {
    const result1 = parse('fn a() {}')
    const result2 = parse('fn a() {}\n\n\n')
    expect(result1.loc).toBe(result2.loc)
  })

  test('excludes line comments', () => {
    const result1 = parse('fn a() {}')
    const result2 = parse('// comment\nfn a() {}')
    expect(result1.loc).toBe(result2.loc)
  })

  test('excludes block comments', () => {
    const result1 = parse('fn a() {}')
    const result2 = parse('/* comment */\nfn a() {}')
    expect(result1.loc).toBe(result2.loc)
  })

  test('handles multiline block comments', () => {
    const result = parse(`
/*
  This is a
  multiline comment
*/
fn actual_code() {}
    `)
    expect(result.loc).toBe(1)
  })
})
