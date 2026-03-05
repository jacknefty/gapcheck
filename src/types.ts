/**
 * GapCheck Types - Core data structures
 */

import type { ParsedFile, Language } from './parsers/types'

// ============================================================
// INPUT
// ============================================================

export interface CodeFile {
  path: string
  language: Language
  imports: string[]
  importedBy: string[]
  exports: string[]
  loc: number
  content: string
  parsed: ParsedFile
}

export interface CodebaseIndex {
  root: string
  files: Map<string, CodeFile>
  totalLoc: number
  languages: Map<Language, { files: number; loc: number }>
}

// ============================================================
// OUTPUT
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
