/**
 * Report - Generate viability reports
 */

import type { CodebaseIndex, Finding } from './types'
import type { Analysis } from './analyzer'

export interface ReportOptions {
  format: 'markdown' | 'json'
  verbose: boolean
}

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'

function emoji(score: number): string {
  return score >= 8 ? '+' : score >= 5 ? '~' : '-'
}

function color(severity: string): string {
  return severity === 'HIGH' ? RED : severity === 'MEDIUM' ? YELLOW : CYAN
}

export function generateReport(
  projectName: string,
  index: CodebaseIndex,
  analysis: Analysis,
  options: ReportOptions
): string {
  if (options.format === 'json') {
    return JSON.stringify({
      project: projectName,
      files: index.files.size,
      lines: index.totalLoc,
      scores: analysis.scores,
      findings: analysis.findings,
      axioms: analysis.axioms,
      posiwid: analysis.posiwid,
      algedonic: {
        errorSources: analysis.algedonic.paths.length,
        alertCoverage: analysis.algedonic.coverage,
        silentZones: analysis.algedonic.silentZones,
        paths: analysis.algedonic.paths.slice(0, 20), // Top 20 paths
      },
    }, null, 2)
  }

  const lines: string[] = []
  const { scores } = analysis

  // Header
  lines.push('')
  lines.push(`${BOLD}GapCheck Report${RESET}`)
  lines.push('='.repeat(50))
  lines.push(`${DIM}Project:${RESET} ${projectName}`)
  lines.push(`${DIM}Files:${RESET}   ${index.files.size} (${index.totalLoc.toLocaleString()} LOC)`)
  lines.push(`${DIM}Score:${RESET}   ${scores.overall}/100`)
  lines.push('')

  // VSM Scores
  lines.push(`${BOLD}VSM Assessment${RESET}`)
  lines.push('-'.repeat(50))
  lines.push(`${emoji(scores.s1Operations)} S1 Operations:   ${scores.s1Operations.toFixed(1)}/10`)
  lines.push(`${emoji(scores.s2Coordination)} S2 Coordination: ${scores.s2Coordination.toFixed(1)}/10`)
  lines.push(`${emoji(scores.s3Control)} S3 Control:      ${scores.s3Control.toFixed(1)}/10`)
  lines.push(`${emoji(scores.s3StarAudit)} S3* Audit:       ${scores.s3StarAudit.toFixed(1)}/10`)
  lines.push(`${emoji(scores.s4Intelligence)} S4 Intelligence: ${scores.s4Intelligence.toFixed(1)}/10`)
  lines.push(`${emoji(scores.s5Identity)} S5 Identity:     ${scores.s5Identity.toFixed(1)}/10`)
  lines.push('')

  // Axioms
  lines.push(`${BOLD}Viability Axioms${RESET}`)
  lines.push('-'.repeat(50))
  for (const ax of analysis.axioms) {
    lines.push(`${ax.ok ? '+' : '-'} Axiom ${ax.axiom}: ${ax.message}`)
  }
  lines.push('')

  // Algedonic Channels (Pain Signal Paths)
  const alg = analysis.algedonic
  if (alg.paths.length > 0) {
    const alertPct = Math.round(alg.coverage * 100)
    const logOnly = alg.paths.filter(p => p.reachesLog && !p.reachesAlert).length
    const swallowed = alg.paths.filter(p => p.swallowed).length

    lines.push(`${BOLD}Algedonic Channels${RESET}`)
    lines.push('-'.repeat(50))
    lines.push(`${alertPct >= 50 ? '+' : alertPct >= 20 ? '~' : '-'} ${alg.paths.length} error sources traced`)
    lines.push(`  ${alertPct}% reach alerting services`)
    if (logOnly > 0) lines.push(`  ${DIM}${logOnly} reach logs only${RESET}`)
    if (swallowed > 0) lines.push(`  ${RED}${swallowed} swallowed silently${RESET}`)

    // Show example paths
    if (options.verbose && alg.paths.length > 0) {
      lines.push('')
      const examples = alg.paths.slice(0, 5)
      for (const p of examples) {
        const src = `${p.source.file}:${p.source.line}`
        lines.push(`  ${DIM}${src} → ${p.terminal}${RESET}`)
      }
    }

    // Silent zones
    if (alg.silentZones.length > 0) {
      lines.push(`  ${RED}Silent zones: ${alg.silentZones.slice(0, 3).join(', ')}${RESET}`)
    }
    lines.push('')
  } else {
    lines.push(`${emoji(analysis.painSignals.coverage * 10)} Pain Signals: ${analysis.painSignals.strength}`)
    lines.push('')
  }

  // POSIWID
  if (analysis.posiwid.untestedComplexFunctions > 0) {
    lines.push(`${BOLD}POSIWID${RESET}`)
    lines.push('-'.repeat(50))
    lines.push(`${analysis.posiwid.untestedComplexFunctions} complex functions without tests`)
    for (const f of analysis.posiwid.findings.slice(0, 3)) {
      lines.push(`  ${DIM}${f.file}: ${f.function}()${RESET}`)
    }
    lines.push('')
  }

  // Findings
  const high = analysis.findings.filter(f => f.severity === 'HIGH')
  const medium = analysis.findings.filter(f => f.severity === 'MEDIUM')
  const low = analysis.findings.filter(f => f.severity === 'LOW')

  if (analysis.findings.length > 0) {
    lines.push(`${BOLD}Findings${RESET}`)
    lines.push('-'.repeat(50))

    const show = (findings: Finding[], limit = 5) => {
      const list = options.verbose ? findings : findings.slice(0, limit)
      for (const f of list) {
        lines.push(`  ${color(f.severity)}[${f.system}]${RESET} ${f.message}`)
      }
      if (!options.verbose && findings.length > limit) {
        lines.push(`  ${DIM}... ${findings.length - limit} more${RESET}`)
      }
    }

    if (high.length) {
      lines.push(`${RED}HIGH (${high.length})${RESET}`)
      show(high)
    }
    if (medium.length) {
      lines.push(`${YELLOW}MEDIUM (${medium.length})${RESET}`)
      show(medium)
    }
    if (low.length && options.verbose) {
      lines.push(`${CYAN}LOW (${low.length})${RESET}`)
      show(low)
    } else if (low.length) {
      lines.push(`${DIM}+ ${low.length} LOW findings (use -v)${RESET}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
