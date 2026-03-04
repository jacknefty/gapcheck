/**
 * Go Parser
 *
 * Extracts variety information from Go files:
 * - Imports (import "pkg")
 * - Exports (capitalized public symbols)
 * - Symbols (functions, types, structs)
 */

import type { LanguageParser, ParsedFile, ImportInfo, ExportInfo, SymbolInfo } from './types'

export const goParser: LanguageParser = {
  languages: ['go'],
  extensions: ['.go'],

  parse(content: string, filePath: string): ParsedFile {
    return {
      path: filePath,
      language: 'go',
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

  // Single import: import "fmt"
  const singlePattern = /import\s+"([^"]+)"/g
  let match
  while ((match = singlePattern.exec(content)) !== null) {
    imports.push({
      source: match[1],
      isLocal: match[1].startsWith('.') || match[1].startsWith('/') || !match[1].includes('/'),
    })
  }

  // Import block: import ( "fmt" "os" )
  const blockPattern = /import\s*\(([\s\S]*?)\)/g
  while ((match = blockPattern.exec(content)) !== null) {
    const block = match[1]
    const importLines = block.match(/(?:[\w.]+\s+)?"[^"]+"/g) || []

    for (const line of importLines) {
      const pathMatch = line.match(/"([^"]+)"/)
      if (pathMatch) {
        imports.push({
          source: pathMatch[1],
          isLocal: !pathMatch[1].includes('/') || pathMatch[1].startsWith('.'),
        })
      }
    }
  }

  return imports
}

function extractExports(content: string): ExportInfo[] {
  const exports: ExportInfo[] = []

  // In Go, exported symbols start with uppercase
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

    // Function: func Name(...) or func (r Receiver) Name(...)
    const funcMatch = line.match(/^func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(/)
    if (funcMatch) {
      const name = funcMatch[1]
      symbols.push({
        name,
        kind: 'function',
        line: lineNum,
        exported: /^[A-Z]/.test(name),
        documentation: extractComment(lines, i),
      })
    }

    // Type definitions: type Name struct/interface/...
    const typeMatch = line.match(/^type\s+(\w+)\s+(struct|interface|func|map|chan|\[|[a-z])/)
    if (typeMatch) {
      const name = typeMatch[1]
      const typeKind = typeMatch[2]

      symbols.push({
        name,
        kind: typeKind === 'interface' ? 'interface' : typeKind === 'struct' ? 'class' : 'type',
        line: lineNum,
        exported: /^[A-Z]/.test(name),
        documentation: extractComment(lines, i),
      })
    }

    // Constants: const Name = or const ( Name = )
    const constMatch = line.match(/^\s*const\s+(\w+)\s*(?:=|[a-zA-Z])/)
    if (constMatch) {
      const name = constMatch[1]
      symbols.push({
        name,
        kind: 'constant',
        line: lineNum,
        exported: /^[A-Z]/.test(name),
      })
    }

    // Var declarations: var Name Type
    const varMatch = line.match(/^\s*var\s+(\w+)\s+/)
    if (varMatch) {
      const name = varMatch[1]
      symbols.push({
        name,
        kind: 'variable',
        line: lineNum,
        exported: /^[A-Z]/.test(name),
      })
    }
  }

  // Handle const blocks
  const constBlockPattern = /const\s*\(([\s\S]*?)\)/g
  let match
  while ((match = constBlockPattern.exec(content)) !== null) {
    const block = match[1]
    const constLines = block.split('\n')

    for (const constLine of constLines) {
      const nameMatch = constLine.match(/^\s*(\w+)/)
      if (nameMatch && !nameMatch[1].startsWith('//')) {
        const name = nameMatch[1]
        if (!symbols.some(s => s.name === name)) {
          symbols.push({
            name,
            kind: 'constant',
            line: 0, // Approximate
            exported: /^[A-Z]/.test(name),
          })
        }
      }
    }
  }

  return symbols
}

function extractComment(lines: string[], lineIndex: number): string | undefined {
  const comments: string[] = []
  let i = lineIndex - 1

  // Collect preceding // comments
  while (i >= 0 && lines[i].trim().startsWith('//')) {
    comments.unshift(lines[i].trim().replace(/^\/\/\s?/, ''))
    i--
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
