/**
 * Company - Re-export from canonical location
 *
 * This file re-exports from the canonical location for backward compatibility.
 * New code should import from @accountability/core/company/Company
 *
 * @deprecated Import from @accountability/core/company/Company instead
 * @module Domains/Company
 */

export {
  CompanyId,
  isCompanyId,
  ConsolidationMethod,
  isConsolidationMethod,
  FiscalYearEnd,
  isFiscalYearEnd,
  CALENDAR_YEAR_END,
  FISCAL_YEAR_END_MARCH,
  FISCAL_YEAR_END_JUNE,
  FISCAL_YEAR_END_SEPTEMBER,
  Company,
  isCompany
} from "../company/Company.ts"
