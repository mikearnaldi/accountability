/**
 * IntercompanyTransactionsApiLive - Live implementation of intercompany transactions API handlers
 *
 * Implements the IntercompanyTransactionsApi endpoints with real CRUD operations
 * by calling the IntercompanyTransactionRepository.
 *
 * @module IntercompanyTransactionsApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import {
  IntercompanyTransaction,
  IntercompanyTransactionId
} from "@accountability/core/Domains/IntercompanyTransaction"
import { now as timestampNow } from "@accountability/core/Domains/Timestamp"
import { IntercompanyTransactionRepository } from "@accountability/persistence/Services/IntercompanyTransactionRepository"
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
  BusinessRuleError
} from "../Definitions/ApiErrors.ts"

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
 * IntercompanyTransactionsApiLive - Layer providing IntercompanyTransactionsApi handlers
 *
 * Dependencies:
 * - IntercompanyTransactionRepository
 * - CompanyRepository
 */
export const IntercompanyTransactionsApiLive = HttpApiBuilder.group(AppApi, "intercompanyTransactions", (handlers) =>
  Effect.gen(function* () {
    const icRepo = yield* IntercompanyTransactionRepository
    const companyRepo = yield* CompanyRepository

    return handlers
      .handle("listIntercompanyTransactions", (_) =>
        Effect.gen(function* () {
          const {
            fromCompanyId,
            toCompanyId,
            companyId,
            transactionType,
            matchingStatus,
            startDate,
            endDate,
            requiresElimination,
            unmatched
          } = _.urlParams

          let transactions: ReadonlyArray<IntercompanyTransaction>

          // Apply filters based on provided parameters
          if (unmatched) {
            transactions = yield* icRepo.findUnmatched().pipe(
              Effect.mapError((e) => mapPersistenceToValidation(e))
            )
          } else if (requiresElimination) {
            transactions = yield* icRepo.findRequiringElimination().pipe(
              Effect.mapError((e) => mapPersistenceToValidation(e))
            )
          } else if (fromCompanyId !== undefined && toCompanyId !== undefined) {
            transactions = yield* icRepo.findBetweenCompanies(fromCompanyId, toCompanyId).pipe(
              Effect.mapError((e) => mapPersistenceToValidation(e))
            )
          } else if (fromCompanyId !== undefined) {
            transactions = yield* icRepo.findByFromCompany(fromCompanyId).pipe(
              Effect.mapError((e) => mapPersistenceToValidation(e))
            )
          } else if (toCompanyId !== undefined) {
            transactions = yield* icRepo.findByToCompany(toCompanyId).pipe(
              Effect.mapError((e) => mapPersistenceToValidation(e))
            )
          } else if (companyId !== undefined) {
            transactions = yield* icRepo.findByCompany(companyId).pipe(
              Effect.mapError((e) => mapPersistenceToValidation(e))
            )
          } else if (matchingStatus !== undefined) {
            transactions = yield* icRepo.findByMatchingStatus(matchingStatus).pipe(
              Effect.mapError((e) => mapPersistenceToValidation(e))
            )
          } else if (transactionType !== undefined) {
            transactions = yield* icRepo.findByTransactionType(transactionType).pipe(
              Effect.mapError((e) => mapPersistenceToValidation(e))
            )
          } else if (startDate !== undefined && endDate !== undefined) {
            transactions = yield* icRepo.findByDateRange(startDate, endDate).pipe(
              Effect.mapError((e) => mapPersistenceToValidation(e))
            )
          } else {
            // Default: return all (this would need a findAll method)
            // For now, return unmatched as a fallback
            transactions = yield* icRepo.findUnmatched().pipe(
              Effect.mapError((e) => mapPersistenceToValidation(e))
            )
          }

          // Apply pagination
          const total = transactions.length
          const limit = _.urlParams.limit ?? 100
          const offset = _.urlParams.offset ?? 0
          const paginatedTransactions = transactions.slice(offset, offset + limit)

          return {
            transactions: paginatedTransactions,
            total,
            limit,
            offset
          }
        })
      )
      .handle("getIntercompanyTransaction", (_) =>
        Effect.gen(function* () {
          const transactionId = _.path.id

          const maybeTransaction = yield* icRepo.findById(transactionId).pipe(
            Effect.mapError((e) => mapPersistenceToNotFound("IntercompanyTransaction", transactionId, e))
          )

          return yield* Option.match(maybeTransaction, {
            onNone: () => Effect.fail(new NotFoundError({ resource: "IntercompanyTransaction", id: transactionId })),
            onSome: Effect.succeed
          })
        })
      )
      .handle("createIntercompanyTransaction", (_) =>
        Effect.gen(function* () {
          const req = _.payload

          // Validate from company exists within organization
          const fromCompanyExists = yield* companyRepo.exists(req.organizationId, req.fromCompanyId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (!fromCompanyExists) {
            return yield* Effect.fail(new BusinessRuleError({
              code: "FROM_COMPANY_NOT_FOUND",
              message: `From company not found: ${req.fromCompanyId}`,
              details: Option.none()
            }))
          }

          // Validate to company exists within organization
          const toCompanyExists = yield* companyRepo.exists(req.organizationId, req.toCompanyId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (!toCompanyExists) {
            return yield* Effect.fail(new BusinessRuleError({
              code: "TO_COMPANY_NOT_FOUND",
              message: `To company not found: ${req.toCompanyId}`,
              details: Option.none()
            }))
          }

          // Validate companies are different
          if (req.fromCompanyId === req.toCompanyId) {
            return yield* Effect.fail(new BusinessRuleError({
              code: "SAME_COMPANY",
              message: "From and To companies must be different",
              details: Option.none()
            }))
          }

          // Create the transaction with optional JE links (per Issue 36)
          const now = timestampNow()
          const newTransaction = IntercompanyTransaction.make({
            id: IntercompanyTransactionId.make(crypto.randomUUID()),
            fromCompanyId: req.fromCompanyId,
            toCompanyId: req.toCompanyId,
            transactionType: req.transactionType,
            transactionDate: req.transactionDate,
            amount: req.amount,
            description: req.description,
            // Use provided JE IDs if present, otherwise leave as none
            fromJournalEntryId: Option.isSome(req.fromJournalEntryId) ? req.fromJournalEntryId : Option.none(),
            toJournalEntryId: Option.isSome(req.toJournalEntryId) ? req.toJournalEntryId : Option.none(),
            matchingStatus: "Unmatched",
            varianceAmount: Option.none(),
            varianceExplanation: Option.none(),
            createdAt: now,
            updatedAt: now
          })

          return yield* icRepo.create(newTransaction).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
        })
      )
      .handle("updateIntercompanyTransaction", (_) =>
        Effect.gen(function* () {
          const transactionId = _.path.id
          const req = _.payload

          // Get existing transaction
          const maybeExisting = yield* icRepo.findById(transactionId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (Option.isNone(maybeExisting)) {
            return yield* Effect.fail(new NotFoundError({ resource: "IntercompanyTransaction", id: transactionId }))
          }
          const existing = maybeExisting.value

          // Build updated transaction
          const updatedTransaction = IntercompanyTransaction.make({
            ...existing,
            transactionType: Option.isSome(req.transactionType)
              ? req.transactionType.value
              : existing.transactionType,
            transactionDate: Option.isSome(req.transactionDate)
              ? req.transactionDate.value
              : existing.transactionDate,
            amount: Option.isSome(req.amount)
              ? req.amount.value
              : existing.amount,
            description: Option.isSome(req.description)
              ? req.description
              : existing.description,
            varianceAmount: Option.isSome(req.varianceAmount)
              ? req.varianceAmount
              : existing.varianceAmount,
            varianceExplanation: Option.isSome(req.varianceExplanation)
              ? req.varianceExplanation
              : existing.varianceExplanation
          })

          return yield* icRepo.update(updatedTransaction).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
        })
      )
      .handle("deleteIntercompanyTransaction", (_) =>
        Effect.gen(function* () {
          const transactionId = _.path.id

          // Check if exists
          const maybeExisting = yield* icRepo.findById(transactionId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (Option.isNone(maybeExisting)) {
            return yield* Effect.fail(new NotFoundError({ resource: "IntercompanyTransaction", id: transactionId }))
          }

          const existing = maybeExisting.value

          // Check if already matched
          if (existing.matchingStatus === "Matched") {
            return yield* Effect.fail(new BusinessRuleError({
              code: "CANNOT_DELETE_MATCHED",
              message: `Cannot delete transaction with status: ${existing.matchingStatus}`,
              details: Option.none()
            }))
          }

          yield* icRepo.delete(transactionId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
        })
      )
      .handle("updateMatchingStatus", (_) =>
        Effect.gen(function* () {
          const transactionId = _.path.id
          const req = _.payload

          // Get existing transaction
          const maybeExisting = yield* icRepo.findById(transactionId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (Option.isNone(maybeExisting)) {
            return yield* Effect.fail(new NotFoundError({ resource: "IntercompanyTransaction", id: transactionId }))
          }
          const existing = maybeExisting.value

          // Update matching status
          const updatedTransaction = IntercompanyTransaction.make({
            ...existing,
            matchingStatus: req.matchingStatus,
            varianceExplanation: Option.isSome(req.varianceExplanation)
              ? req.varianceExplanation
              : existing.varianceExplanation
          })

          return yield* icRepo.update(updatedTransaction).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
        })
      )
      .handle("linkFromJournalEntry", (_) =>
        Effect.gen(function* () {
          const transactionId = _.path.id
          const req = _.payload

          return yield* icRepo.linkFromJournalEntry(transactionId, req.journalEntryId).pipe(
            Effect.mapError((e) => {
              if (isEntityNotFoundError(e)) {
                return new NotFoundError({ resource: "IntercompanyTransaction", id: transactionId })
              }
              return mapPersistenceToBusinessRule(e)
            })
          )
        })
      )
      .handle("linkToJournalEntry", (_) =>
        Effect.gen(function* () {
          const transactionId = _.path.id
          const req = _.payload

          return yield* icRepo.linkToJournalEntry(transactionId, req.journalEntryId).pipe(
            Effect.mapError((e) => {
              if (isEntityNotFoundError(e)) {
                return new NotFoundError({ resource: "IntercompanyTransaction", id: transactionId })
              }
              return mapPersistenceToBusinessRule(e)
            })
          )
        })
      )
  })
)
