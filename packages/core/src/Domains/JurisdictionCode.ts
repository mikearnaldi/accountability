/**
 * JurisdictionCode - Re-export from canonical location
 *
 * This file re-exports from the canonical location for backward compatibility.
 * New code should import from @accountability/core/jurisdiction/JurisdictionCode
 *
 * @deprecated Import from @accountability/core/jurisdiction/JurisdictionCode instead
 * @module Domains/JurisdictionCode
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
} from "../jurisdiction/JurisdictionCode.ts"
