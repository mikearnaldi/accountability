/**
 * JurisdictionCode - Re-export from canonical location
 *
 * This file provides the new import path for JurisdictionCode value object
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module jurisdiction/JurisdictionCode
 */

export {
  JurisdictionCode,
  isJurisdictionCode,

  // Common jurisdiction codes
  US,
  GB,
  CA,
  AU,
  DE,
  FR,
  JP,
  CN,
  SG,
  HK,
  CH,
  NL,
  IE
} from "../Domains/JurisdictionCode.ts"
