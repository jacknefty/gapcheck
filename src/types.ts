/**
 * GapCheck Domain Types - What IS this system?
 *
 * This file defines the core identity of GapCheck:
 * - What it consumes (CodebaseIndex)
 * - What it produces (Analysis, Finding)
 * - What shapes are valid
 *
 * All other modules import from here. This IS GapCheck.
 */

import type { ParsedFile, Language } from './parsers/types'

// ============================================================
// INPUT: What GapCheck consumes
// ============================================================

export interface CodeFile {
  path: string
  language: Language
  imports: string[]       // Resolved local import paths
  importedBy: string[]    // Files that import this one
  exports: string[]       // Exported symbol names
  loc: number
  content: string
  /** Full parsed data for deeper analysis */
  parsed: ParsedFile
}

export interface CodebaseIndex {
  root: string
  files: Map<string, CodeFile>
  totalLoc: number
  /** Language breakdown */
  languages: Map<Language, { files: number; loc: number }>
}

// ============================================================
// OUTPUT: What GapCheck produces
// ============================================================

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW'

export interface Finding {
  system: 'S1' | 'S2' | 'S3' | 'S3*' | 'S4' | 'S5' | 'Variety' | 'Recursion'
  type: string
  severity: Severity
  message: string
  files: string[]
}

export interface VSMScores {
  s1Operations: number
  s2Coordination: number
  s3Control: number
  s3StarAudit: number
  s4Intelligence: number
  s5Identity: number
  varietyBalance: number
  overall: number
}

// Note: The full Analysis type includes implementation details
// from vsm/ modules (VarietyAnalysis, RecursionAnalysis, etc.)
// Those are defined in analyzer.ts which orchestrates them.
