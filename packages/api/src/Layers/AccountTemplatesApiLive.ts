/**
 * AccountTemplatesApiLive - Live implementation of account templates API handlers
 *
 * Implements the AccountTemplatesApi endpoints for listing and applying
 * chart of accounts templates to companies.
 *
 * @module AccountTemplatesApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import {
  getAllTemplates,
  getTemplateByType,
  instantiateTemplate
} from "@accountability/core/Domains/AccountTemplate"
import { AccountId } from "@accountability/core/Domains/Account"
import { CompanyId } from "@accountability/core/Domains/Company"
import { OrganizationId } from "@accountability/core/Domains/Organization"
import { AccountRepository } from "@accountability/persistence/Services/AccountRepository"
import { CompanyRepository } from "@accountability/persistence/Services/CompanyRepository"
import {
  type EntityNotFoundError,
  type PersistenceError
} from "@accountability/persistence/Errors/RepositoryError"
import { AppApi } from "../Definitions/AppApi.ts"
import {
  AccountTemplateItem,
  TemplateAccountItem
} from "../Definitions/AccountTemplatesApi.ts"
import {
  NotFoundError,
  BusinessRuleError
} from "../Definitions/ApiErrors.ts"

/**
 * Convert persistence errors to BusinessRuleError
 */
const mapPersistenceToBusinessRule = (
  error: EntityNotFoundError | PersistenceError
): BusinessRuleError => {
  return new BusinessRuleError({
    code: "PERSISTENCE_ERROR",
    message: error.message,
    details: Option.none()
  })
}

/**
 * AccountTemplatesApiLive - Layer providing AccountTemplatesApi handlers
 *
 * Dependencies:
 * - AccountRepository (for applying templates)
 * - CompanyRepository (for validating company exists)
 */
export const AccountTemplatesApiLive = HttpApiBuilder.group(AppApi, "accountTemplates", (handlers) =>
  Effect.gen(function* () {
    const accountRepo = yield* AccountRepository
    const companyRepo = yield* CompanyRepository

    return handlers
      .handle("listAccountTemplates", () =>
        Effect.gen(function* () {
          // Get all available templates
          const templates = getAllTemplates()

          // Convert to API response format
          const templateItems = templates.map(AccountTemplateItem.fromTemplate)

          return { templates: templateItems }
        })
      )
      .handle("getAccountTemplate", (_) =>
        Effect.gen(function* () {
          // Get template by type - this is a pure function, always succeeds
          const template = getTemplateByType(_.path.type)

          // Convert account definitions to API response format
          const accountItems = Chunk.toReadonlyArray(template.accounts).map(
            TemplateAccountItem.fromDefinition
          )

          return {
            template: {
              templateType: template.templateType,
              name: template.name,
              description: template.description,
              accounts: accountItems
            }
          }
        })
      )
      .handle("applyAccountTemplate", (_) =>
        Effect.gen(function* () {
          const { organizationId: orgIdString, companyId: companyIdString } = _.payload
          const organizationId = OrganizationId.make(orgIdString)
          const companyId = CompanyId.make(companyIdString)

          // Validate company exists within organization
          const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(
            Effect.mapError(mapPersistenceToBusinessRule)
          )
          if (Option.isNone(maybeCompany)) {
            return yield* Effect.fail(new NotFoundError({
              resource: "Company",
              id: companyIdString
            }))
          }

          // Check if company already has accounts
          const existingAccounts = yield* accountRepo.findByCompany(organizationId, companyId).pipe(
            Effect.mapError(mapPersistenceToBusinessRule)
          )
          if (existingAccounts.length > 0) {
            return yield* Effect.fail(new BusinessRuleError({
              code: "ACCOUNTS_ALREADY_EXIST",
              message: `Company already has ${existingAccounts.length} accounts. Cannot apply template to a company with existing accounts.`,
              details: Option.none()
            }))
          }

          // Get the template
          const template = getTemplateByType(_.path.type)

          // Instantiate the template for this company
          const accounts = instantiateTemplate(
            template,
            companyId,
            () => AccountId.make(crypto.randomUUID())
          )

          // Create all accounts in the database
          let createdCount = 0
          for (const account of accounts) {
            yield* accountRepo.create(account).pipe(
              Effect.mapError(mapPersistenceToBusinessRule)
            )
            createdCount++
          }

          return {
            createdCount,
            companyId: companyIdString,
            templateType: _.path.type
          }
        })
      )
  })
)
