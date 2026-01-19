/**
 * CompanyType - Re-export from canonical location
 *
 * This file re-exports from the canonical location for backward compatibility.
 * New code should import from @accountability/core/company/CompanyType
 *
 * @deprecated Import from @accountability/core/company/CompanyType instead
 * @module Domains/CompanyType
 */

export {
  CompanyType,
  isCompanyType,
  COMPANY_TYPE_DISPLAY_NAMES,
  ALL_COMPANY_TYPES
} from "../company/CompanyType.ts"
