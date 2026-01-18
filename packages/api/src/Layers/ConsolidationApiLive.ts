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
import {
  ConsolidatedReportService,
  isConsolidatedBalanceSheetNotBalancedError
} from "@accountability/core/Services/ConsolidatedReportService"
import { ConsolidationRepository } from "@accountability/persistence/Services/ConsolidationRepository"
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
import { requireOrganizationContext, requirePermission } from "./OrganizationContextMiddlewareLive.ts"
import { AuditLogService } from "@accountability/core/AuditLog/AuditLogService"
import { CurrentUserId } from "@accountability/core/AuditLog/CurrentUserId"

/**
 * Convert persistence errors to NotFoundError
 */
const mapPersistenceToNotFound = (
  resource: string,
  id: string,
  _error: EntityNotFoundError | PersistenceError
): NotFoundError => {
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
 * Helper to log consolidation group creation to audit log
 *
 * Uses the AuditLogService and CurrentUserId from the Effect context.
 * Errors are caught and silently ignored to not block business operations.
 *
 * @param group - The created consolidation group
 * @returns Effect that completes when audit logging is attempted
 */
const logConsolidationGroupCreate = (
  group: ConsolidationGroup
): Effect.Effect<void, never, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    yield* auditService.logCreate(
      group.organizationId,
      "ConsolidationGroup",
      group.id,
      group.name, // Human-readable group name for audit display
      group,
      userId
    )
  }).pipe(
    Effect.catchAll(() => Effect.void) // Silent failure - don't block business operations
  )

/**
 * Helper to log consolidation group update to audit log
 *
 * @param groupId - The group ID
 * @param before - The group state before the update
 * @param after - The group state after the update
 * @returns Effect that completes when audit logging is attempted
 */
const logConsolidationGroupUpdate = (
  groupId: ConsolidationGroupId,
  before: ConsolidationGroup,
  after: ConsolidationGroup
): Effect.Effect<void, never, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    yield* auditService.logUpdate(
      after.organizationId,
      "ConsolidationGroup",
      groupId,
      after.name, // Human-readable group name for audit display
      before,
      after,
      userId
    )
  }).pipe(
    Effect.catchAll(() => Effect.void) // Silent failure - don't block business operations
  )

/**
 * Helper to log consolidation group status change (activate/deactivate) to audit log
 *
 * @param organizationId - The organization this group belongs to
 * @param groupId - The group ID
 * @param previousStatus - The status before the change
 * @param newStatus - The status after the change
 * @returns Effect that completes when audit logging is attempted
 */
const logConsolidationGroupStatusChange = (
  organizationId: string,
  groupId: ConsolidationGroupId,
  groupName: string | null,
  previousStatus: string,
  newStatus: string
): Effect.Effect<void, never, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    yield* auditService.logStatusChange(
      organizationId,
      "ConsolidationGroup",
      groupId,
      groupName, // Human-readable group name for audit display
      previousStatus,
      newStatus,
      userId
    )
  }).pipe(
    Effect.catchAll(() => Effect.void) // Silent failure - don't block business operations
  )

/**
 * Helper to log consolidation run creation to audit log
 *
 * @param organizationId - The organization this run belongs to
 * @param run - The created consolidation run
 * @returns Effect that completes when audit logging is attempted
 */
const logConsolidationRunCreate = (
  organizationId: string,
  run: ConsolidationRun,
  groupName: string | null
): Effect.Effect<void, never, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    yield* auditService.logCreate(
      organizationId,
      "ConsolidationRun",
      run.id,
      groupName, // Use group name as the run name for audit display
      run,
      userId
    )
  }).pipe(
    Effect.catchAll(() => Effect.void) // Silent failure - don't block business operations
  )

/**
 * Helper to log consolidation run status change (cancel) to audit log
 *
 * @param organizationId - The organization this run belongs to
 * @param runId - The run ID
 * @param previousStatus - The status before the change
 * @param newStatus - The status after the change
 * @param reason - Optional reason for the status change
 * @returns Effect that completes when audit logging is attempted
 */
const logConsolidationRunStatusChange = (
  organizationId: string,
  runId: ConsolidationRunId,
  runName: string | null,
  previousStatus: string,
  newStatus: string,
  reason?: string
): Effect.Effect<void, never, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    yield* auditService.logStatusChange(
      organizationId,
      "ConsolidationRun",
      runId,
      runName, // Use group name as the run name for audit display
      previousStatus,
      newStatus,
      userId,
      reason
    )
  }).pipe(
    Effect.catchAll(() => Effect.void) // Silent failure - don't block business operations
  )

/**
 * Helper to log consolidation run deletion to audit log
 *
 * @param organizationId - The organization this run belongs to
 * @param run - The deleted consolidation run
 * @returns Effect that completes when audit logging is attempted
 */
const logConsolidationRunDelete = (
  organizationId: string,
  run: ConsolidationRun,
  groupName: string | null
): Effect.Effect<void, never, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    yield* auditService.logDelete(
      organizationId,
      "ConsolidationRun",
      run.id,
      groupName, // Use group name as the run name for audit display
      run,
      userId
    )
  }).pipe(
    Effect.catchAll(() => Effect.void) // Silent failure - don't block business operations
  )

/**
 * ConsolidationApiLive - Layer providing ConsolidationApi handlers
 *
 * Dependencies:
 * - ConsolidationRepository
 * - CompanyRepository
 * - AuditLogService (optional, for audit logging)
 * - CurrentUserId (optional, for audit logging)
 */
export const ConsolidationApiLive = HttpApiBuilder.group(AppApi, "consolidation", (handlers) =>
  Effect.gen(function* () {
    const consolidationRepo = yield* ConsolidationRepository
    const companyRepo = yield* CompanyRepository
    const reportService = yield* ConsolidatedReportService

    return handlers
      .handle("listConsolidationGroups", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("consolidation_group:read")

            const { organizationId, isActive } = _.urlParams

            let groups: ReadonlyArray<ConsolidationGroup>

            if (isActive === true) {
              groups = yield* consolidationRepo.findActiveGroups(organizationId).pipe(
                Effect.mapError((e) => mapPersistenceToValidation(e))
              )
            } else {
              groups = yield* consolidationRepo.findGroupsByOrganization(organizationId).pipe(
                Effect.mapError((e) => mapPersistenceToValidation(e))
              )
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
      )
      .handle("getConsolidationGroup", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("consolidation_group:read")

            const groupId = _.path.id
            const organizationId = _.urlParams.organizationId

            const maybeGroup = yield* consolidationRepo.findGroup(organizationId, groupId).pipe(
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
      )
      .handle("createConsolidationGroup", (_) =>
        requireOrganizationContext(_.payload.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("consolidation_group:create")

            const req = _.payload

            // Validate parent company exists within organization
            const parentCompanyExists = yield* companyRepo.exists(req.organizationId, req.parentCompanyId).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )
            if (!parentCompanyExists) {
              return yield* Effect.fail(new BusinessRuleError({
                code: "PARENT_COMPANY_NOT_FOUND",
                message: `Parent company not found: ${req.parentCompanyId}`,
                details: Option.none()
              }))
            }

            // Create members from input - using provided acquisition date or default to today
            const today = LocalDate.make({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate() })
            const members = Chunk.fromIterable(
              req.members.map((m) =>
                ConsolidationMember.make({
                  companyId: m.companyId,
                  ownershipPercentage: m.ownershipPercentage,
                  consolidationMethod: m.consolidationMethod,
                  acquisitionDate: Option.isSome(m.acquisitionDate) ? m.acquisitionDate.value : today,
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

            // Log audit entry for consolidation group creation
            yield* logConsolidationGroupCreate(createdGroup)

            return {
              group: createdGroup,
              members: Array.fromIterable(Chunk.toArray(createdGroup.members))
            }
          })
        )
      )
      .handle("updateConsolidationGroup", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("consolidation_group:update")

            const groupId = _.path.id
            const organizationId = _.urlParams.organizationId
            const req = _.payload

            // Get existing group
            const maybeExisting = yield* consolidationRepo.findGroup(organizationId, groupId).pipe(
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

            const savedGroup = yield* consolidationRepo.updateGroup(organizationId, updatedGroup).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )

            // Log audit entry for consolidation group update
            yield* logConsolidationGroupUpdate(groupId, existing, savedGroup)

            return savedGroup
          })
        )
      )
      .handle("deleteConsolidationGroup", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("consolidation_group:delete")

            const groupId = _.path.id
            const organizationId = _.urlParams.organizationId

            // Check if exists
            const exists = yield* consolidationRepo.groupExists(organizationId, groupId).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )
            if (!exists) {
              return yield* Effect.fail(new NotFoundError({ resource: "ConsolidationGroup", id: groupId }))
            }

            // Check for completed runs
            const runs = yield* consolidationRepo.findRunsByGroup(organizationId, groupId).pipe(
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
      )
      .handle("activateConsolidationGroup", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("consolidation_group:update")

            const groupId = _.path.id
            const organizationId = _.urlParams.organizationId

            const maybeGroup = yield* consolidationRepo.findGroup(organizationId, groupId).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )
            if (Option.isNone(maybeGroup)) {
              return yield* Effect.fail(new NotFoundError({ resource: "ConsolidationGroup", id: groupId }))
            }

            const existing = maybeGroup.value
            const updatedGroup = ConsolidationGroup.make({
              ...existing,
              isActive: true
            })

            const savedGroup = yield* consolidationRepo.updateGroup(organizationId, updatedGroup).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )

            // Log audit entry for consolidation group activation
            yield* logConsolidationGroupStatusChange(
              organizationId,
              groupId,
              existing.name,
              existing.isActive ? "Active" : "Inactive",
              "Active"
            )

            return savedGroup
          })
        )
      )
      .handle("deactivateConsolidationGroup", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("consolidation_group:update")

            const groupId = _.path.id
            const organizationId = _.urlParams.organizationId

            const maybeGroup = yield* consolidationRepo.findGroup(organizationId, groupId).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )
            if (Option.isNone(maybeGroup)) {
              return yield* Effect.fail(new NotFoundError({ resource: "ConsolidationGroup", id: groupId }))
            }

            const existing = maybeGroup.value
            const updatedGroup = ConsolidationGroup.make({
              ...existing,
              isActive: false
            })

            const savedGroup = yield* consolidationRepo.updateGroup(organizationId, updatedGroup).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )

            // Log audit entry for consolidation group deactivation
            yield* logConsolidationGroupStatusChange(
              organizationId,
              groupId,
              existing.name,
              existing.isActive ? "Active" : "Inactive",
              "Inactive"
            )

            return savedGroup
          })
        )
      )
      .handle("addGroupMember", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("consolidation_group:update")

            const groupId = _.path.id
            const organizationId = _.urlParams.organizationId
            const req = _.payload

            // Get existing group
            const maybeGroup = yield* consolidationRepo.findGroup(organizationId, groupId).pipe(
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

            // Create new member - using provided acquisition date or default to today
            const today = LocalDate.make({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate() })
            const newMember = ConsolidationMember.make({
              companyId: req.companyId,
              ownershipPercentage: req.ownershipPercentage,
              consolidationMethod: req.consolidationMethod,
              acquisitionDate: Option.isSome(req.acquisitionDate) ? req.acquisitionDate.value : today,
              goodwillAmount: Option.none(),
              nonControllingInterestPercentage: Percentage.make(100 - req.ownershipPercentage),
              vieDetermination: Option.none()
            })

            // Add member to group
            const updatedGroup = ConsolidationGroup.make({
              ...existing,
              members: Chunk.append(existing.members, newMember)
            })

            const savedGroup = yield* consolidationRepo.updateGroup(organizationId, updatedGroup).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )

            // Log audit entry for member addition (group update)
            yield* logConsolidationGroupUpdate(groupId, existing, savedGroup)

            return {
              group: savedGroup,
              members: Array.fromIterable(Chunk.toArray(savedGroup.members))
            }
          })
        )
      )
      .handle("updateGroupMember", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("consolidation_group:update")

            const groupId = _.path.id
            const companyId = _.path.companyId
            const organizationId = _.urlParams.organizationId
            const req = _.payload

            // Get existing group
            const maybeGroup = yield* consolidationRepo.findGroup(organizationId, groupId).pipe(
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
              acquisitionDate: Option.isSome(req.acquisitionDate)
                ? req.acquisitionDate.value
                : oldMember.acquisitionDate,
              nonControllingInterestPercentage: Percentage.make(100 - newOwnership)
            })

            // Replace member in list
            const updatedMembers = Chunk.modify(existing.members, memberIndex.value, () => updatedMember)

            const updatedGroup = ConsolidationGroup.make({
              ...existing,
              members: updatedMembers
            })

            const savedGroup = yield* consolidationRepo.updateGroup(organizationId, updatedGroup).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )

            // Log audit entry for member update (group update)
            yield* logConsolidationGroupUpdate(groupId, existing, savedGroup)

            return {
              group: savedGroup,
              members: Array.fromIterable(Chunk.toArray(savedGroup.members))
            }
          })
        )
      )
      .handle("removeGroupMember", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("consolidation_group:update")

            const groupId = _.path.id
            const companyId = _.path.companyId
            const organizationId = _.urlParams.organizationId

            // Get existing group
            const maybeGroup = yield* consolidationRepo.findGroup(organizationId, groupId).pipe(
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

            const savedGroup = yield* consolidationRepo.updateGroup(organizationId, updatedGroup).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )

            // Log audit entry for member removal (group update)
            yield* logConsolidationGroupUpdate(groupId, existing, savedGroup)

            return {
              group: savedGroup,
              members: Array.fromIterable(Chunk.toArray(savedGroup.members))
            }
          })
        )
      )
      .handle("listConsolidationRuns", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("consolidation_group:read")

            const { organizationId, groupId, status, year, period } = _.urlParams

            let runs: ReadonlyArray<ConsolidationRun>

            if (groupId !== undefined) {
              if (status !== undefined) {
                runs = yield* consolidationRepo.findRunsByStatus(organizationId, groupId, status).pipe(
                  Effect.mapError((e) => mapPersistenceToValidation(e))
                )
              } else {
                runs = yield* consolidationRepo.findRunsByGroup(organizationId, groupId).pipe(
                  Effect.mapError((e) => mapPersistenceToValidation(e))
                )
              }
            } else {
              // No groupId filter - return empty for now (requires groupId to scope by org)
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
      )
      .handle("getConsolidationRun", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("consolidation_group:read")

            const runId = _.path.id
            const organizationId = _.urlParams.organizationId

            const maybeRun = yield* consolidationRepo.findRun(organizationId, runId).pipe(
              Effect.mapError((e) => mapPersistenceToNotFound("ConsolidationRun", runId, e))
            )

            return yield* Option.match(maybeRun, {
              onNone: () => Effect.fail(new NotFoundError({ resource: "ConsolidationRun", id: runId })),
              onSome: Effect.succeed
            })
          })
        )
      )
      .handle("initiateConsolidationRun", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("consolidation_group:run")

            const groupId = _.path.groupId
            const organizationId = _.urlParams.organizationId
            const req = _.payload

            // Check group exists and is active
            const maybeGroup = yield* consolidationRepo.findGroup(organizationId, groupId).pipe(
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
            const existingRun = yield* consolidationRepo.findRunByGroupAndPeriod(organizationId, groupId, req.periodRef).pipe(
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

            const createdRun = yield* consolidationRepo.createRun(newRun).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )

            // Log audit entry for consolidation run creation
            yield* logConsolidationRunCreate(organizationId, createdRun, maybeGroup.value.name)

            return createdRun
          })
        )
      )
      .handle("cancelConsolidationRun", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("consolidation_group:run")

            const runId = _.path.id
            const organizationId = _.urlParams.organizationId

            const maybeRun = yield* consolidationRepo.findRun(organizationId, runId).pipe(
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

            const savedRun = yield* consolidationRepo.updateRun(organizationId, updatedRun).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )

            // Log audit entry for consolidation run cancellation
            // Note: We pass null for group name since we don't have it loaded in this context
            yield* logConsolidationRunStatusChange(
              organizationId,
              runId,
              null,
              existing.status,
              "Cancelled",
              "Run cancelled by user"
            )

            return savedRun
          })
        )
      )
      .handle("deleteConsolidationRun", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("consolidation_group:run")

            const runId = _.path.id
            const organizationId = _.urlParams.organizationId

            const maybeRun = yield* consolidationRepo.findRun(organizationId, runId).pipe(
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

            // Log audit entry for consolidation run deletion (before deletion)
            // Note: We pass null for group name since we don't have it loaded in this context
            yield* logConsolidationRunDelete(organizationId, existing, null)

            yield* consolidationRepo.deleteRun(organizationId, runId).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )
          })
        )
      )
      .handle("getConsolidatedTrialBalance", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("consolidation_group:read")

            const runId = _.path.id
            const organizationId = _.urlParams.organizationId

            const maybeRun = yield* consolidationRepo.findRun(organizationId, runId).pipe(
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
      )
      .handle("getLatestCompletedRun", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("consolidation_group:read")

            const groupId = _.path.groupId
            const organizationId = _.urlParams.organizationId

            // Check group exists
            const exists = yield* consolidationRepo.groupExists(organizationId, groupId).pipe(Effect.orDie)
            if (!exists) {
              return yield* Effect.fail(new NotFoundError({ resource: "ConsolidationGroup", id: groupId }))
            }

            const maybeRun = yield* consolidationRepo.findLatestCompletedRun(organizationId, groupId).pipe(
              Effect.orDie
            )

            return maybeRun
          })
        )
      )
      .handle("getConsolidatedBalanceSheet", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("report:read")

            const runId = _.path.id
            const organizationId = _.urlParams.organizationId

            // Check run exists and is completed
            const maybeRun = yield* consolidationRepo.findRun(organizationId, runId).pipe(
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

            // Get consolidated trial balance
            if (Option.isNone(run.consolidatedTrialBalance)) {
              return yield* Effect.fail(new BusinessRuleError({
                code: "NO_TRIAL_BALANCE",
                message: "Consolidated trial balance not available for this run",
                details: Option.none()
              }))
            }
            const trialBalance = run.consolidatedTrialBalance.value

            // Get group name
            const maybeGroup = yield* consolidationRepo.findGroup(organizationId, run.groupId).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )
            const groupName = Option.isSome(maybeGroup) ? maybeGroup.value.name : "Consolidation Group"

            // Generate the balance sheet report
            const report = yield* reportService.generateBalanceSheet({
              trialBalance,
              groupName
            }).pipe(
              Effect.mapError((e) => {
                if (isConsolidatedBalanceSheetNotBalancedError(e)) {
                  return new BusinessRuleError({
                    code: "BALANCE_SHEET_NOT_BALANCED",
                    message: e.message,
                    details: Option.none()
                  })
                }
                return new BusinessRuleError({
                  code: "REPORT_GENERATION_ERROR",
                  message: "Failed to generate balance sheet report",
                  details: Option.none()
                })
              })
            )

            return report
          })
        )
      )
      .handle("getConsolidatedIncomeStatement", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("report:read")

            const runId = _.path.id
            const organizationId = _.urlParams.organizationId

            // Check run exists and is completed
            const maybeRun = yield* consolidationRepo.findRun(organizationId, runId).pipe(
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

            // Get consolidated trial balance
            if (Option.isNone(run.consolidatedTrialBalance)) {
              return yield* Effect.fail(new BusinessRuleError({
                code: "NO_TRIAL_BALANCE",
                message: "Consolidated trial balance not available for this run",
                details: Option.none()
              }))
            }
            const trialBalance = run.consolidatedTrialBalance.value

            // Get group name
            const maybeGroup = yield* consolidationRepo.findGroup(organizationId, run.groupId).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )
            const groupName = Option.isSome(maybeGroup) ? maybeGroup.value.name : "Consolidation Group"

            // Generate the income statement report
            const report = yield* reportService.generateIncomeStatement({
              trialBalance,
              groupName
            })

            return report
          })
        )
      )
      .handle("getConsolidatedCashFlowStatement", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("report:read")

            const runId = _.path.id
            const organizationId = _.urlParams.organizationId

            // Check run exists and is completed
            const maybeRun = yield* consolidationRepo.findRun(organizationId, runId).pipe(
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

            // Get consolidated trial balance
            if (Option.isNone(run.consolidatedTrialBalance)) {
              return yield* Effect.fail(new BusinessRuleError({
                code: "NO_TRIAL_BALANCE",
                message: "Consolidated trial balance not available for this run",
                details: Option.none()
              }))
            }
            const trialBalance = run.consolidatedTrialBalance.value

            // Get group name
            const maybeGroup = yield* consolidationRepo.findGroup(organizationId, run.groupId).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )
            const groupName = Option.isSome(maybeGroup) ? maybeGroup.value.name : "Consolidation Group"

            // Generate the cash flow report
            const report = yield* reportService.generateCashFlow({
              trialBalance,
              groupName
            })

            return report
          })
        )
      )
      .handle("getConsolidatedEquityStatement", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("report:read")

            const runId = _.path.id
            const organizationId = _.urlParams.organizationId

            // Check run exists and is completed
            const maybeRun = yield* consolidationRepo.findRun(organizationId, runId).pipe(
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

            // Get consolidated trial balance
            if (Option.isNone(run.consolidatedTrialBalance)) {
              return yield* Effect.fail(new BusinessRuleError({
                code: "NO_TRIAL_BALANCE",
                message: "Consolidated trial balance not available for this run",
                details: Option.none()
              }))
            }
            const trialBalance = run.consolidatedTrialBalance.value

            // Get group name
            const maybeGroup = yield* consolidationRepo.findGroup(organizationId, run.groupId).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )
            const groupName = Option.isSome(maybeGroup) ? maybeGroup.value.name : "Consolidation Group"

            // Generate the equity statement report
            const report = yield* reportService.generateEquityStatement({
              trialBalance,
              groupName
            })

            return report
          })
        )
      )
  })
)
