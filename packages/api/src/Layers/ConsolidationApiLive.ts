/**
 * ConsolidationApiLive - Live implementation of consolidation API handlers
 *
 * Implements the ConsolidationApi endpoints with real CRUD operations
 * by calling the ConsolidationRepository.
 *
 * @module ConsolidationApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Array from "effect/Array"
import {
  ConsolidationGroup,
  ConsolidationGroupId,
  ConsolidationMember
} from "@accountability/core/Domains/ConsolidationGroup"
import { LocalDate } from "@accountability/core/Domains/LocalDate"
import { Percentage } from "@accountability/core/Domains/Percentage"
import {
  ConsolidationRun,
  ConsolidationRunId,
  ConsolidationRunOptions,
  createInitialSteps
} from "@accountability/core/Domains/ConsolidationRun"
import { now as timestampNow } from "@accountability/core/Domains/Timestamp"
import { ConsolidationRepository } from "@accountability/persistence/Services/ConsolidationRepository"
import { CompanyRepository } from "@accountability/persistence/Services/CompanyRepository"
import {
  isEntityNotFoundError,
  type EntityNotFoundError,
  type PersistenceError
} from "@accountability/persistence/RepositoryError"
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
 * ConsolidationApiLive - Layer providing ConsolidationApi handlers
 *
 * Dependencies:
 * - ConsolidationRepository
 * - CompanyRepository
 */
export const ConsolidationApiLive = HttpApiBuilder.group(AppApi, "consolidation", (handlers) =>
  Effect.gen(function* () {
    const consolidationRepo = yield* ConsolidationRepository
    const companyRepo = yield* CompanyRepository

    return handlers
      .handle("listConsolidationGroups", (_) =>
        Effect.gen(function* () {
          const { organizationId, isActive } = _.urlParams

          let groups: ReadonlyArray<ConsolidationGroup>

          if (organizationId !== undefined) {
            if (isActive === true) {
              groups = yield* consolidationRepo.findActiveGroups(organizationId).pipe(
                Effect.mapError((e) => mapPersistenceToValidation(e))
              )
            } else {
              groups = yield* consolidationRepo.findGroupsByOrganization(organizationId).pipe(
                Effect.mapError((e) => mapPersistenceToValidation(e))
              )
            }
          } else {
            // No filter - return empty for now
            groups = []
          }

          // Apply isActive filter if provided and not already filtered
          if (isActive !== undefined && organizationId === undefined) {
            groups = groups.filter((g) => g.isActive === isActive)
          }

          // Apply pagination
          const total = groups.length
          const limit = _.urlParams.limit ?? 100
          const offset = _.urlParams.offset ?? 0
          const paginatedGroups = groups.slice(offset, offset + limit)

          return {
            groups: paginatedGroups,
            total,
            limit,
            offset
          }
        })
      )
      .handle("getConsolidationGroup", (_) =>
        Effect.gen(function* () {
          const groupId = _.path.id

          const maybeGroup = yield* consolidationRepo.findGroup(groupId).pipe(
            Effect.mapError((e) => mapPersistenceToNotFound("ConsolidationGroup", groupId, e))
          )

          if (Option.isNone(maybeGroup)) {
            return yield* Effect.fail(new NotFoundError({ resource: "ConsolidationGroup", id: groupId }))
          }

          return {
            group: maybeGroup.value,
            members: Array.fromIterable(Chunk.toArray(maybeGroup.value.members))
          }
        })
      )
      .handle("createConsolidationGroup", (_) =>
        Effect.gen(function* () {
          const req = _.payload

          // Validate parent company exists
          const parentCompanyExists = yield* companyRepo.exists(req.parentCompanyId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (!parentCompanyExists) {
            return yield* Effect.fail(new BusinessRuleError({
              code: "PARENT_COMPANY_NOT_FOUND",
              message: `Parent company not found: ${req.parentCompanyId}`,
              details: Option.none()
            }))
          }

          // Create members from input - using current date as acquisition date default
          const today = LocalDate.make({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate() })
          const members = Chunk.fromIterable(
            req.members.map((m) =>
              ConsolidationMember.make({
                companyId: m.companyId,
                ownershipPercentage: m.ownershipPercentage,
                consolidationMethod: m.consolidationMethod,
                acquisitionDate: today,
                goodwillAmount: Option.none(),
                nonControllingInterestPercentage: Percentage.make(100 - m.ownershipPercentage),
                vieDetermination: Option.none()
              })
            )
          )

          // Create the group
          const newGroup = ConsolidationGroup.make({
            id: ConsolidationGroupId.make(crypto.randomUUID()),
            organizationId: req.organizationId,
            name: req.name,
            reportingCurrency: req.reportingCurrency,
            consolidationMethod: req.consolidationMethod,
            parentCompanyId: req.parentCompanyId,
            members,
            eliminationRuleIds: Chunk.empty(),
            isActive: true
          })

          const createdGroup = yield* consolidationRepo.createGroup(newGroup).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )

          return {
            group: createdGroup,
            members: Array.fromIterable(Chunk.toArray(createdGroup.members))
          }
        })
      )
      .handle("updateConsolidationGroup", (_) =>
        Effect.gen(function* () {
          const groupId = _.path.id
          const req = _.payload

          // Get existing group
          const maybeExisting = yield* consolidationRepo.findGroup(groupId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (Option.isNone(maybeExisting)) {
            return yield* Effect.fail(new NotFoundError({ resource: "ConsolidationGroup", id: groupId }))
          }
          const existing = maybeExisting.value

          // Build updated group
          const updatedGroup = ConsolidationGroup.make({
            ...existing,
            name: Option.isSome(req.name) ? req.name.value : existing.name,
            consolidationMethod: Option.isSome(req.consolidationMethod) ? req.consolidationMethod.value : existing.consolidationMethod,
            reportingCurrency: Option.isSome(req.reportingCurrency) ? req.reportingCurrency.value : existing.reportingCurrency
          })

          return yield* consolidationRepo.updateGroup(updatedGroup).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
        })
      )
      .handle("deleteConsolidationGroup", (_) =>
        Effect.gen(function* () {
          const groupId = _.path.id

          // Check if exists
          const exists = yield* consolidationRepo.groupExists(groupId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (!exists) {
            return yield* Effect.fail(new NotFoundError({ resource: "ConsolidationGroup", id: groupId }))
          }

          // Check for completed runs
          const runs = yield* consolidationRepo.findRunsByGroup(groupId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          const completedRuns = runs.filter((r) => r.status === "Completed")
          if (completedRuns.length > 0) {
            return yield* Effect.fail(new BusinessRuleError({
              code: "HAS_COMPLETED_RUNS",
              message: `Cannot delete group with ${completedRuns.length} completed runs`,
              details: Option.none()
            }))
          }

          // For now, we don't have a delete method - just deactivate
          return yield* Effect.fail(new BusinessRuleError({
            code: "DELETE_NOT_SUPPORTED",
            message: "Group deletion is not yet implemented. Use deactivation instead.",
            details: Option.none()
          }))
        })
      )
      .handle("activateConsolidationGroup", (_) =>
        Effect.gen(function* () {
          const groupId = _.path.id

          const maybeGroup = yield* consolidationRepo.findGroup(groupId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (Option.isNone(maybeGroup)) {
            return yield* Effect.fail(new NotFoundError({ resource: "ConsolidationGroup", id: groupId }))
          }

          const updatedGroup = ConsolidationGroup.make({
            ...maybeGroup.value,
            isActive: true
          })

          return yield* consolidationRepo.updateGroup(updatedGroup).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
        })
      )
      .handle("deactivateConsolidationGroup", (_) =>
        Effect.gen(function* () {
          const groupId = _.path.id

          const maybeGroup = yield* consolidationRepo.findGroup(groupId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (Option.isNone(maybeGroup)) {
            return yield* Effect.fail(new NotFoundError({ resource: "ConsolidationGroup", id: groupId }))
          }

          const updatedGroup = ConsolidationGroup.make({
            ...maybeGroup.value,
            isActive: false
          })

          return yield* consolidationRepo.updateGroup(updatedGroup).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
        })
      )
      .handle("addGroupMember", (_) =>
        Effect.gen(function* () {
          const groupId = _.path.id
          const req = _.payload

          // Get existing group
          const maybeGroup = yield* consolidationRepo.findGroup(groupId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (Option.isNone(maybeGroup)) {
            return yield* Effect.fail(new NotFoundError({ resource: "ConsolidationGroup", id: groupId }))
          }
          const existing = maybeGroup.value

          // Check company not already a member
          const existingMember = Chunk.findFirst(existing.members, (m) => m.companyId === req.companyId)
          if (Option.isSome(existingMember)) {
            return yield* Effect.fail(new BusinessRuleError({
              code: "ALREADY_MEMBER",
              message: `Company ${req.companyId} is already a member of this group`,
              details: Option.none()
            }))
          }

          // Create new member
          const today = LocalDate.make({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate() })
          const newMember = ConsolidationMember.make({
            companyId: req.companyId,
            ownershipPercentage: req.ownershipPercentage,
            consolidationMethod: req.consolidationMethod,
            acquisitionDate: today,
            goodwillAmount: Option.none(),
            nonControllingInterestPercentage: Percentage.make(100 - req.ownershipPercentage),
            vieDetermination: Option.none()
          })

          // Add member to group
          const updatedGroup = ConsolidationGroup.make({
            ...existing,
            members: Chunk.append(existing.members, newMember)
          })

          const savedGroup = yield* consolidationRepo.updateGroup(updatedGroup).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )

          return {
            group: savedGroup,
            members: Array.fromIterable(Chunk.toArray(savedGroup.members))
          }
        })
      )
      .handle("updateGroupMember", (_) =>
        Effect.gen(function* () {
          const groupId = _.path.id
          const companyId = _.path.companyId
          const req = _.payload

          // Get existing group
          const maybeGroup = yield* consolidationRepo.findGroup(groupId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (Option.isNone(maybeGroup)) {
            return yield* Effect.fail(new NotFoundError({ resource: "ConsolidationGroup", id: groupId }))
          }
          const existing = maybeGroup.value

          // Find member
          const memberIndex = Chunk.findFirstIndex(existing.members, (m) => m.companyId === companyId)
          if (Option.isNone(memberIndex)) {
            return yield* Effect.fail(new NotFoundError({
              resource: "ConsolidationMember",
              id: `${groupId}/${companyId}`
            }))
          }

          // Update member
          const oldMember = Chunk.unsafeGet(existing.members, memberIndex.value)
          const newOwnership = Option.isSome(req.ownershipPercentage)
            ? req.ownershipPercentage.value
            : oldMember.ownershipPercentage
          const updatedMember = ConsolidationMember.make({
            ...oldMember,
            ownershipPercentage: newOwnership,
            consolidationMethod: Option.isSome(req.consolidationMethod)
              ? req.consolidationMethod.value
              : oldMember.consolidationMethod,
            nonControllingInterestPercentage: Percentage.make(100 - newOwnership)
          })

          // Replace member in list
          const updatedMembers = Chunk.modify(existing.members, memberIndex.value, () => updatedMember)

          const updatedGroup = ConsolidationGroup.make({
            ...existing,
            members: updatedMembers
          })

          const savedGroup = yield* consolidationRepo.updateGroup(updatedGroup).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )

          return {
            group: savedGroup,
            members: Array.fromIterable(Chunk.toArray(savedGroup.members))
          }
        })
      )
      .handle("removeGroupMember", (_) =>
        Effect.gen(function* () {
          const groupId = _.path.id
          const companyId = _.path.companyId

          // Get existing group
          const maybeGroup = yield* consolidationRepo.findGroup(groupId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (Option.isNone(maybeGroup)) {
            return yield* Effect.fail(new NotFoundError({ resource: "ConsolidationGroup", id: groupId }))
          }
          const existing = maybeGroup.value

          // Filter out the member
          const updatedMembers = Chunk.filter(existing.members, (m) => m.companyId !== companyId)

          if (Chunk.size(updatedMembers) === Chunk.size(existing.members)) {
            return yield* Effect.fail(new NotFoundError({
              resource: "ConsolidationMember",
              id: `${groupId}/${companyId}`
            }))
          }

          const updatedGroup = ConsolidationGroup.make({
            ...existing,
            members: updatedMembers
          })

          const savedGroup = yield* consolidationRepo.updateGroup(updatedGroup).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )

          return {
            group: savedGroup,
            members: Array.fromIterable(Chunk.toArray(savedGroup.members))
          }
        })
      )
      .handle("listConsolidationRuns", (_) =>
        Effect.gen(function* () {
          const { groupId, status, year, period } = _.urlParams

          let runs: ReadonlyArray<ConsolidationRun>

          if (groupId !== undefined) {
            if (status !== undefined) {
              runs = yield* consolidationRepo.findRunsByStatus(groupId, status).pipe(
                Effect.mapError((e) => mapPersistenceToValidation(e))
              )
            } else {
              runs = yield* consolidationRepo.findRunsByGroup(groupId).pipe(
                Effect.mapError((e) => mapPersistenceToValidation(e))
              )
            }
          } else {
            // No filter - return empty for now
            runs = []
          }

          // Apply additional filters
          if (year !== undefined) {
            runs = runs.filter((r) => r.periodRef.year === year)
          }
          if (period !== undefined) {
            runs = runs.filter((r) => r.periodRef.period === period)
          }

          // Apply pagination
          const total = runs.length
          const limit = _.urlParams.limit ?? 100
          const offset = _.urlParams.offset ?? 0
          const paginatedRuns = runs.slice(offset, offset + limit)

          return {
            runs: paginatedRuns,
            total,
            limit,
            offset
          }
        })
      )
      .handle("getConsolidationRun", (_) =>
        Effect.gen(function* () {
          const runId = _.path.id

          const maybeRun = yield* consolidationRepo.findRun(runId).pipe(
            Effect.mapError((e) => mapPersistenceToNotFound("ConsolidationRun", runId, e))
          )

          return yield* Option.match(maybeRun, {
            onNone: () => Effect.fail(new NotFoundError({ resource: "ConsolidationRun", id: runId })),
            onSome: Effect.succeed
          })
        })
      )
      .handle("initiateConsolidationRun", (_) =>
        Effect.gen(function* () {
          const groupId = _.path.groupId
          const req = _.payload

          // Check group exists and is active
          const maybeGroup = yield* consolidationRepo.findGroup(groupId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (Option.isNone(maybeGroup)) {
            return yield* Effect.fail(new NotFoundError({ resource: "ConsolidationGroup", id: groupId }))
          }
          if (!maybeGroup.value.isActive) {
            return yield* Effect.fail(new BusinessRuleError({
              code: "GROUP_INACTIVE",
              message: "Cannot initiate run for inactive group",
              details: Option.none()
            }))
          }

          // Check for existing run for this period
          const existingRun = yield* consolidationRepo.findRunByGroupAndPeriod(groupId, req.periodRef).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (Option.isSome(existingRun) && !req.forceRegeneration) {
            return yield* Effect.fail(new BusinessRuleError({
              code: "RUN_EXISTS",
              message: `A consolidation run already exists for period ${req.periodRef.year}-${req.periodRef.period}`,
              details: Option.none()
            }))
          }

          // Create the run
          const newRun = ConsolidationRun.make({
            id: ConsolidationRunId.make(crypto.randomUUID()),
            groupId,
            periodRef: req.periodRef,
            asOfDate: req.asOfDate,
            status: "Pending",
            steps: createInitialSteps(),
            validationResult: Option.none(),
            consolidatedTrialBalance: Option.none(),
            eliminationEntryIds: Chunk.empty(),
            options: ConsolidationRunOptions.make({
              skipValidation: req.skipValidation ?? false,
              continueOnWarnings: req.continueOnWarnings ?? true,
              includeEquityMethodInvestments: req.includeEquityMethodInvestments ?? true,
              forceRegeneration: req.forceRegeneration ?? false
            }),
            initiatedBy: req.initiatedBy,
            initiatedAt: timestampNow(),
            startedAt: Option.none(),
            completedAt: Option.none(),
            totalDurationMs: Option.none(),
            errorMessage: Option.none()
          })

          return yield* consolidationRepo.createRun(newRun).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
        })
      )
      .handle("cancelConsolidationRun", (_) =>
        Effect.gen(function* () {
          const runId = _.path.id

          const maybeRun = yield* consolidationRepo.findRun(runId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (Option.isNone(maybeRun)) {
            return yield* Effect.fail(new NotFoundError({ resource: "ConsolidationRun", id: runId }))
          }
          const existing = maybeRun.value

          // Can only cancel pending or in-progress runs
          if (existing.status !== "Pending" && existing.status !== "InProgress") {
            return yield* Effect.fail(new BusinessRuleError({
              code: "CANNOT_CANCEL",
              message: `Cannot cancel run with status: ${existing.status}`,
              details: Option.none()
            }))
          }

          const updatedRun = ConsolidationRun.make({
            ...existing,
            status: "Cancelled",
            completedAt: Option.some(timestampNow())
          })

          return yield* consolidationRepo.updateRun(updatedRun).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
        })
      )
      .handle("deleteConsolidationRun", (_) =>
        Effect.gen(function* () {
          const runId = _.path.id

          const maybeRun = yield* consolidationRepo.findRun(runId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (Option.isNone(maybeRun)) {
            return yield* Effect.fail(new NotFoundError({ resource: "ConsolidationRun", id: runId }))
          }
          const existing = maybeRun.value

          // Can only delete pending or failed runs
          if (existing.status !== "Pending" && existing.status !== "Failed") {
            return yield* Effect.fail(new BusinessRuleError({
              code: "CANNOT_DELETE",
              message: `Cannot delete run with status: ${existing.status}`,
              details: Option.none()
            }))
          }

          yield* consolidationRepo.deleteRun(runId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
        })
      )
      .handle("getConsolidatedTrialBalance", (_) =>
        Effect.gen(function* () {
          const runId = _.path.id

          const maybeRun = yield* consolidationRepo.findRun(runId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (Option.isNone(maybeRun)) {
            return yield* Effect.fail(new NotFoundError({ resource: "ConsolidationRun", id: runId }))
          }
          const run = maybeRun.value

          if (run.status !== "Completed") {
            return yield* Effect.fail(new BusinessRuleError({
              code: "RUN_NOT_COMPLETED",
              message: `Consolidation run status is ${run.status}, not Completed`,
              details: Option.none()
            }))
          }

          if (Option.isNone(run.consolidatedTrialBalance)) {
            return yield* Effect.fail(new BusinessRuleError({
              code: "NO_TRIAL_BALANCE",
              message: "Consolidated trial balance not available for this run",
              details: Option.none()
            }))
          }

          return run.consolidatedTrialBalance.value
        })
      )
      .handle("getLatestCompletedRun", (_) =>
        Effect.gen(function* () {
          const groupId = _.path.groupId

          // Check group exists
          const exists = yield* consolidationRepo.groupExists(groupId).pipe(Effect.orDie)
          if (!exists) {
            return yield* Effect.fail(new NotFoundError({ resource: "ConsolidationGroup", id: groupId }))
          }

          const maybeRun = yield* consolidationRepo.findLatestCompletedRun(groupId).pipe(
            Effect.orDie
          )

          return maybeRun
        })
      )
  })
)
