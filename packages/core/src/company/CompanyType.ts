/**
 * CompanyType - Re-export from canonical location
 *
 * This file provides the new import path for CompanyType value object
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module company/CompanyType
 */

export {
  CompanyType,
  isCompanyType,
  COMPANY_TYPE_DISPLAY_NAMES,
  ALL_COMPANY_TYPES
} from "../Domains/CompanyType.ts"
