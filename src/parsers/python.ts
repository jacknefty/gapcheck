/**
 * Python Parser
 *
 * Extracts variety information from Python files:
 * - Imports (import x, from x import y)
 * - Exports (public symbols - no underscore prefix)
 * - Symbols (functions, classes)
 */

import type { LanguageParser, ParsedFile, ImportInfo, ExportInfo, SymbolInfo } from './types'

export const pythonParser: LanguageParser = {
  languages: ['python'],
  extensions: ['.py', '.pyw'],

  parse(content: string, filePath: string): ParsedFile {
    return {
      path: filePath,
      language: 'python',
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

  // import x, import x.y
  const importPattern = /^import\s+([\w.]+(?:\s*,\s*[\w.]+)*)/gm
  let match
  while ((match = importPattern.exec(content)) !== null) {
    const modules = match[1].split(',').map(m => m.trim())
    for (const mod of modules) {
      imports.push({
        source: mod,
        isLocal: mod.startsWith('.'),
      })
    }
  }

  // from x import y, z
  const fromPattern = /^from\s+([\w.]+)\s+import\s+([^#\n]+)/gm
  while ((match = fromPattern.exec(content)) !== null) {
    const source = match[1]
    const symbolsPart = match[2].trim()

    // Handle parenthesized imports
    let symbols: string[] = []
    if (symbolsPart === '(') {
      // Multi-line import, extract until closing paren
      const multiLineMatch = content.slice(match.index).match(/from\s+[\w.]+\s+import\s+\(([^)]+)\)/)
      if (multiLineMatch) {
        symbols = multiLineMatch[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean)
      }
    } else if (symbolsPart !== '*') {
      symbols = symbolsPart.split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean)
    }

    imports.push({
      source,
      isLocal: source.startsWith('.'),
      symbols: symbols.length > 0 ? symbols : undefined,
    })
  }

  return imports
}

function extractExports(content: string): ExportInfo[] {
  const exports: ExportInfo[] = []

  // Check for __all__ definition
  const allMatch = content.match(/__all__\s*=\s*\[([^\]]+)\]/)
  if (allMatch) {
    const names = allMatch[1].match(/['"](\w+)['"]/g) || []
    for (const name of names) {
      const cleanName = name.replace(/['"]/g, '')
      exports.push({
        name: cleanName,
        kind: 'other',
      })
    }
    return exports // If __all__ is defined, it's the authoritative export list
  }

  // Otherwise, public symbols (no leading underscore) are exports
  const symbols = extractSymbols(content, '')
  for (const sym of symbols) {
    if (!sym.name.startsWith('_')) {
      exports.push({
        name: sym.name,
        kind: sym.kind === 'method' ? 'function' : sym.kind,
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

    // Function definitions
    const funcMatch = line.match(/^(\s*)(?:async\s+)?def\s+(\w+)\s*\(/)
    if (funcMatch) {
      const indent = funcMatch[1].length
      const name = funcMatch[2]
      const isMethod = indent > 0 // Methods are indented

      symbols.push({
        name,
        kind: isMethod ? 'method' : 'function',
        line: lineNum,
        exported: !name.startsWith('_'),
        documentation: extractDocstring(lines, i),
      })
    }

    // Class definitions
    const classMatch = line.match(/^class\s+(\w+)/)
    if (classMatch) {
      symbols.push({
        name: classMatch[1],
        kind: 'class',
        line: lineNum,
        exported: !classMatch[1].startsWith('_'),
        documentation: extractDocstring(lines, i),
      })
    }

    // Top-level constants (UPPER_CASE)
    const constMatch = line.match(/^([A-Z][A-Z0-9_]*)\s*=/)
    if (constMatch) {
      symbols.push({
        name: constMatch[1],
        kind: 'constant',
        line: lineNum,
        exported: true,
      })
    }

    // Type aliases (using TypeAlias or simple assignment with type hint)
    const typeMatch = line.match(/^(\w+)(?:\s*:\s*TypeAlias)?\s*=\s*(?:Union|Optional|List|Dict|Tuple|Type|Callable)/)
    if (typeMatch && !line.includes('(')) {
      symbols.push({
        name: typeMatch[1],
        kind: 'type',
        line: lineNum,
        exported: !typeMatch[1].startsWith('_'),
      })
    }
  }

  return symbols
}

function extractDocstring(lines: string[], lineIndex: number): string | undefined {
  // Look for docstring after function/class definition
  let i = lineIndex + 1
  while (i < lines.length && !lines[i].trim()) i++

  if (i >= lines.length) return undefined

  const line = lines[i].trim()

  // Single line docstring
  const singleMatch = line.match(/^(['"]){3}(.+)\1{3}$/)
  if (singleMatch) {
    return singleMatch[2].trim()
  }

  // Multi-line docstring
  if (line.startsWith('"""') || line.startsWith("'''")) {
    const quote = line.slice(0, 3)
    const docLines: string[] = [line.slice(3)]

    i++
    while (i < lines.length && !lines[i].includes(quote)) {
      docLines.push(lines[i])
      i++
    }

    if (i < lines.length) {
      const lastLine = lines[i]
      const endIdx = lastLine.indexOf(quote)
      if (endIdx > 0) {
        docLines.push(lastLine.slice(0, endIdx))
      }
    }

    return docLines.join('\n').trim()
  }

  return undefined
}

function countLoc(content: string): number {
  let inMultiLineString = false
  let multiLineChar = ''

  return content.split('\n').filter(line => {
    const trimmed = line.trim()

    // Track multi-line strings
    if (!inMultiLineString) {
      if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
        multiLineChar = trimmed.slice(0, 3)
        if (trimmed.slice(3).includes(multiLineChar)) {
          // Single line docstring
          return false
        }
        inMultiLineString = true
        return false
      }
    } else {
      if (trimmed.includes(multiLineChar)) {
        inMultiLineString = false
      }
      return false
    }

    // Skip empty lines and comments
    return trimmed && !trimmed.startsWith('#')
  }).length
}
