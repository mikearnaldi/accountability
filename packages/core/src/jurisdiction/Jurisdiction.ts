/**
 * Jurisdiction - Re-export from canonical location
 *
 * This file provides the new import path for Jurisdiction domain entities
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module jurisdiction/Jurisdiction
 */

export {
  // TaxRate value
  TaxRate,
  isTaxRate,

  // TaxRule class
  TaxRule,
  isTaxRule,

  // FiscalYearEndMonth value
  FiscalYearEndMonth,
  isFiscalYearEndMonth,

  // TaxSettings class
  TaxSettings,
  isTaxSettings,

  // Jurisdiction class
  Jurisdiction,
  isJurisdiction,

  // Predefined tax settings
  US_TAX_SETTINGS,
  GB_TAX_SETTINGS,
  CA_TAX_SETTINGS,
  AU_TAX_SETTINGS,
  DE_TAX_SETTINGS,
  FR_TAX_SETTINGS,
  JP_TAX_SETTINGS,
  SG_TAX_SETTINGS,
  HK_TAX_SETTINGS,
  CH_TAX_SETTINGS,
  NL_TAX_SETTINGS,
  IE_TAX_SETTINGS,

  // Predefined jurisdictions
  US_JURISDICTION,
  GB_JURISDICTION,
  CA_JURISDICTION,
  AU_JURISDICTION,
  DE_JURISDICTION,
  FR_JURISDICTION,
  JP_JURISDICTION,
  SG_JURISDICTION,
  HK_JURISDICTION,
  CH_JURISDICTION,
  NL_JURISDICTION,
  IE_JURISDICTION,

  // Collections and lookup
  PREDEFINED_JURISDICTIONS,
  JURISDICTIONS_BY_CODE,
  getJurisdictionByCode
} from "../Domains/Jurisdiction.ts"
