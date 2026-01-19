/**
 * Company - Re-export from canonical location
 *
 * This file provides the new import path for Company domain entities
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module company/Company
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
} from "../Domains/Company.ts"
