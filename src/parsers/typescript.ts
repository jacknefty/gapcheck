/**
 * TypeScript/JavaScript Parser
 */

import type { LanguageParser, ParsedFile, ImportInfo, ExportInfo, SymbolInfo } from './types'

export const typescriptParser: LanguageParser = {
  languages: ['typescript', 'javascript'],
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],

  parse(content: string, filePath: string): ParsedFile {
    const isTS = filePath.endsWith('.ts') || filePath.endsWith('.tsx')

    return {
      path: filePath,
      language: isTS ? 'typescript' : 'javascript',
      imports: extractImports(content, filePath),
      exports: extractExports(content),
      symbols: extractSymbols(content, filePath),
      loc: countLoc(content),
      content,
    }
  },
}

function extractImports(content: string, filePath: string): ImportInfo[] {
  const imports: ImportInfo[] = []
  const dir = filePath.split('/').slice(0, -1).join('/')

  // ES6 imports: import X from './path' or import { X } from './path'
  // Also handles: import type { X } from './path'
  const es6Pattern = /import\s+(?:type\s+)?(?:(\w+)(?:\s*,\s*)?)?(?:\{([^}]+)\})?\s*(?:from\s+)?['"]([^'"]+)['"]/g
  let match
  while ((match = es6Pattern.exec(content)) !== null) {
    const [, defaultImport, namedImports, source] = match
    const symbols: string[] = []

    if (defaultImport) symbols.push(defaultImport)
    if (namedImports) {
      symbols.push(...namedImports.split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean))
    }

    imports.push({
      source,
      isLocal: source.startsWith('.') || source.startsWith('/'),
      symbols: symbols.length > 0 ? symbols : undefined,
    })
  }

  // Side-effect imports: import './path'
  const sideEffectPattern = /import\s+['"]([^'"]+)['"]/g
  while ((match = sideEffectPattern.exec(content)) !== null) {
    if (!imports.some(i => i.source === match[1])) {
      imports.push({
        source: match[1],
        isLocal: match[1].startsWith('.') || match[1].startsWith('/'),
      })
    }
  }

  // CommonJS: require('./path')
  const cjsPattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((match = cjsPattern.exec(content)) !== null) {
    if (!imports.some(i => i.source === match[1])) {
      imports.push({
        source: match[1],
        isLocal: match[1].startsWith('.') || match[1].startsWith('/'),
      })
    }
  }

  // Dynamic imports: import('./path')
  const dynamicPattern = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((match = dynamicPattern.exec(content)) !== null) {
    if (!imports.some(i => i.source === match[1])) {
      imports.push({
        source: match[1],
        isLocal: match[1].startsWith('.') || match[1].startsWith('/'),
      })
    }
  }

  return imports
}

function extractExports(content: string): ExportInfo[] {
  const exports: ExportInfo[] = []

  // Named exports: export function X, export class X, export const X
  const patterns: Array<{ pattern: RegExp; kind: ExportInfo['kind'] }> = [
    { pattern: /export\s+(?:async\s+)?function\s+(\w+)/g, kind: 'function' },
    { pattern: /export\s+(?:abstract\s+)?class\s+(\w+)/g, kind: 'class' },
    { pattern: /export\s+interface\s+(\w+)/g, kind: 'interface' },
    { pattern: /export\s+type\s+(\w+)/g, kind: 'type' },
    { pattern: /export\s+const\s+(\w+)/g, kind: 'constant' },
    { pattern: /export\s+let\s+(\w+)/g, kind: 'variable' },
    { pattern: /export\s+var\s+(\w+)/g, kind: 'variable' },
    { pattern: /export\s+enum\s+(\w+)/g, kind: 'type' },
  ]

  for (const { pattern, kind } of patterns) {
    let match
    while ((match = pattern.exec(content)) !== null) {
      exports.push({ name: match[1], kind })
    }
  }

  // Default export
  if (/export\s+default/.test(content)) {
    // Try to find what's being exported
    const defaultMatch = content.match(/export\s+default\s+(?:class|function)?\s*(\w+)?/)
    exports.push({
      name: defaultMatch?.[1] || 'default',
      kind: 'other',
      isDefault: true,
    })
  }

  // Re-exports: export { X, Y } from './path'
  const reexportPattern = /export\s*\{([^}]+)\}(?:\s*from\s*['"][^'"]+['"])?/g
  let match
  while ((match = reexportPattern.exec(content)) !== null) {
    const names = match[1].split(',').map(n => {
      const parts = n.trim().split(/\s+as\s+/)
      return parts[parts.length - 1].trim()
    }).filter(Boolean)

    for (const name of names) {
      if (!exports.some(e => e.name === name)) {
        exports.push({ name, kind: 'other' })
      }
    }
  }

  // module.exports
  const cjsExport = content.match(/module\.exports\s*=\s*\{([^}]+)\}/s)
  if (cjsExport) {
    const names = cjsExport[1].split(',').map(n => n.trim().split(':')[0].trim()).filter(Boolean)
    for (const name of names) {
      if (!exports.some(e => e.name === name)) {
        exports.push({ name, kind: 'other' })
      }
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

    // Functions
    const funcMatch = line.match(/^(\s*)(?:export\s+)?(?:async\s+)?function\s+(\w+)/)
    if (funcMatch) {
      symbols.push({
        name: funcMatch[2],
        kind: 'function',
        line: lineNum,
        exported: line.includes('export'),
        documentation: extractDocComment(lines, i),
      })
    }

    // Arrow functions assigned to const
    const arrowMatch = line.match(/^(\s*)(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/)
    if (arrowMatch) {
      symbols.push({
        name: arrowMatch[2],
        kind: 'function',
        line: lineNum,
        exported: line.includes('export'),
        documentation: extractDocComment(lines, i),
      })
    }

    // Classes
    const classMatch = line.match(/^(\s*)(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/)
    if (classMatch) {
      symbols.push({
        name: classMatch[2],
        kind: 'class',
        line: lineNum,
        exported: line.includes('export'),
        documentation: extractDocComment(lines, i),
      })
    }

    // Interfaces
    const ifaceMatch = line.match(/^(\s*)(?:export\s+)?interface\s+(\w+)/)
    if (ifaceMatch) {
      symbols.push({
        name: ifaceMatch[2],
        kind: 'interface',
        line: lineNum,
        exported: line.includes('export'),
        documentation: extractDocComment(lines, i),
      })
    }

    // Types
    const typeMatch = line.match(/^(\s*)(?:export\s+)?type\s+(\w+)\s*=/)
    if (typeMatch) {
      symbols.push({
        name: typeMatch[2],
        kind: 'type',
        line: lineNum,
        exported: line.includes('export'),
        documentation: extractDocComment(lines, i),
      })
    }
  }

  return symbols
}

function extractDocComment(lines: string[], lineIndex: number): string | undefined {
  let i = lineIndex - 1
  while (i >= 0 && !lines[i].trim()) i--
  if (i < 0 || !lines[i].trim().endsWith('*/')) return undefined

  const commentLines: string[] = []
  while (i >= 0) {
    const line = lines[i].trim()
    commentLines.unshift(line)
    if (line.startsWith('/**')) break
    i--
  }

  if (commentLines.length === 0) return undefined

  return commentLines
    .join('\n')
    .replace(/^\/\*\*\s*/, '')
    .replace(/\s*\*\/$/, '')
    .replace(/^\s*\*\s?/gm, '')
    .trim()
}

function countLoc(content: string): number {
  return content.split('\n').filter(line => {
    const trimmed = line.trim()
    return trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*')
  }).length
}
