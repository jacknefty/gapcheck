/**
 * Parser Types - Language-agnostic extraction interface
 *
 * Every language parser extracts the same variety information:
 * - What does this file consume? (imports/dependencies)
 * - What does this file produce? (exports/public symbols)
 * - What are the key symbols? (functions, classes, types)
 *
 * The VSM analysis layer doesn't care about language -
 * only about variety flows.
 */

export interface ParsedFile {
  /** Relative path */
  path: string
  /** Language identifier */
  language: Language
  /** Dependencies this file consumes (variety in) */
  imports: ImportInfo[]
  /** Symbols this file produces (variety out) */
  exports: ExportInfo[]
  /** All significant symbols defined */
  symbols: SymbolInfo[]
  /** Lines of code (excluding blanks/comments) */
  loc: number
  /** Raw content for pattern matching */
  content: string
}

export interface ImportInfo {
  /** The import path/module */
  source: string
  /** Is it a local file or external package? */
  isLocal: boolean
  /** Specific symbols imported (if applicable) */
  symbols?: string[]
}

export interface ExportInfo {
  /** Exported symbol name */
  name: string
  /** What kind of export */
  kind: 'function' | 'class' | 'type' | 'interface' | 'variable' | 'constant' | 'module' | 'other'
  /** Is it the default export? */
  isDefault?: boolean
}

export interface SymbolInfo {
  name: string
  kind: 'function' | 'class' | 'type' | 'interface' | 'variable' | 'constant' | 'method'
  line: number
  exported: boolean
  documentation?: string
}

export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'c'
  | 'cpp'
  | 'csharp'
  | 'ruby'
  | 'php'
  | 'swift'
  | 'kotlin'
  | 'unknown'

export interface LanguageParser {
  /** Languages this parser handles */
  languages: Language[]
  /** File extensions this parser handles */
  extensions: string[]
  /** Parse a file and extract variety information */
  parse(content: string, filePath: string): ParsedFile
}

/**
 * Detect language from file extension
 */
export function detectLanguage(filePath: string): Language {
  const ext = '.' + (filePath.split('.').pop() || '').toLowerCase()

  const extMap: Record<string, Language> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.py': 'python',
    '.pyw': 'python',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
    '.c': 'c',
    '.h': 'c',
    '.cpp': 'cpp',
    '.cc': 'cpp',
    '.cxx': 'cpp',
    '.hpp': 'cpp',
    '.cs': 'csharp',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.kts': 'kotlin',
  }

  return extMap[ext] || 'unknown'
}
