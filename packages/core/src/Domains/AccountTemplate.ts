/**
 * AccountTemplate - Re-export from canonical location
 *
 * This file provides backward compatibility during the core package reorganization.
 * The canonical location is now: accounting/AccountTemplate.ts
 *
 * @module Domains/AccountTemplate
 * @deprecated Import from "@accountability/core/accounting/AccountTemplate" instead
 */

export {
  // TemplateAccountDefinition
  TemplateAccountDefinition,
  isTemplateAccountDefinition,

  // TemplateType
  TemplateType,
  isTemplateType,

  // AccountTemplate
  AccountTemplate,
  isAccountTemplate,

  // Predefined templates
  GeneralBusinessTemplate,
  ManufacturingTemplate,
  ServiceBusinessTemplate,
  HoldingCompanyTemplate,

  // Functions
  getTemplateByType,
  getAllTemplates,
  instantiateTemplate,
  instantiateTemplateEffect
} from "../accounting/AccountTemplate.ts"
