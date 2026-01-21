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
} from "@accountability/core/accounting/AccountTemplate"
import { type Account, AccountId } from "@accountability/core/accounting/Account"
import { Company, CompanyId } from "@accountability/core/company/Company"
import { OrganizationId } from "@accountability/core/organization/Organization"
import { AccountRepository } from "@accountability/persistence/Services/AccountRepository"
import { CompanyRepository } from "@accountability/persistence/Services/CompanyRepository"
import { AppApi } from "../Definitions/AppApi.ts"
import {
  AccountTemplateItem,
  TemplateAccountItem
} from "../Definitions/AccountTemplatesApi.ts"
import {
  AuditLogError,
  UserLookupError
} from "../Definitions/ApiErrors.ts"
import { CompanyNotFoundError } from "@accountability/core/company/CompanyErrors"
import { AccountsAlreadyExistError } from "@accountability/core/accounting/AccountErrors"
import type { AuditLogError as CoreAuditLogError, UserLookupError as CoreUserLookupError } from "@accountability/core/audit/AuditLogErrors"
import { requireOrganizationContext, requirePermission } from "./OrganizationContextMiddlewareLive.ts"
import { AuditLogService } from "@accountability/core/audit/AuditLogService"
import { CurrentUserId } from "@accountability/core/shared/context/CurrentUserId"

const mapCoreAuditErrorToApi = (error: CoreAuditLogError | CoreUserLookupError): AuditLogError | UserLookupError => {
  if (error._tag === "UserLookupError") {
    return new UserLookupError({
      userId: error.userId,
      cause: error.cause
    })
  }
  return new AuditLogError({
    operation: error.operation,
    cause: error.cause
  })
}

/**
 * Helper to log account creation to audit log
 *
 * Uses the AuditLogService and CurrentUserId from the Effect context.
 * Per AUDIT_PAGE.md spec: audit logging must NOT silently fail.
 * If audit logging fails, the operation fails - this ensures audit trail integrity.
 *
 * @param organizationId - The organization this account belongs to
 * @param account - The created account
 * @returns Effect that completes when audit logging succeeds
 */
const logAccountCreate = (
  organizationId: string,
  account: Account
): Effect.Effect<void, AuditLogError | UserLookupError, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    yield* auditService.logCreate(
      organizationId,
      "Account",
      account.id,
      account.name, // Human-readable account name for audit display
      account,
      userId
    )
  }).pipe(
    Effect.mapError(mapCoreAuditErrorToApi)
  )

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
        requireOrganizationContext(_.payload.organizationId,
          Effect.gen(function* () {
            // Check permission - creating accounts requires account:create
            yield* requirePermission("account:create")

            const { organizationId: orgIdString, companyId: companyIdString } = _.payload
            const organizationId = OrganizationId.make(orgIdString)
            const companyId = CompanyId.make(companyIdString)

            // Validate company exists within organization
            // Persistence errors are unexpected (defects), so use orDie
            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(
              Effect.orDie
            )
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new CompanyNotFoundError({
                companyId: companyIdString
              }))
            }

            // Check if company already has accounts
            const existingAccounts = yield* accountRepo.findByCompany(organizationId, companyId).pipe(
              Effect.orDie
            )
            if (existingAccounts.length > 0) {
              return yield* Effect.fail(new AccountsAlreadyExistError({
                companyId: companyIdString,
                accountCount: existingAccounts.length
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

            // Create all accounts in the database and log each to audit trail
            let createdCount = 0
            let retainedEarningsAccountId: AccountId | null = null
            for (const account of accounts) {
              const createdAccount = yield* accountRepo.create(account).pipe(
                Effect.orDie
              )
              // Log each account creation to audit trail
              yield* logAccountCreate(orgIdString, createdAccount)
              createdCount++

              // Track the retained earnings account for company auto-configuration
              if (createdAccount.isRetainedEarnings) {
                retainedEarningsAccountId = createdAccount.id
              }
            }

            // Auto-set company's retained earnings account if one was found
            if (retainedEarningsAccountId) {
              const existingCompany = maybeCompany.value
              const updatedCompany = Company.make({
                ...existingCompany,
                retainedEarningsAccountId: Option.some(retainedEarningsAccountId)
              })
              yield* companyRepo.update(organizationId, updatedCompany).pipe(Effect.orDie)
            }

            return {
              createdCount,
              companyId: companyIdString,
              templateType: _.path.type
            }
          })
        )
      )
  })
)
