/**
 * Multi-language Parser Registry
 *
 * Provides a unified interface for parsing any supported language.
 * The VSM analysis layer calls parseFile() and gets back the same
 * variety information regardless of source language.
 */

import type { LanguageParser, ParsedFile, Language } from './types'
import { detectLanguage } from './types'
import { typescriptParser } from './typescript'
import { pythonParser } from './python'
import { goParser } from './go'
import { rustParser } from './rust'

// Re-export types
export * from './types'

// Registry of all parsers
const parsers: LanguageParser[] = [
  typescriptParser,
  pythonParser,
  goParser,
  rustParser,
]

// Build extension -> parser map for fast lookup
const parserByExtension = new Map<string, LanguageParser>()
for (const parser of parsers) {
  for (const ext of parser.extensions) {
    parserByExtension.set(ext, parser)
  }
}

/**
 * Get all supported file extensions
 */
export function getSupportedExtensions(): string[] {
  return Array.from(parserByExtension.keys())
}

/**
 * Check if a file extension is supported
 */
export function isSupported(filePath: string): boolean {
  const ext = '.' + (filePath.split('.').pop() || '').toLowerCase()
  return parserByExtension.has(ext)
}

/**
 * Get parser for a file
 */
export function getParser(filePath: string): LanguageParser | null {
  const ext = '.' + (filePath.split('.').pop() || '').toLowerCase()
  return parserByExtension.get(ext) || null
}

/**
 * Parse a file and extract variety information
 */
export function parseFile(content: string, filePath: string): ParsedFile | null {
  const parser = getParser(filePath)
  if (!parser) return null

  try {
    return parser.parse(content, filePath)
  } catch (err) {
    // If parsing fails, return basic info
    console.warn(`[Parser] Failed to parse ${filePath}: ${err}`)
    return {
      path: filePath,
      language: detectLanguage(filePath),
      imports: [],
      exports: [],
      symbols: [],
      loc: content.split('\n').filter(l => l.trim()).length,
      content,
    }
  }
}

/**
 * Get language statistics from parsed files
 */
export function getLanguageStats(files: ParsedFile[]): Map<Language, { files: number; loc: number }> {
  const stats = new Map<Language, { files: number; loc: number }>()

  for (const file of files) {
    const existing = stats.get(file.language) || { files: 0, loc: 0 }
    existing.files++
    existing.loc += file.loc
    stats.set(file.language, existing)
  }

  return stats
}
