/**
 * Scanner - Multi-language file discovery and parsing
 *
 * Uses language-specific parsers to extract variety information
 * from any supported language. The VSM analysis layer receives
 * the same data structure regardless of source language.
 */

import { getSupportedExtensions, parseFile, getLanguageStats, type Language } from './parsers'
import type { CodeFile, CodebaseIndex } from './types'

// Re-export domain types for convenience
export type { CodeFile, CodebaseIndex } from './types'

/**
 * Discover all source files in a directory
 */
export async function discoverFiles(rootPath: string): Promise<string[]> {
  const extensions = getSupportedExtensions()

  const proc = Bun.spawn([
    'find', '.', '-type', 'f',
    '(', ...extensions.flatMap(ext => ['-name', `*${ext}`, '-o']).slice(0, -1), ')',
    '-not', '-path', '*/node_modules/*',
    '-not', '-path', '*/.git/*',
    '-not', '-path', '*/dist/*',
    '-not', '-path', '*/build/*',
    '-not', '-path', '*/.next/*',
    '-not', '-path', '*/__pycache__/*',
    '-not', '-path', '*/target/*',
    '-not', '-path', '*/.claude/*',
    '-not', '-path', '*/venv/*',
    '-not', '-path', '*/.venv/*',
    '-not', '-path', '*/vendor/*',
    '-not', '-path', '*/.cargo/*',
    '-not', '-name', '*.d.ts',
    '-not', '-name', '*.min.js',
    '-not', '-name', '*.generated.*',
    '-not', '-name', '*_test.go',      // Go test files (optional)
    '-not', '-name', '*_pb.go',        // Protobuf generated
    '-not', '-name', '*.pb.go',
  ], {
    cwd: rootPath,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const stdout = await new Response(proc.stdout).text()
  return stdout.trim().split('\n').filter(Boolean).map(f => f.replace('./', ''))
}

/**
 * Resolve an import path to an actual file in the index
 */
function resolveImport(
  importSource: string,
  fromDir: string,
  files: Map<string, CodeFile>,
  language: Language
): string | null {
  // Skip external packages
  if (!importSource.startsWith('.') && !importSource.startsWith('/')) {
    // For Go, Python etc, non-relative imports might still be local
    if (language === 'go' && importSource.startsWith('crate')) {
      // Handle Rust crate imports
    } else if (language === 'python' && !importSource.includes('.')) {
      // Could be a local module
      const possiblePath = importSource.replace(/\./g, '/') + '.py'
      if (files.has(possiblePath)) return possiblePath
    }
    return null
  }

  // Resolve relative path
  const parts = [...fromDir.split('/').filter(Boolean), ...importSource.split('/')]
  const resolved: string[] = []

  for (const part of parts) {
    if (part === '.') continue
    if (part === '..') {
      resolved.pop()
    } else {
      resolved.push(part)
    }
  }

  const basePath = resolved.join('/')

  // Try exact match
  if (files.has(basePath)) return basePath

  // Try with extensions based on language
  const extensions: Record<Language, string[]> = {
    typescript: ['.ts', '.tsx', '.js', '.jsx'],
    javascript: ['.js', '.jsx', '.ts', '.tsx'],
    python: ['.py'],
    go: ['.go'],
    rust: ['.rs'],
    java: ['.java'],
    c: ['.c', '.h'],
    cpp: ['.cpp', '.cc', '.cxx', '.hpp', '.h'],
    csharp: ['.cs'],
    ruby: ['.rb'],
    php: ['.php'],
    swift: ['.swift'],
    kotlin: ['.kt', '.kts'],
    unknown: [],
  }

  const exts = extensions[language] || []
  for (const ext of exts) {
    if (files.has(basePath + ext)) return basePath + ext
  }

  // Try index files (for JS/TS)
  if (language === 'typescript' || language === 'javascript') {
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      if (files.has(`${basePath}/index${ext}`)) return `${basePath}/index${ext}`
    }
  }

  // Try __init__.py for Python
  if (language === 'python') {
    if (files.has(`${basePath}/__init__.py`)) return `${basePath}/__init__.py`
  }

  // Try mod.rs for Rust
  if (language === 'rust') {
    if (files.has(`${basePath}/mod.rs`)) return `${basePath}/mod.rs`
  }

  return null
}

/**
 * Build complete codebase index
 */
export async function buildIndex(rootPath: string): Promise<CodebaseIndex> {
  const index: CodebaseIndex = {
    root: rootPath,
    files: new Map(),
    totalLoc: 0,
    languages: new Map(),
  }

  const filePaths = await discoverFiles(rootPath)
  const parsedFiles: ParsedFile[] = []

  // First pass: parse all files
  for (const filePath of filePaths) {
    try {
      const fullPath = `${rootPath}/${filePath}`
      const content = await Bun.file(fullPath).text()

      const parsed = parseFile(content, filePath)
      if (!parsed) continue

      parsedFiles.push(parsed)

      // Extract local imports only
      const dir = filePath.split('/').slice(0, -1).join('/')
      const localImports = parsed.imports
        .filter(imp => imp.isLocal)
        .map(imp => imp.source)

      const codeFile: CodeFile = {
        path: filePath,
        language: parsed.language,
        imports: localImports,
        importedBy: [],
        exports: parsed.exports.map(e => e.name),
        loc: parsed.loc,
        content,
        parsed,
      }

      index.files.set(filePath, codeFile)
      index.totalLoc += parsed.loc
    } catch {
      // Skip unreadable files
    }
  }

  // Second pass: resolve imports and build importedBy
  for (const [filePath, file] of index.files) {
    const dir = filePath.split('/').slice(0, -1).join('/')
    const resolvedImports: string[] = []

    for (const imp of file.imports) {
      const resolved = resolveImport(imp, dir, index.files, file.language)
      if (resolved) {
        resolvedImports.push(resolved)
        const importedFile = index.files.get(resolved)
        if (importedFile && !importedFile.importedBy.includes(filePath)) {
          importedFile.importedBy.push(filePath)
        }
      }
    }

    file.imports = resolvedImports
  }

  // Calculate language stats
  index.languages = getLanguageStats(parsedFiles)

  return index
}
