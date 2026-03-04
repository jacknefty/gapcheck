/**
 * Rust Parser
 *
 * Extracts variety information from Rust files:
 * - Imports (use statements)
 * - Exports (pub items)
 * - Symbols (fn, struct, enum, trait, impl)
 */

import type { LanguageParser, ParsedFile, ImportInfo, ExportInfo, SymbolInfo } from './types'

export const rustParser: LanguageParser = {
  languages: ['rust'],
  extensions: ['.rs'],

  parse(content: string, filePath: string): ParsedFile {
    return {
      path: filePath,
      language: 'rust',
      imports: extractImports(content),
      exports: extractExports(content),
      symbols: extractSymbols(content, filePath),
      loc: countLoc(content),
      content,
    }
  },
}

function extractImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = []

  // use statements: use crate::path, use std::io, use super::module
  const usePattern = /use\s+((?:crate|self|super|std|[\w_]+)(?:::\w+)*(?:::\{[^}]+\})?(?:::\*)?)/g
  let match
  while ((match = usePattern.exec(content)) !== null) {
    const source = match[1]

    // Determine if local
    const isLocal = source.startsWith('crate::') ||
                   source.startsWith('self::') ||
                   source.startsWith('super::')

    // Extract symbols from {a, b, c} syntax
    const braceMatch = source.match(/::?\{([^}]+)\}/)
    let symbols: string[] | undefined
    if (braceMatch) {
      symbols = braceMatch[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean)
    }

    imports.push({
      source: source.replace(/::?\{[^}]+\}/, ''),
      isLocal,
      symbols,
    })
  }

  // extern crate (older style)
  const externPattern = /extern\s+crate\s+(\w+)/g
  while ((match = externPattern.exec(content)) !== null) {
    imports.push({
      source: match[1],
      isLocal: false,
    })
  }

  return imports
}

function extractExports(content: string): ExportInfo[] {
  const exports: ExportInfo[] = []

  // In Rust, `pub` items are exports
  const symbols = extractSymbols(content, '')

  for (const sym of symbols) {
    if (sym.exported) {
      exports.push({
        name: sym.name,
        kind: sym.kind,
      })
    }
  }

  return exports
}

function extractSymbols(content: string, filePath: string): SymbolInfo[] {
  const symbols: SymbolInfo[] = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    // Functions: fn name or pub fn name or pub(crate) fn name
    const fnMatch = line.match(/^\s*(pub(?:\([^)]+\))?\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+(\w+)/)
    if (fnMatch) {
      symbols.push({
        name: fnMatch[2],
        kind: 'function',
        line: lineNum,
        exported: line.includes('pub'),
        documentation: extractDocComment(lines, i),
      })
    }

    // Structs: struct Name or pub struct Name
    const structMatch = line.match(/^\s*(pub(?:\([^)]+\))?\s+)?struct\s+(\w+)/)
    if (structMatch) {
      symbols.push({
        name: structMatch[2],
        kind: 'class', // Structs are closest to classes
        line: lineNum,
        exported: line.includes('pub'),
        documentation: extractDocComment(lines, i),
      })
    }

    // Enums: enum Name or pub enum Name
    const enumMatch = line.match(/^\s*(pub(?:\([^)]+\))?\s+)?enum\s+(\w+)/)
    if (enumMatch) {
      symbols.push({
        name: enumMatch[2],
        kind: 'type',
        line: lineNum,
        exported: line.includes('pub'),
        documentation: extractDocComment(lines, i),
      })
    }

    // Traits: trait Name or pub trait Name
    const traitMatch = line.match(/^\s*(pub(?:\([^)]+\))?\s+)?trait\s+(\w+)/)
    if (traitMatch) {
      symbols.push({
        name: traitMatch[2],
        kind: 'interface',
        line: lineNum,
        exported: line.includes('pub'),
        documentation: extractDocComment(lines, i),
      })
    }

    // Type aliases: type Name = or pub type Name =
    const typeMatch = line.match(/^\s*(pub(?:\([^)]+\))?\s+)?type\s+(\w+)\s*=/)
    if (typeMatch) {
      symbols.push({
        name: typeMatch[2],
        kind: 'type',
        line: lineNum,
        exported: line.includes('pub'),
        documentation: extractDocComment(lines, i),
      })
    }

    // Constants: const NAME: Type = or pub const NAME
    const constMatch = line.match(/^\s*(pub(?:\([^)]+\))?\s+)?const\s+(\w+)\s*:/)
    if (constMatch) {
      symbols.push({
        name: constMatch[2],
        kind: 'constant',
        line: lineNum,
        exported: line.includes('pub'),
      })
    }

    // Static variables: static NAME: Type
    const staticMatch = line.match(/^\s*(pub(?:\([^)]+\))?\s+)?static\s+(?:mut\s+)?(\w+)\s*:/)
    if (staticMatch) {
      symbols.push({
        name: staticMatch[2],
        kind: 'variable',
        line: lineNum,
        exported: line.includes('pub'),
      })
    }
  }

  return symbols
}

function extractDocComment(lines: string[], lineIndex: number): string | undefined {
  const comments: string[] = []
  let i = lineIndex - 1

  // Collect preceding /// doc comments
  while (i >= 0) {
    const line = lines[i].trim()
    if (line.startsWith('///')) {
      comments.unshift(line.replace(/^\/\/\/\s?/, ''))
      i--
    } else if (line.startsWith('//!') || line === '') {
      i--
    } else {
      break
    }
  }

  if (comments.length === 0) return undefined
  return comments.join('\n')
}

function countLoc(content: string): number {
  let inBlockComment = false

  return content.split('\n').filter(line => {
    const trimmed = line.trim()

    // Track block comments
    if (inBlockComment) {
      if (trimmed.includes('*/')) {
        inBlockComment = false
      }
      return false
    }

    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) {
        inBlockComment = true
      }
      return false
    }

    // Skip empty lines and line comments
    return trimmed && !trimmed.startsWith('//')
  }).length
}
