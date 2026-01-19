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
} from "@accountability/core/consolidation/IntercompanyTransaction"
import { now as timestampNow } from "@accountability/core/shared/values/Timestamp"
import { IntercompanyTransactionRepository } from "@accountability/persistence/Services/IntercompanyTransactionRepository"
import { CompanyRepository } from "@accountability/persistence/Services/CompanyRepository"
import {
  isEntityNotFoundError
} from "@accountability/persistence/Errors/RepositoryError"
import { AppApi } from "../Definitions/AppApi.ts"
import { CompanyNotFoundError } from "@accountability/core/company/CompanyErrors"
import {
  IntercompanyTransactionNotFoundError,
  IntercompanyTransactionCannotBeDeletedError,
  SameCompanyIntercompanyError
} from "@accountability/core/consolidation/ConsolidationErrors"

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
          // Use Effect.orDie for persistence errors (unexpected infrastructure failures)
          if (unmatched) {
            transactions = yield* icRepo.findUnmatched().pipe(Effect.orDie)
          } else if (requiresElimination) {
            transactions = yield* icRepo.findRequiringElimination().pipe(Effect.orDie)
          } else if (fromCompanyId !== undefined && toCompanyId !== undefined) {
            transactions = yield* icRepo.findBetweenCompanies(fromCompanyId, toCompanyId).pipe(Effect.orDie)
          } else if (fromCompanyId !== undefined) {
            transactions = yield* icRepo.findByFromCompany(fromCompanyId).pipe(Effect.orDie)
          } else if (toCompanyId !== undefined) {
            transactions = yield* icRepo.findByToCompany(toCompanyId).pipe(Effect.orDie)
          } else if (companyId !== undefined) {
            transactions = yield* icRepo.findByCompany(companyId).pipe(Effect.orDie)
          } else if (matchingStatus !== undefined) {
            transactions = yield* icRepo.findByMatchingStatus(matchingStatus).pipe(Effect.orDie)
          } else if (transactionType !== undefined) {
            transactions = yield* icRepo.findByTransactionType(transactionType).pipe(Effect.orDie)
          } else if (startDate !== undefined && endDate !== undefined) {
            transactions = yield* icRepo.findByDateRange(startDate, endDate).pipe(Effect.orDie)
          } else {
            // Default: return all (this would need a findAll method)
            // For now, return unmatched as a fallback
            transactions = yield* icRepo.findUnmatched().pipe(Effect.orDie)
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

          const maybeTransaction = yield* icRepo.findById(transactionId).pipe(Effect.orDie)

          return yield* Option.match(maybeTransaction, {
            onNone: () => Effect.fail(new IntercompanyTransactionNotFoundError({ transactionId })),
            onSome: Effect.succeed
          })
        })
      )
      .handle("createIntercompanyTransaction", (_) =>
        Effect.gen(function* () {
          const req = _.payload

          // Validate from company exists within organization
          const fromCompanyExists = yield* companyRepo.exists(req.organizationId, req.fromCompanyId).pipe(Effect.orDie)
          if (!fromCompanyExists) {
            return yield* Effect.fail(new CompanyNotFoundError({ companyId: req.fromCompanyId }))
          }

          // Validate to company exists within organization
          const toCompanyExists = yield* companyRepo.exists(req.organizationId, req.toCompanyId).pipe(Effect.orDie)
          if (!toCompanyExists) {
            return yield* Effect.fail(new CompanyNotFoundError({ companyId: req.toCompanyId }))
          }

          // Validate companies are different
          if (req.fromCompanyId === req.toCompanyId) {
            return yield* Effect.fail(new SameCompanyIntercompanyError({ companyId: req.fromCompanyId }))
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

          return yield* icRepo.create(newTransaction).pipe(Effect.orDie)
        })
      )
      .handle("updateIntercompanyTransaction", (_) =>
        Effect.gen(function* () {
          const transactionId = _.path.id
          const req = _.payload

          // Get existing transaction
          const maybeExisting = yield* icRepo.findById(transactionId).pipe(Effect.orDie)
          if (Option.isNone(maybeExisting)) {
            return yield* Effect.fail(new IntercompanyTransactionNotFoundError({ transactionId }))
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

          return yield* icRepo.update(updatedTransaction).pipe(Effect.orDie)
        })
      )
      .handle("deleteIntercompanyTransaction", (_) =>
        Effect.gen(function* () {
          const transactionId = _.path.id

          // Check if exists
          const maybeExisting = yield* icRepo.findById(transactionId).pipe(Effect.orDie)
          if (Option.isNone(maybeExisting)) {
            return yield* Effect.fail(new IntercompanyTransactionNotFoundError({ transactionId }))
          }

          const existing = maybeExisting.value

          // Check if already matched
          if (existing.matchingStatus === "Matched") {
            return yield* Effect.fail(new IntercompanyTransactionCannotBeDeletedError({
              transactionId,
              matchingStatus: existing.matchingStatus
            }))
          }

          yield* icRepo.delete(transactionId).pipe(Effect.orDie)
        })
      )
      .handle("updateMatchingStatus", (_) =>
        Effect.gen(function* () {
          const transactionId = _.path.id
          const req = _.payload

          // Get existing transaction
          const maybeExisting = yield* icRepo.findById(transactionId).pipe(Effect.orDie)
          if (Option.isNone(maybeExisting)) {
            return yield* Effect.fail(new IntercompanyTransactionNotFoundError({ transactionId }))
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

          return yield* icRepo.update(updatedTransaction).pipe(Effect.orDie)
        })
      )
      .handle("linkFromJournalEntry", (_) =>
        Effect.gen(function* () {
          const transactionId = _.path.id
          const req = _.payload

          return yield* icRepo.linkFromJournalEntry(transactionId, req.journalEntryId).pipe(
            Effect.catchAll((e) => {
              if (isEntityNotFoundError(e)) {
                return Effect.fail(new IntercompanyTransactionNotFoundError({ transactionId }))
              }
              return Effect.die(e)
            })
          )
        })
      )
      .handle("linkToJournalEntry", (_) =>
        Effect.gen(function* () {
          const transactionId = _.path.id
          const req = _.payload

          return yield* icRepo.linkToJournalEntry(transactionId, req.journalEntryId).pipe(
            Effect.catchAll((e) => {
              if (isEntityNotFoundError(e)) {
                return Effect.fail(new IntercompanyTransactionNotFoundError({ transactionId }))
              }
              return Effect.die(e)
            })
          )
        })
      )
  })
)
