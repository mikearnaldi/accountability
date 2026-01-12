/**
 * AccountsApiLive - Live implementation of accounts API handlers
 *
 * Implements the AccountsApi endpoints with real CRUD operations
 * by calling the AccountRepository and CompanyRepository.
 *
 * @module AccountsApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as Effect from "effect/Effect"
import * as Equal from "effect/Equal"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import {
  Account,
  AccountId,
  AccountCategory,
  AccountType
} from "@accountability/core/domain/Account"
import { CompanyId } from "@accountability/core/domain/Company"
import { now as timestampNow } from "@accountability/core/domain/Timestamp"
import { AccountRepository } from "@accountability/persistence/AccountRepository"
import { CompanyRepository } from "@accountability/persistence/CompanyRepository"
import {
  isEntityNotFoundError,
  type EntityNotFoundError,
  type PersistenceError
} from "@accountability/persistence/RepositoryError"
import { AppApi } from "./AppApi.ts"
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  BusinessRuleError
} from "./ApiErrors.ts"

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
  if (isEntityNotFoundError(error)) {
    return new ValidationError({
      message: error.message,
      field: Option.none(),
      details: Option.none()
    })
  }
  return new ValidationError({
    message: error.message,
    field: Option.none(),
    details: Option.none()
  })
}

/**
 * Parse AccountType from string, returning Option using Schema
 */
const parseAccountType = (s: string): Option.Option<typeof AccountType.Type> => {
  const result = Schema.decodeUnknownEither(AccountType)(s)
  return result._tag === "Right" ? Option.some(result.right) : Option.none()
}

/**
 * Parse AccountCategory from string, returning Option using Schema
 */
const parseAccountCategory = (s: string): Option.Option<typeof AccountCategory.Type> => {
  const result = Schema.decodeUnknownEither(AccountCategory)(s)
  return result._tag === "Right" ? Option.some(result.right) : Option.none()
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
        Effect.gen(function* () {
          const params = _.urlParams

          // Validate companyId
          const companyIdResult = Schema.decodeUnknownEither(CompanyId)(params.companyId)
          if (companyIdResult._tag === "Left") {
            return yield* Effect.fail(new ValidationError({
              message: "Invalid companyId format",
              field: Option.some("companyId"),
              details: Option.none()
            }))
          }
          const companyId = companyIdResult.right

          // Check company exists
          const companyExists = yield* companyRepo.exists(companyId).pipe(
            Effect.mapError((e) => mapPersistenceToValidation(e))
          )
          if (!companyExists) {
            return yield* Effect.fail(new NotFoundError({ resource: "Company", id: companyId }))
          }

          // Get accounts based on filters
          let accounts: ReadonlyArray<Account>

          if (params.accountType !== undefined) {
            const maybeType = parseAccountType(params.accountType)
            if (Option.isNone(maybeType)) {
              return yield* Effect.fail(new ValidationError({
                message: `Invalid accountType: ${params.accountType}`,
                field: Option.some("accountType"),
                details: Option.none()
              }))
            }
            accounts = yield* accountRepo.findByType(companyId, maybeType.value).pipe(
              Effect.mapError((e) => mapPersistenceToValidation(e))
            )
          } else if (params.isActive !== undefined) {
            if (params.isActive) {
              accounts = yield* accountRepo.findActiveByCompany(companyId).pipe(
                Effect.mapError((e) => mapPersistenceToValidation(e))
              )
            } else {
              const all = yield* accountRepo.findByCompany(companyId).pipe(
                Effect.mapError((e) => mapPersistenceToValidation(e))
              )
              accounts = all.filter((a) => !a.isActive)
            }
          } else if (params.parentAccountId !== undefined) {
            const parentIdResult = Schema.decodeUnknownEither(AccountId)(params.parentAccountId)
            if (parentIdResult._tag === "Left") {
              return yield* Effect.fail(new ValidationError({
                message: "Invalid parentAccountId format",
                field: Option.some("parentAccountId"),
                details: Option.none()
              }))
            }
            accounts = yield* accountRepo.findChildren(parentIdResult.right).pipe(
              Effect.mapError((e) => mapPersistenceToValidation(e))
            )
          } else {
            accounts = yield* accountRepo.findByCompany(companyId).pipe(
              Effect.mapError((e) => mapPersistenceToValidation(e))
            )
          }

          // Apply category filter if provided
          if (params.accountCategory !== undefined) {
            const maybeCat = parseAccountCategory(params.accountCategory)
            if (Option.isNone(maybeCat)) {
              return yield* Effect.fail(new ValidationError({
                message: `Invalid accountCategory: ${params.accountCategory}`,
                field: Option.some("accountCategory"),
                details: Option.none()
              }))
            }
            accounts = accounts.filter((a) => a.accountCategory === maybeCat.value)
          }

          // Apply postable filter if provided
          if (params.isPostable !== undefined) {
            accounts = accounts.filter((a) => a.isPostable === params.isPostable)
          }

          // Apply pagination
          const total = accounts.length
          const limit = params.limit ?? 100
          const offset = params.offset ?? 0
          const paginatedAccounts = accounts.slice(offset, offset + limit)

          return {
            accounts: paginatedAccounts,
            total,
            limit,
            offset
          }
        })
      )
      .handle("getAccount", (_) =>
        Effect.gen(function* () {
          const accountIdResult = Schema.decodeUnknownEither(AccountId)(_.path.id)
          if (accountIdResult._tag === "Left") {
            return yield* Effect.fail(new NotFoundError({ resource: "Account", id: _.path.id }))
          }

          const maybeAccount = yield* accountRepo.findById(accountIdResult.right).pipe(
            Effect.mapError((e) => mapPersistenceToNotFound("Account", _.path.id, e))
          )

          return yield* Option.match(maybeAccount, {
            onNone: () => Effect.fail(new NotFoundError({ resource: "Account", id: _.path.id })),
            onSome: Effect.succeed
          })
        })
      )
      .handle("createAccount", (_) =>
        Effect.gen(function* () {
          const req = _.payload

          // Validate company exists
          const companyExists = yield* companyRepo.exists(req.companyId).pipe(
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
          const existingAccount = yield* accountRepo.findByNumber(req.companyId, req.accountNumber).pipe(
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
            const parentAccount = yield* accountRepo.findById(req.parentAccountId.value).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )
            if (Option.isNone(parentAccount)) {
              return yield* Effect.fail(new BusinessRuleError({
                code: "PARENT_ACCOUNT_NOT_FOUND",
                message: `Parent account not found: ${req.parentAccountId.value}`,
                details: Option.none()
              }))
            }
            if (parentAccount.value.companyId !== req.companyId) {
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
      .handle("updateAccount", (_) =>
        Effect.gen(function* () {
          const req = _.payload

          const accountIdResult = Schema.decodeUnknownEither(AccountId)(_.path.id)
          if (accountIdResult._tag === "Left") {
            return yield* Effect.fail(new NotFoundError({ resource: "Account", id: _.path.id }))
          }
          const accountId = accountIdResult.right

          // Get existing account
          const maybeExisting = yield* accountRepo.findById(accountId).pipe(
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

              const parentAccount = yield* accountRepo.findById(req.parentAccountId.value).pipe(
                Effect.mapError((e) => mapPersistenceToBusinessRule(e))
              )
              if (Option.isNone(parentAccount)) {
                return yield* Effect.fail(new BusinessRuleError({
                  code: "PARENT_ACCOUNT_NOT_FOUND",
                  message: `Parent account not found: ${req.parentAccountId.value}`,
                  details: Option.none()
                }))
              }
              if (parentAccount.value.companyId !== existing.companyId) {
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

          return yield* accountRepo.update(updatedAccount).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
        })
      )
      .handle("deactivateAccount", (_) =>
        Effect.gen(function* () {
          const accountIdResult = Schema.decodeUnknownEither(AccountId)(_.path.id)
          if (accountIdResult._tag === "Left") {
            return yield* Effect.fail(new NotFoundError({ resource: "Account", id: _.path.id }))
          }
          const accountId = accountIdResult.right

          // Get existing account
          const maybeExisting = yield* accountRepo.findById(accountId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (Option.isNone(maybeExisting)) {
            return yield* Effect.fail(new NotFoundError({ resource: "Account", id: _.path.id }))
          }
          const existing = maybeExisting.value

          // Check for child accounts
          const children = yield* accountRepo.findChildren(accountId).pipe(
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

          yield* accountRepo.update(deactivatedAccount).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
        })
      )
  })
)
