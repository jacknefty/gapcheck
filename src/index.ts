#!/usr/bin/env bun
/**
 * GapCheck - Diagnose codebase viability using Stafford Beer's VSM
 *
 * Usage:
 *   gapcheck ./path/to/project
 *   npx gapcheck ./path/to/project
 *   claude mcp add gapcheck -- npx gapcheck --mcp
 */

import { buildIndex } from './scanner'
import { analyze } from './analyzer'
import { generateReport } from './report'
import { startMcpServer } from './mcp'
import { resolve, basename } from 'path'

const HELP = `
GapCheck - Codebase Viability Diagnosis

Usage:
  gapcheck <path>           Analyze a codebase
  gapcheck <path> --json    Output as JSON
  gapcheck <path> -v        Verbose output
  gapcheck --mcp            Start MCP server (for Claude Code)

Options:
  --json    Output report as JSON
  -v        Verbose mode (show all findings)
  --mcp     Run as MCP server for Claude Code integration
  --help    Show this help

Examples:
  gapcheck ./my-project
  gapcheck . --json > report.json
  gapcheck ../other-project -v

Claude Code Integration:
  claude mcp add gapcheck -- npx gapcheck --mcp
`

async function main() {
  const args = process.argv.slice(2)

  // MCP server mode
  if (args.includes('--mcp')) {
    await startMcpServer()
    return
  }

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(HELP)
    process.exit(0)
  }

  // Parse arguments
  const path = args.find(a => !a.startsWith('-'))
  const jsonOutput = args.includes('--json')
  const verbose = args.includes('-v') || args.includes('--verbose')

  if (!path) {
    console.error('Error: No path provided')
    console.log(HELP)
    process.exit(1)
  }

  const rootPath = resolve(path)
  const projectName = basename(rootPath)

  // Check if path exists
  const stat = await Bun.file(rootPath).exists().catch(() => false)
  if (!stat) {
    // Try as directory
    const proc = Bun.spawn(['test', '-d', rootPath])
    await proc.exited
    if (proc.exitCode !== 0) {
      console.error(`Error: Path not found: ${rootPath}`)
      process.exit(1)
    }
  }

  if (!jsonOutput) {
    console.log(`\nScanning ${projectName}...`)
  }

  const startTime = performance.now()

  // Build index
  const index = await buildIndex(rootPath)

  if (index.files.size === 0) {
    console.error('Error: No source files found')
    process.exit(1)
  }

  // Analyze
  const analysis = analyze(index)

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2)

  // Generate report
  const report = generateReport(projectName, index, analysis, {
    format: jsonOutput ? 'json' : 'markdown',
    verbose,
  })

  console.log(report)

  if (!jsonOutput) {
    console.log(`\x1b[2mCompleted in ${elapsed}s\x1b[0m`)
  }

  // Exit with error code if critical issues found
  const highSeverity = analysis.findings.filter(f => f.severity === 'HIGH').length
  if (highSeverity > 0) {
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
