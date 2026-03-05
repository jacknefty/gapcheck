/**
 * S5 Identity Analysis
 *
 * System Five = Closure of the system. Defines what the system IS.
 * Creates policy, maintains identity. The "variety sponge" that
 * absorbs residual variety through ethos and culture.
 *
 * "What does this system's identity? What makes it a coherent whole?"
 *
 * In code:
 * - Domain models (what IS this system about?)
 * - Type definitions (what shapes are valid?)
 * - Invariants and constraints (what must always be true?)
 * - Core abstractions (what concepts are fundamental?)
 * - Validation schemas (what is acceptable input?)
 *
 * Key question: Is the identity clear? Can you tell what this system IS?
 */

import type { CodebaseIndex } from '../types'
import type { VarietyProfile } from './variety'

export interface S5Finding {
  type: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  message: string
  files: string[]
}

export interface S5Analysis {
  score: number
  findings: S5Finding[]
  /** Core domain types found */
  domainTypes: string[]
  /** Validation/schema definitions */
  validationSchemas: string[]
  /** Identity clarity assessment */
  identityClarity: 'clear' | 'moderate' | 'unclear' | 'missing'
  /** Files that define core identity */
  identityFiles: string[]
}

/**
 * Find domain type definitions
 */
function findDomainTypes(index: CodebaseIndex): string[] {
  const types: string[] = []

  for (const [path, file] of index.files) {
    const content = file.content

    // TypeScript interfaces and types
    const interfaceMatches = content.match(/(?:export\s+)?interface\s+(\w+)/g) || []
    const typeMatches = content.match(/(?:export\s+)?type\s+(\w+)\s*=/g) || []

    for (const match of [...interfaceMatches, ...typeMatches]) {
      const name = match.replace(/export\s+/, '').replace(/interface\s+|type\s+|=/g, '').trim()
      // Filter out utility types
      if (!/^(Props|State|Options|Config|Params|Args|Result|Response|Request)$/i.test(name)) {
        types.push(`${path}: ${name}`)
      }
    }

    // Class definitions (potential domain entities)
    const classMatches = content.match(/(?:export\s+)?class\s+(\w+)/g) || []
    for (const match of classMatches) {
      const name = match.replace(/export\s+|class\s+/g, '').trim()
      types.push(`${path}: class ${name}`)
    }

    // Enums (bounded value sets)
    const enumMatches = content.match(/(?:export\s+)?enum\s+(\w+)/g) || []
    for (const match of enumMatches) {
      const name = match.replace(/export\s+|enum\s+/g, '').trim()
      types.push(`${path}: enum ${name}`)
    }
  }

  return types
}

/**
 * Find validation schemas (boundary enforcement)
 */
function findValidationSchemas(index: CodebaseIndex): string[] {
  const schemas: string[] = []

  for (const [path, file] of index.files) {
    const content = file.content

    // Zod schemas
    if (/z\.(object|string|number|boolean|array|enum)\(/i.test(content)) {
      schemas.push(`${path}: Zod schema`)
    }

    // Yup schemas
    if (/yup\.(object|string|number|boolean|array)\(/i.test(content)) {
      schemas.push(`${path}: Yup schema`)
    }

    // Joi schemas
    if (/Joi\.(object|string|number|boolean|array)\(/i.test(content)) {
      schemas.push(`${path}: Joi schema`)
    }

    // JSON Schema
    if (/"type"\s*:\s*"(object|string|number|boolean|array)"/.test(content)) {
      schemas.push(`${path}: JSON Schema`)
    }

    // Class-validator decorators
    if (/@Is(String|Number|Boolean|Email|URL|Date)|@Min|@Max|@Length/i.test(content)) {
      schemas.push(`${path}: class-validator`)
    }

    // TypeBox
    if (/Type\.(Object|String|Number|Boolean|Array)\(/i.test(content)) {
      schemas.push(`${path}: TypeBox schema`)
    }
  }

  return [...new Set(schemas)]
}

/**
 * Find files that likely define core identity
 */
function findIdentityFiles(
  index: CodebaseIndex,
  profiles: Map<string, VarietyProfile>
): string[] {
  const identityFiles: string[] = []

  for (const [path, profile] of profiles) {
    const file = index.files.get(path)!

    // Identity files typically:
    // 1. In domain/models/types/entities directories
    // 2. Have high fan-in (many depend on these definitions)
    // 3. Export types/interfaces more than functions

    const isDomainPath = /\/(domain|models?|types?|entities|core|schema)\//i.test('/' + path)
    const hasHighFanIn = profile.fanIn > 3

    // Check if mostly type exports
    const typeExports = (file.content.match(/export\s+(interface|type|enum|class)/g) || []).length
    const funcExports = (file.content.match(/export\s+(function|const|async)/g) || []).length
    const isMostlyTypes = typeExports > funcExports

    if (isDomainPath || (hasHighFanIn && isMostlyTypes)) {
      identityFiles.push(path)
    }
  }

  return identityFiles
}

/**
 * Check for identity erosion patterns
 */
function findIdentityErosion(index: CodebaseIndex): S5Finding[] {
  const findings: S5Finding[] = []

  let anyCount = 0
  let unknownCount = 0
  const filesWithAny: string[] = []

  for (const [path, file] of index.files) {
    const content = file.content

    // Excessive 'any' usage
    const anyMatches = content.match(/:\s*any\b/g) || []
    if (anyMatches.length > 0) {
      anyCount += anyMatches.length
      filesWithAny.push(path)
    }

    // 'unknown' without narrowing (lazy typing)
    const unknownMatches = content.match(/:\s*unknown\b/g) || []
    unknownCount += unknownMatches.length

    // Type assertions (bypassing type system)
    const assertionMatches = content.match(/as\s+(any|\w+)\b|<\w+>/g) || []
    if (assertionMatches.length > 5) {
      findings.push({
        type: 'Excessive-Assertions',
        severity: 'LOW',
        message: `${path}: ${assertionMatches.length} type assertions - may be circumventing identity`,
        files: [path],
      })
    }

    // Inconsistent naming (mixed conventions)
    const camelCase = (content.match(/\b[a-z]+[A-Z][a-zA-Z]*\b/g) || []).length
    const snakeCase = (content.match(/\b[a-z]+_[a-z]+\b/g) || []).length
    if (camelCase > 10 && snakeCase > 10) {
      findings.push({
        type: 'Inconsistent-Naming',
        severity: 'LOW',
        message: `${path}: Mixed naming conventions - identity confusion`,
        files: [path],
      })
    }
  }

  if (anyCount > 10) {
    findings.push({
      type: 'Any-Abuse',
      severity: 'HIGH',
      message: `${anyCount} uses of 'any' type across ${filesWithAny.length} files - identity erosion`,
      files: filesWithAny.slice(0, 5),
    })
  } else if (anyCount > 5) {
    findings.push({
      type: 'Any-Usage',
      severity: 'MEDIUM',
      message: `${anyCount} uses of 'any' type - consider stricter typing`,
      files: filesWithAny.slice(0, 3),
    })
  }

  return findings
}

/**
 * Assess identity clarity
 */
function assessIdentityClarity(
  domainTypes: string[],
  validationSchemas: string[],
  identityFiles: string[],
  fileCount: number
): 'clear' | 'moderate' | 'unclear' | 'missing' {
  const typeRatio = domainTypes.length / Math.max(fileCount, 1)
  const hasValidation = validationSchemas.length > 0
  const hasIdentityFiles = identityFiles.length > 0

  if (typeRatio > 0.5 && hasValidation && hasIdentityFiles) {
    return 'clear'
  } else if (typeRatio > 0.2 && (hasValidation || hasIdentityFiles)) {
    return 'moderate'
  } else if (domainTypes.length > 0) {
    return 'unclear'
  } else {
    return 'missing'
  }
}

/**
 * Analyze S5 health
 */
export function analyzeS5(
  index: CodebaseIndex,
  profiles: Map<string, VarietyProfile>
): S5Analysis {
  const findings: S5Finding[] = []
  let score = 10

  const domainTypes = findDomainTypes(index)
  const validationSchemas = findValidationSchemas(index)
  const identityFiles = findIdentityFiles(index, profiles)
  const erosionFindings = findIdentityErosion(index)

  const identityClarity = assessIdentityClarity(
    domainTypes,
    validationSchemas,
    identityFiles,
    index.files.size
  )

  // Check 1: Identity clarity
  switch (identityClarity) {
    case 'missing':
      score -= 4
      findings.push({
        type: 'S5-Missing',
        severity: 'HIGH',
        message: 'No domain types or identity files - what IS this system?',
        files: [],
      })
      break
    case 'unclear':
      score -= 2
      findings.push({
        type: 'S5-Unclear',
        severity: 'MEDIUM',
        message: 'Some types exist but identity is scattered and unclear',
        files: [],
      })
      break
    case 'moderate':
      score -= 1
      findings.push({
        type: 'S5-Partial',
        severity: 'LOW',
        message: 'Identity partially defined - could be stronger',
        files: identityFiles.slice(0, 3),
      })
      break
  }

  // Check 2: Boundary enforcement (validation)
  if (validationSchemas.length === 0 && index.files.size > 5) {
    score -= 1
    findings.push({
      type: 'No-Validation',
      severity: 'MEDIUM',
      message: 'No validation schemas - boundaries not enforced at runtime',
      files: [],
    })
  }

  // Check 3: Identity erosion
  for (const finding of erosionFindings) {
    if (finding.severity === 'HIGH') score -= 2
    else if (finding.severity === 'MEDIUM') score -= 1
    else score -= 0.5
    findings.push(finding)
  }

  // Check 4: Dedicated identity location
  if (identityFiles.length === 0 && domainTypes.length > 5) {
    score -= 1
    findings.push({
      type: 'Scattered-Identity',
      severity: 'LOW',
      message: 'Types exist but no dedicated domain/models directory',
      files: [],
    })
  }

  return {
    score: Math.max(0, Math.min(10, score)),
    findings,
    domainTypes,
    validationSchemas,
    identityClarity,
    identityFiles,
  }
}
