/**
 * Flow Tracing - Trace actual paths through code
 *
 * Beer's diagnosis requires tracing channels, not just detecting presence.
 * This module traces:
 * - Algedonic channels: error source → handler → destination
 * - Config channels: definition → usage sites
 */

import type { CodebaseIndex, CodeFile } from '../types'
import type { Language } from '../parsers/types'

// ============================================================
// ALGEDONIC CHANNEL TRACING
// ============================================================

export interface ErrorSource {
  file: string
  line: number
  type: 'throw' | 'reject' | 'panic' | 'raise' | 'error'
  context: string // surrounding code snippet
}

export interface ErrorHandler {
  file: string
  line: number
  type: 'catch' | 'except' | 'recover' | 'unwrap'
  action: 'log' | 'alert' | 'propagate' | 'swallow' | 'unknown'
}

export interface AlgedonicPath {
  source: ErrorSource
  handlers: ErrorHandler[]
  reachesAlert: boolean
  reachesLog: boolean
  swallowed: boolean
  terminal: string // where does this path end?
}

export interface AlgedonicAnalysis {
  paths: AlgedonicPath[]
  coverage: number // % of error sources that reach alerts
  silentZones: string[] // files where errors are swallowed
  brokenChannels: string[] // errors that go nowhere
}

/** Language-specific error patterns */
const ERROR_PATTERNS: Record<string, { source: RegExp; handler: RegExp }> = {
  typescript: {
    source: /\b(throw\s+new\s+\w+|throw\s+\w+|Promise\.reject|reject\()/g,
    handler: /\bcatch\s*\(|\.catch\s*\(/g,
  },
  javascript: {
    source: /\b(throw\s+new\s+\w+|throw\s+\w+|Promise\.reject|reject\()/g,
    handler: /\bcatch\s*\(|\.catch\s*\(/g,
  },
  python: {
    source: /\braise\s+\w+/g,
    handler: /\bexcept\s*[\w\s,]*:/g,
  },
  go: {
    source: /\bpanic\s*\(|errors\.New\s*\(|fmt\.Errorf\s*\(/g,
    handler: /\brecover\s*\(\)|if\s+err\s*!=\s*nil/g,
  },
  rust: {
    source: /\bpanic!\s*\(|Err\s*\(/g,
    handler: /\.unwrap_or|\.expect\s*\(|\?|match.*Err/g,
  },
}

/** Patterns that indicate alerting services */
const ALERT_PATTERNS = /sentry|bugsnag|rollbar|pagerduty|opsgenie|alertmanager|captureException|captureError|notify|sendAlert/i

/** Patterns that indicate logging */
const LOG_PATTERNS = /console\.(log|warn|error|info)|logger\.|log\.(info|warn|error|debug|fatal)|logging\.|print\(|println!/i

/** Find all error sources in a file */
function findErrorSources(file: CodeFile): ErrorSource[] {
  const sources: ErrorSource[] = []
  const pattern = ERROR_PATTERNS[file.language]?.source
  if (!pattern) return sources

  const lines = file.content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(line)) !== null) {
      sources.push({
        file: file.path,
        line: i + 1,
        type: categorizeError(match[0], file.language),
        context: line.trim().slice(0, 80),
      })
    }
  }

  return sources
}

function categorizeError(match: string, lang: Language): ErrorSource['type'] {
  if (/throw/i.test(match)) return 'throw'
  if (/reject/i.test(match)) return 'reject'
  if (/panic/i.test(match)) return 'panic'
  if (/raise/i.test(match)) return 'raise'
  return 'error'
}

/** Find all error handlers in a file and what they do */
function findErrorHandlers(file: CodeFile): ErrorHandler[] {
  const handlers: ErrorHandler[] = []
  const pattern = ERROR_PATTERNS[file.language]?.handler
  if (!pattern) return handlers

  const lines = file.content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    pattern.lastIndex = 0

    if (pattern.test(line)) {
      // Look at next few lines to determine action
      const block = lines.slice(i, Math.min(i + 10, lines.length)).join('\n')
      const action = determineHandlerAction(block)

      handlers.push({
        file: file.path,
        line: i + 1,
        type: categorizeHandler(line, file.language),
        action,
      })
    }
  }

  return handlers
}

function categorizeHandler(line: string, lang: Language): ErrorHandler['type'] {
  if (/catch/i.test(line)) return 'catch'
  if (/except/i.test(line)) return 'except'
  if (/recover/i.test(line)) return 'recover'
  if (/unwrap/i.test(line)) return 'unwrap'
  return 'catch'
}

function determineHandlerAction(block: string): ErrorHandler['action'] {
  if (ALERT_PATTERNS.test(block)) return 'alert'
  if (LOG_PATTERNS.test(block)) return 'log'
  if (/throw|raise|panic|return\s+err|Err\(/.test(block)) return 'propagate'
  if (/^\s*\}\s*$/.test(block) || /pass\s*$/.test(block) || /\/\/\s*ignore/i.test(block)) return 'swallow'
  return 'unknown'
}

/** Trace error paths through the codebase */
export function traceAlgedonicChannels(index: CodebaseIndex): AlgedonicAnalysis {
  const allSources: ErrorSource[] = []
  const allHandlers = new Map<string, ErrorHandler[]>()
  const paths: AlgedonicPath[] = []
  const silentZones = new Set<string>()
  const brokenChannels: string[] = []

  // Collect all sources and handlers
  for (const file of index.files.values()) {
    const sources = findErrorSources(file)
    const handlers = findErrorHandlers(file)
    allSources.push(...sources)
    if (handlers.length) allHandlers.set(file.path, handlers)
  }

  // Trace each error source
  for (const source of allSources) {
    const path = tracePath(source, index, allHandlers)
    paths.push(path)

    if (path.swallowed) {
      silentZones.add(source.file)
    }
    if (!path.reachesAlert && !path.reachesLog && path.handlers.length === 0) {
      brokenChannels.push(`${source.file}:${source.line}`)
    }
  }

  // Calculate coverage
  const alertReaching = paths.filter(p => p.reachesAlert).length
  const coverage = allSources.length > 0 ? alertReaching / allSources.length : 1

  return {
    paths,
    coverage,
    silentZones: [...silentZones],
    brokenChannels,
  }
}

/** Trace a single error's path through the code */
function tracePath(
  source: ErrorSource,
  index: CodebaseIndex,
  handlers: Map<string, ErrorHandler[]>
): AlgedonicPath {
  const visited = new Set<string>()
  const pathHandlers: ErrorHandler[] = []
  let reachesAlert = false
  let reachesLog = false
  let swallowed = false
  let terminal = 'unhandled'

  // Find the NEAREST handler after the error source in same file
  const sourceHandlers = handlers.get(source.file) || []
  const nearestHandler = sourceHandlers
    .filter(h => h.line > source.line)
    .sort((a, b) => a.line - b.line)[0]

  if (nearestHandler) {
    pathHandlers.push(nearestHandler)
    if (nearestHandler.action === 'alert') {
      reachesAlert = true
      terminal = 'alert service'
    } else if (nearestHandler.action === 'log') {
      reachesLog = true
      terminal = 'log only'
    } else if (nearestHandler.action === 'swallow') {
      swallowed = true
      terminal = 'swallowed'
    }
    // If propagate or unknown, continue to importers
  }

  // If not handled locally (or propagated), check importing files
  if (!reachesAlert && !reachesLog && !swallowed) {
    const file = index.files.get(source.file)
    if (file) {
      for (const importerPath of file.importedBy) {
        if (visited.has(importerPath)) continue
        visited.add(importerPath)

        // Find nearest handler in importer
        const importerHandlers = handlers.get(importerPath) || []
        const importerHandler = importerHandlers[0] // First handler in file
        if (importerHandler) {
          pathHandlers.push(importerHandler)
          if (importerHandler.action === 'alert') {
            reachesAlert = true
            terminal = `alert via ${importerPath}`
            break
          } else if (importerHandler.action === 'log') {
            reachesLog = true
            terminal = `log in ${importerPath}`
          } else if (importerHandler.action === 'swallow') {
            swallowed = true
            terminal = `swallowed in ${importerPath}`
          }
        }
      }
    }
  }

  return {
    source,
    handlers: pathHandlers,
    reachesAlert,
    reachesLog,
    swallowed,
    terminal,
  }
}

// ============================================================
// CONFIG FLOW TRACING (S3 → S1)
// ============================================================

export interface ConfigSource {
  file: string
  line: number
  type: 'env' | 'config' | 'flag' | 'constant'
  name: string
}

export interface ConfigUsage {
  file: string
  line: number
  context: string
}

export interface ConfigPath {
  source: ConfigSource
  usages: ConfigUsage[]
  unusedConfig: boolean
}

export interface ConfigAnalysis {
  paths: ConfigPath[]
  unusedConfigs: string[]
  unconfiguredFiles: string[] // files with hardcoded values that should be config
}

/** Config definition patterns */
const CONFIG_PATTERNS = {
  env: /process\.env\.(\w+)|os\.environ\[['"](\w+)['"]\]|os\.Getenv\(['"](\w+)['"]\)/g,
  config: /config\.(\w+)|settings\.(\w+)|CONFIG\[['"](\w+)['"]\]/g,
}

export function traceConfigFlow(index: CodebaseIndex): ConfigAnalysis {
  const sources: ConfigSource[] = []
  const usagesByName = new Map<string, ConfigUsage[]>()

  // Find config definitions and usages
  for (const file of index.files.values()) {
    const lines = file.content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Check for env vars
      CONFIG_PATTERNS.env.lastIndex = 0
      let match
      while ((match = CONFIG_PATTERNS.env.exec(line)) !== null) {
        const name = match[1] || match[2] || match[3]
        sources.push({
          file: file.path,
          line: i + 1,
          type: 'env',
          name,
        })

        const usage: ConfigUsage = { file: file.path, line: i + 1, context: line.trim().slice(0, 60) }
        const existing = usagesByName.get(name) || []
        existing.push(usage)
        usagesByName.set(name, existing)
      }
    }
  }

  // Build paths
  const paths: ConfigPath[] = []
  const seen = new Set<string>()

  for (const source of sources) {
    if (seen.has(source.name)) continue
    seen.add(source.name)

    const usages = usagesByName.get(source.name) || []
    paths.push({
      source,
      usages,
      unusedConfig: usages.length <= 1, // Only defined, not used elsewhere
    })
  }

  return {
    paths,
    unusedConfigs: paths.filter(p => p.unusedConfig).map(p => p.source.name),
    unconfiguredFiles: [], // TODO: detect hardcoded values
  }
}
