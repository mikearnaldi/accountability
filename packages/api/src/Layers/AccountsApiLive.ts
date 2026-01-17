/**
 * AccountsApiLive - Live implementation of accounts API handlers
 *
 * Implements the AccountsApi endpoints with real CRUD operations
 * by calling the AccountRepository and CompanyRepository.
 *
 * Path and URL params use domain types directly in the API schema,
 * so handlers receive already-decoded values (AccountId, CompanyId, etc.).
 * No manual Schema.decodeUnknownEither calls are needed.
 *
 * @module AccountsApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as Effect from "effect/Effect"
import * as Equal from "effect/Equal"
import * as Option from "effect/Option"
import {
  Account,
  AccountId,
  type AccountCategory
} from "@accountability/core/Domains/Account"
import { CompanyId } from "@accountability/core/Domains/Company"
import { OrganizationId } from "@accountability/core/Domains/Organization"
import { now as timestampNow } from "@accountability/core/Domains/Timestamp"
import { AccountRepository } from "@accountability/persistence/Services/AccountRepository"
import { CompanyRepository } from "@accountability/persistence/Services/CompanyRepository"
import {
  isEntityNotFoundError,
  type EntityNotFoundError,
  type PersistenceError
} from "@accountability/persistence/Errors/RepositoryError"
import { AppApi } from "../Definitions/AppApi.ts"
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  BusinessRuleError
} from "../Definitions/ApiErrors.ts"
import { requireOrganizationContext, requirePermission } from "./OrganizationContextMiddlewareLive.ts"

/**
 * Convert persistence errors to NotFoundError
 */
const mapPersistenceToNotFound = (
  resource: string,
  id: string,
  error: EntityNotFoundError | PersistenceError
): NotFoundError => {
  void error
  return new NotFoundError({ resource, id })
}

/**
 * Convert persistence errors to BusinessRuleError
 */
const mapPersistenceToBusinessRule = (
  error: EntityNotFoundError | PersistenceError
): BusinessRuleError => {
  if (isEntityNotFoundError(error)) {
    return new BusinessRuleError({
      code: "ENTITY_NOT_FOUND",
      message: error.message,
      details: Option.none()
    })
  }
  return new BusinessRuleError({
    code: "PERSISTENCE_ERROR",
    message: error.message,
    details: Option.none()
  })
}

/**
 * Convert persistence errors to ValidationError
 */
const mapPersistenceToValidation = (
  error: EntityNotFoundError | PersistenceError
): ValidationError => {
  return new ValidationError({
    message: error.message,
    field: Option.none(),
    details: Option.none()
  })
}

/**
 * AccountsApiLive - Layer providing AccountsApi handlers
 *
 * Dependencies:
 * - AccountRepository
 * - CompanyRepository
 */
export const AccountsApiLive = HttpApiBuilder.group(AppApi, "accounts", (handlers) =>
  Effect.gen(function* () {
    const accountRepo = yield* AccountRepository
    const companyRepo = yield* CompanyRepository

    return handlers
      .handle("listAccounts", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("account:read")

            // URL params are strings - convert to branded types
            const { accountType, accountCategory, isActive, isPostable, parentAccountId } = _.urlParams
            const organizationId = OrganizationId.make(_.urlParams.organizationId)
            const companyId = CompanyId.make(_.urlParams.companyId)
            const parentAcctId = parentAccountId !== undefined ? AccountId.make(parentAccountId) : undefined

            // Check company exists within organization
            const companyExists = yield* companyRepo.exists(organizationId, companyId).pipe(
              Effect.mapError((e) => mapPersistenceToValidation(e))
            )
            if (!companyExists) {
              return yield* Effect.fail(new NotFoundError({ resource: "Company", id: _.urlParams.companyId }))
            }

            // Get accounts based on filters
            let accounts: ReadonlyArray<Account>

            if (accountType !== undefined) {
              accounts = yield* accountRepo.findByType(organizationId, companyId, accountType).pipe(
                Effect.mapError((e) => mapPersistenceToValidation(e))
              )
            } else if (isActive !== undefined) {
              if (isActive) {
                accounts = yield* accountRepo.findActiveByCompany(organizationId, companyId).pipe(
                  Effect.mapError((e) => mapPersistenceToValidation(e))
                )
              } else {
                const all = yield* accountRepo.findByCompany(organizationId, companyId).pipe(
                  Effect.mapError((e) => mapPersistenceToValidation(e))
                )
                accounts = all.filter((a) => !a.isActive)
              }
            } else if (parentAcctId !== undefined) {
              accounts = yield* accountRepo.findChildren(organizationId, parentAcctId).pipe(
                Effect.mapError((e) => mapPersistenceToValidation(e))
              )
            } else {
              accounts = yield* accountRepo.findByCompany(organizationId, companyId).pipe(
                Effect.mapError((e) => mapPersistenceToValidation(e))
              )
            }

            // Apply category filter if provided
            if (accountCategory !== undefined) {
              const category: AccountCategory = accountCategory
              accounts = accounts.filter((a) => a.accountCategory === category)
            }

            // Apply postable filter if provided - already decoded
            if (isPostable !== undefined) {
              accounts = accounts.filter((a) => a.isPostable === isPostable)
            }

            // Apply pagination
            const total = accounts.length
            const limit = _.urlParams.limit ?? 100
            const offset = _.urlParams.offset ?? 0
            const paginatedAccounts = accounts.slice(offset, offset + limit)

            return {
              accounts: paginatedAccounts,
              total,
              limit,
              offset
            }
          })
        )
      )
      .handle("getAccount", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("account:read")

            // Convert path params to branded types
            const organizationId = OrganizationId.make(_.path.organizationId)
            const accountId = AccountId.make(_.path.id)

            const maybeAccount = yield* accountRepo.findById(organizationId, accountId).pipe(
              Effect.mapError((e) => mapPersistenceToNotFound("Account", _.path.id, e))
            )

            return yield* Option.match(maybeAccount, {
              onNone: () => Effect.fail(new NotFoundError({ resource: "Account", id: _.path.id })),
              onSome: Effect.succeed
            })
          })
        )
      )
      .handle("createAccount", (_) =>
        requireOrganizationContext(_.payload.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("account:create")

            const req = _.payload
            const organizationId = OrganizationId.make(req.organizationId)

            // Validate company exists within organization
            const companyExists = yield* companyRepo.exists(organizationId, req.companyId).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )
            if (!companyExists) {
              return yield* Effect.fail(new BusinessRuleError({
                code: "COMPANY_NOT_FOUND",
                message: `Company not found: ${req.companyId}`,
                details: Option.none()
              }))
            }

            // Check for duplicate account number
            const existingAccount = yield* accountRepo.findByNumber(organizationId, req.companyId, req.accountNumber).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )
            if (Option.isSome(existingAccount)) {
              return yield* Effect.fail(new ConflictError({
                message: `Account number ${req.accountNumber} already exists in this company`,
                resource: Option.some("Account"),
                conflictingField: Option.some("accountNumber")
              }))
            }

            // Validate parent account if specified
            let hierarchyLevel = 1
            if (Option.isSome(req.parentAccountId)) {
              const parentAccount = yield* accountRepo.findById(organizationId, req.parentAccountId.value).pipe(
                Effect.mapError((e) => mapPersistenceToBusinessRule(e))
              )
              if (Option.isNone(parentAccount)) {
                return yield* Effect.fail(new BusinessRuleError({
                  code: "PARENT_ACCOUNT_NOT_FOUND",
                  message: `Parent account not found: ${req.parentAccountId.value}`,
                  details: Option.none()
                }))
              }
              if (!Equal.equals(parentAccount.value.companyId, req.companyId)) {
                return yield* Effect.fail(new BusinessRuleError({
                  code: "PARENT_DIFFERENT_COMPANY",
                  message: "Parent account must be in the same company",
                  details: Option.none()
                }))
              }
              hierarchyLevel = parentAccount.value.hierarchyLevel + 1
            }

            // Create the account
            const newAccount = Account.make({
              id: AccountId.make(crypto.randomUUID()),
              companyId: req.companyId,
              accountNumber: req.accountNumber,
              name: req.name,
              description: req.description,
              accountType: req.accountType,
              accountCategory: req.accountCategory,
              normalBalance: req.normalBalance,
              parentAccountId: req.parentAccountId,
              hierarchyLevel,
              isPostable: req.isPostable,
              isCashFlowRelevant: req.isCashFlowRelevant,
              cashFlowCategory: req.cashFlowCategory,
              isIntercompany: req.isIntercompany,
              intercompanyPartnerId: req.intercompanyPartnerId,
              currencyRestriction: req.currencyRestriction,
              isActive: true,
              createdAt: timestampNow(),
              deactivatedAt: Option.none()
            })

            return yield* accountRepo.create(newAccount).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )
          })
        )
      )
      .handle("updateAccount", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("account:update")

            const req = _.payload

            // Convert path params to branded types
            const organizationId = OrganizationId.make(_.path.organizationId)
            const accountId = AccountId.make(_.path.id)

            // Get existing account
            const maybeExisting = yield* accountRepo.findById(organizationId, accountId).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )
            if (Option.isNone(maybeExisting)) {
              return yield* Effect.fail(new NotFoundError({ resource: "Account", id: _.path.id }))
            }
            const existing = maybeExisting.value

            // Validate parent account if changing
            let hierarchyLevel = existing.hierarchyLevel
            const newParentAccountId = Option.isSome(req.parentAccountId)
              ? req.parentAccountId
              : existing.parentAccountId

            if (Option.isSome(req.parentAccountId) &&
                !Equal.equals(req.parentAccountId, existing.parentAccountId)) {
              if (Option.isSome(req.parentAccountId)) {
                if (req.parentAccountId.value === accountId) {
                  return yield* Effect.fail(new BusinessRuleError({
                    code: "CIRCULAR_REFERENCE",
                    message: "Account cannot be its own parent",
                    details: Option.none()
                  }))
                }

                const parentAccount = yield* accountRepo.findById(organizationId, req.parentAccountId.value).pipe(
                  Effect.mapError((e) => mapPersistenceToBusinessRule(e))
                )
                if (Option.isNone(parentAccount)) {
                  return yield* Effect.fail(new BusinessRuleError({
                    code: "PARENT_ACCOUNT_NOT_FOUND",
                    message: `Parent account not found: ${req.parentAccountId.value}`,
                    details: Option.none()
                  }))
                }
                if (!Equal.equals(parentAccount.value.companyId, existing.companyId)) {
                  return yield* Effect.fail(new BusinessRuleError({
                    code: "PARENT_DIFFERENT_COMPANY",
                    message: "Parent account must be in the same company",
                    details: Option.none()
                  }))
                }
                hierarchyLevel = parentAccount.value.hierarchyLevel + 1
              } else {
                hierarchyLevel = 1
              }
            }

            // Build updated account
            const updatedAccount = Account.make({
              ...existing,
              name: Option.isSome(req.name) ? req.name.value : existing.name,
              description: Option.isSome(req.description) ? req.description : existing.description,
              parentAccountId: newParentAccountId,
              hierarchyLevel,
              isPostable: Option.isSome(req.isPostable) ? req.isPostable.value : existing.isPostable,
              isCashFlowRelevant: Option.isSome(req.isCashFlowRelevant)
                ? req.isCashFlowRelevant.value
                : existing.isCashFlowRelevant,
              cashFlowCategory: Option.isSome(req.cashFlowCategory)
                ? req.cashFlowCategory
                : existing.cashFlowCategory,
              isIntercompany: Option.isSome(req.isIntercompany)
                ? req.isIntercompany.value
                : existing.isIntercompany,
              intercompanyPartnerId: Option.isSome(req.intercompanyPartnerId)
                ? req.intercompanyPartnerId
                : existing.intercompanyPartnerId,
              currencyRestriction: Option.isSome(req.currencyRestriction)
                ? req.currencyRestriction
                : existing.currencyRestriction,
              isActive: Option.isSome(req.isActive) ? req.isActive.value : existing.isActive,
              deactivatedAt: Option.isSome(req.isActive) && !req.isActive.value && existing.isActive
                ? Option.some(timestampNow())
                : existing.deactivatedAt
            })

            return yield* accountRepo.update(organizationId, updatedAccount).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )
          })
        )
      )
      .handle("deactivateAccount", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("account:deactivate")

            // Convert path params to branded types
            const organizationId = OrganizationId.make(_.path.organizationId)
            const accountId = AccountId.make(_.path.id)

            // Get existing account
            const maybeExisting = yield* accountRepo.findById(organizationId, accountId).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )
            if (Option.isNone(maybeExisting)) {
              return yield* Effect.fail(new NotFoundError({ resource: "Account", id: _.path.id }))
            }
            const existing = maybeExisting.value

            // Check for child accounts
            const children = yield* accountRepo.findChildren(organizationId, accountId).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )
            const activeChildren = children.filter((c) => c.isActive)
            if (activeChildren.length > 0) {
              return yield* Effect.fail(new BusinessRuleError({
                code: "HAS_ACTIVE_CHILDREN",
                message: `Cannot deactivate account with ${activeChildren.length} active child accounts`,
                details: Option.none()
              }))
            }

            // Deactivate the account
            const deactivatedAccount = Account.make({
              ...existing,
              isActive: false,
              deactivatedAt: Option.some(timestampNow())
            })

            yield* accountRepo.update(organizationId, deactivatedAccount).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )
          })
        )
      )
  })
)
