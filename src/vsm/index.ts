/**
 * VSM Module Barrel
 */

export { analyzeVariety, type VarietyAnalysis } from './variety'
export { analyzeRecursion, type RecursionAnalysis } from './recursion'
export { analyzeS1, type S1Analysis } from './s1-operations'
export { analyzeS2, type S2Analysis } from './s2-coordination'
export { analyzeS3, type S3Analysis } from './s3-control'
export { analyzeS3Star, checkPainSignals, type S3StarAnalysis } from './s3-star-audit'
export { analyzeS4, type S4Analysis } from './s4-intelligence'
export { analyzeS5, type S5Analysis } from './s5-identity'
export { checkAxioms, type AxiomResult } from './axioms'
export { analyzePOSIWID, type POSIWIDAnalysis } from './posiwid'
export { traceAlgedonicChannels, traceConfigFlow, type AlgedonicAnalysis, type ConfigAnalysis, type AlgedonicPath } from './flow'
