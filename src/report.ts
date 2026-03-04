/**
 * Report - Generate viability reports
 */

import type { CodebaseIndex } from './scanner'
import type { Analysis, Finding, VSMScores } from './analyzer'

export interface ReportOptions {
  format: 'markdown' | 'json'
  verbose: boolean
}

function scoreEmoji(score: number): string {
  if (score >= 8) return '+'
  if (score >= 5) return '~'
  return '-'
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'HIGH': return '\x1b[31m'
    case 'MEDIUM': return '\x1b[33m'
    case 'LOW': return '\x1b[36m'
    default: return '\x1b[0m'
  }
}

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'

function systemDescription(system: string): string {
  switch (system) {
    case 'S1': return 'Operations (viable units)'
    case 'S2': return 'Coordination (anti-oscillation)'
    case 'S3': return 'Control (inside & now)'
    case 'S3*': return 'Audit (observability)'
    case 'S4': return 'Intelligence (outside & then)'
    case 'S5': return 'Identity (closure)'
    default: return system
  }
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
      languages: Object.fromEntries(index.languages),
      scores: analysis.scores,
      findings: analysis.findings,
      variety: {
        totalVariety: analysis.variety.totalVariety,
        concentration: analysis.variety.concentration,
        imbalances: analysis.variety.imbalances.length,
      },
      recursion: {
        viableSubsystems: analysis.recursion.viableSubsystems,
        coupledSubsystems: analysis.recursion.coupledSubsystems,
      },
      circularDependencies: analysis.s2.circularDeps,
    }, null, 2)
  }

  const lines: string[] = []

  // Header
  lines.push('')
  lines.push(`${BOLD}GapCheck Viability Report${RESET}`)
  lines.push(`${'='.repeat(60)}`)
  lines.push('')
  lines.push(`${DIM}Project:${RESET}  ${projectName}`)
  lines.push(`${DIM}Scanned:${RESET}  ${index.files.size} files, ${index.totalLoc.toLocaleString()} lines`)

  // Language breakdown
  if (index.languages.size > 1) {
    const langs = Array.from(index.languages.entries())
      .sort((a, b) => b[1].loc - a[1].loc)
      .map(([lang, stats]) => `${lang} (${stats.files})`)
      .join(', ')
    lines.push(`${DIM}Languages:${RESET} ${langs}`)
  } else if (index.languages.size === 1) {
    const [lang] = index.languages.keys()
    lines.push(`${DIM}Language:${RESET} ${lang}`)
  }

  lines.push(`${DIM}Score:${RESET}    ${analysis.scores.overall}/100`)
  lines.push('')

  // Variety summary
  lines.push(`${BOLD}Variety Engineering${RESET}`)
  lines.push(`${'-'.repeat(60)}`)
  lines.push(`Total variety: ${analysis.variety.totalVariety} exports`)
  lines.push(`Concentration: ${(analysis.variety.concentration * 100).toFixed(0)}% ${analysis.variety.concentration > 0.5 ? '(high - bottleneck risk)' : '(distributed)'}`)
  if (analysis.recursion.viableSubsystems.length > 0) {
    lines.push(`Viable subsystems: ${analysis.recursion.viableSubsystems.slice(0, 3).join(', ')}${analysis.recursion.viableSubsystems.length > 3 ? '...' : ''}`)
  }
  lines.push('')

  // VSM Assessment
  lines.push(`${BOLD}VSM Assessment${RESET}`)
  lines.push(`${'-'.repeat(60)}`)
  lines.push('')

  const scores = analysis.scores
  lines.push(`${scoreEmoji(scores.s1Operations)} S1 Operations:    ${scores.s1Operations.toFixed(1)}/10  ${DIM}${systemDescription('S1')}${RESET}`)
  lines.push(`${scoreEmoji(scores.s2Coordination)} S2 Coordination:  ${scores.s2Coordination.toFixed(1)}/10  ${DIM}${systemDescription('S2')}${RESET}`)
  lines.push(`${scoreEmoji(scores.s3Control)} S3 Control:       ${scores.s3Control.toFixed(1)}/10  ${DIM}${systemDescription('S3')}${RESET}`)
  lines.push(`${scoreEmoji(scores.s3StarAudit)} S3* Audit:        ${scores.s3StarAudit.toFixed(1)}/10  ${DIM}${systemDescription('S3*')}${RESET}`)
  lines.push(`${scoreEmoji(scores.s4Intelligence)} S4 Intelligence:  ${scores.s4Intelligence.toFixed(1)}/10  ${DIM}${systemDescription('S4')}${RESET}`)
  lines.push(`${scoreEmoji(scores.s5Identity)} S5 Identity:      ${scores.s5Identity.toFixed(1)}/10  ${DIM}${systemDescription('S5')}${RESET}`)
  lines.push(`${scoreEmoji(scores.varietyBalance)} Variety Balance:  ${scores.varietyBalance.toFixed(1)}/10`)
  lines.push('')

  // Findings by severity
  const high = analysis.findings.filter(f => f.severity === 'HIGH')
  const medium = analysis.findings.filter(f => f.severity === 'MEDIUM')
  const low = analysis.findings.filter(f => f.severity === 'LOW')

  if (analysis.findings.length > 0) {
    lines.push(`${BOLD}Findings${RESET}`)
    lines.push(`${'-'.repeat(60)}`)
    lines.push('')

    const printFindings = (findings: Finding[], limit = 5) => {
      const shown = options.verbose ? findings : findings.slice(0, limit)
      for (const f of shown) {
        const color = severityColor(f.severity)
        lines.push(`  ${color}[${f.system}]${RESET} ${f.type}`)
        lines.push(`         ${DIM}${f.message}${RESET}`)
      }
      if (!options.verbose && findings.length > limit) {
        lines.push(`         ${DIM}... and ${findings.length - limit} more${RESET}`)
      }
    }

    if (high.length > 0) {
      lines.push(`${severityColor('HIGH')}HIGH (${high.length})${RESET}`)
      printFindings(high)
      lines.push('')
    }

    if (medium.length > 0) {
      lines.push(`${severityColor('MEDIUM')}MEDIUM (${medium.length})${RESET}`)
      printFindings(medium)
      lines.push('')
    }

    if (low.length > 0 && options.verbose) {
      lines.push(`${severityColor('LOW')}LOW (${low.length})${RESET}`)
      printFindings(low)
      lines.push('')
    } else if (low.length > 0) {
      lines.push(`${DIM}+ ${low.length} LOW severity findings (use -v to see)${RESET}`)
      lines.push('')
    }
  } else {
    lines.push(`${BOLD}No pathologies detected${RESET}`)
    lines.push('')
  }

  // Recommendations
  lines.push(`${BOLD}Recommendations${RESET}`)
  lines.push(`${'-'.repeat(60)}`)
  lines.push('')

  const recommendations: string[] = []

  // Based on scores
  if (scores.s1Operations < 5) {
    recommendations.push('Clarify operational boundaries - which modules could be hived off?')
  }
  if (scores.s2Coordination < 5) {
    recommendations.push('Add coordination mechanism (events, state management) to prevent oscillation')
  }
  if (analysis.s2.circularDeps.length > 0) {
    recommendations.push('Break circular dependencies via interface extraction')
  }
  if (scores.s3Control < 5) {
    recommendations.push('Add configuration management for resource allocation')
  }
  if (scores.s3StarAudit < 5) {
    recommendations.push('Add structured logging and error tracking (pino, Sentry)')
  }
  if (scores.s4Intelligence < 5) {
    recommendations.push('Add future-facing patterns: versioning, adapters, migration support')
  }
  if (scores.s5Identity < 5) {
    recommendations.push('Define core domain types in dedicated models directory')
  }
  if (analysis.variety.concentration > 0.5) {
    recommendations.push('Reduce variety concentration - too much flows through few modules')
  }

  if (recommendations.length === 0) {
    recommendations.push('System appears viable - maintain current practices')
  }

  for (let i = 0; i < Math.min(recommendations.length, 5); i++) {
    lines.push(`  ${i + 1}. ${recommendations[i]}`)
  }
  lines.push('')

  return lines.join('\n')
}
