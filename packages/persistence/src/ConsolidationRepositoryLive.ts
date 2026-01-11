/**
 * ConsolidationRepositoryLive - PostgreSQL implementation of ConsolidationRepository
 *
 * Uses @effect/sql-pg for database operations with proper error handling
 * and Schema decoding for type-safe query results.
 *
 * Note: ConsolidationGroup and ConsolidationRun have complex nested structures.
 * Members are stored in consolidation_members table, steps in consolidation_run_steps.
 *
 * @module ConsolidationRepositoryLive
 */

import { SqlClient } from "@effect/sql"
import * as Cause from "effect/Cause"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { CompanyId, type ConsolidationMethod } from "@accountability/core/domain/Company"
import {
  ConsolidationGroup,
  ConsolidationGroupId,
  ConsolidationMember,
  EliminationRuleId,
  VIEDetermination
} from "@accountability/core/domain/ConsolidationGroup"
import {
  ConsolidatedTrialBalance,
  ConsolidationRun,
  ConsolidationRunId,
  type ConsolidationRunStatus,
  ConsolidationStep,
  type ConsolidationStepStatus,
  type ConsolidationStepType,
  ValidationResult
} from "@accountability/core/domain/ConsolidationRun"
import type { CurrencyCode } from "@accountability/core/domain/CurrencyCode"
import { FiscalPeriodRef } from "@accountability/core/domain/FiscalPeriodRef"
import { LocalDate } from "@accountability/core/domain/LocalDate"
import { OrganizationId } from "@accountability/core/domain/Organization"
import { Timestamp } from "@accountability/core/domain/Timestamp"
import { UserId } from "@accountability/core/domain/JournalEntry"
import { Percentage } from "@accountability/core/domain/Percentage"
import { ConsolidationRepository, type ConsolidationRepositoryService } from "./ConsolidationRepository.ts"
import { EntityNotFoundError, PersistenceError } from "./RepositoryError.ts"

/**
 * Database row types
 */
interface ConsolidationGroupRow {
  readonly id: string
  readonly organization_id: string
  readonly name: string
  readonly reporting_currency: string
  readonly consolidation_method: string
  readonly parent_company_id: string
  readonly is_active: boolean
}

interface ConsolidationMemberRow {
  readonly id: string
  readonly consolidation_group_id: string
  readonly company_id: string
  readonly ownership_percentage: string
  readonly consolidation_method: string
  readonly acquisition_date: Date
  readonly goodwill_amount: string | null // JSONB
  readonly non_controlling_interest_percentage: string
  readonly vie_determination: string | null // JSONB
}

interface EliminationRuleIdRow {
  readonly id: string
}

interface ConsolidationRunRow {
  readonly id: string
  readonly group_id: string
  readonly period_year: number
  readonly period_number: number
  readonly as_of_date: Date
  readonly status: string
  readonly steps: string // JSONB
  readonly validation_result: string | null // JSONB
  readonly consolidated_trial_balance: string | null // JSONB
  readonly elimination_entry_ids: string // JSONB array
  readonly options: string // JSONB
  readonly initiated_by: string
  readonly initiated_at: Date
  readonly started_at: Date | null
  readonly completed_at: Date | null
  readonly total_duration_ms: number | null
  readonly error_message: string | null
}

/**
 * Convert Date to LocalDate
 */
const dateToLocalDate = (date: Date): LocalDate =>
  LocalDate.make(
    { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() },
    { disableValidation: true }
  )

/**
 * Wrap SQL errors in PersistenceError
 */
const wrapSqlError =
  (operation: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, PersistenceError, R> =>
    Effect.catchAllCause(effect, (cause) =>
      Effect.fail(new PersistenceError({ operation, cause: Cause.squash(cause) }))
    )

/**
 * Implementation of ConsolidationRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Helper to load members for a group
  const loadMembers = (groupId: string): Effect.Effect<Chunk.Chunk<ConsolidationMember>, PersistenceError> =>
    Effect.gen(function* () {
      const rows = yield* sql<ConsolidationMemberRow>`
        SELECT * FROM consolidation_members
        WHERE consolidation_group_id = ${groupId}
        ORDER BY company_id
      `.pipe(wrapSqlError("loadMembers"))

      const members = rows.map((row) => {
        const goodwillAmount = row.goodwill_amount !== null
          ? Option.some(JSON.parse(row.goodwill_amount))
          : Option.none<unknown>()

        const vieDetermination = row.vie_determination !== null
          ? Option.some(
              VIEDetermination.make(JSON.parse(row.vie_determination), { disableValidation: true })
            )
          : Option.none<VIEDetermination>()

        return ConsolidationMember.make(
          {
            companyId: CompanyId.make(row.company_id, { disableValidation: true }),
            ownershipPercentage: Percentage.make(parseFloat(row.ownership_percentage), { disableValidation: true }),
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Database string to union type
            consolidationMethod: row.consolidation_method as ConsolidationMethod,
            acquisitionDate: dateToLocalDate(row.acquisition_date),
            goodwillAmount,
            nonControllingInterestPercentage: Percentage.make(
              parseFloat(row.non_controlling_interest_percentage),
              { disableValidation: true }
            ),
            vieDetermination
          },
          { disableValidation: true }
        )
      })

      return Chunk.fromIterable(members)
    })

  // Helper to load elimination rule IDs for a group
  const loadEliminationRuleIds = (groupId: string): Effect.Effect<Chunk.Chunk<EliminationRuleId>, PersistenceError> =>
    Effect.gen(function* () {
      const rows = yield* sql<EliminationRuleIdRow>`
        SELECT id FROM elimination_rules
        WHERE consolidation_group_id = ${groupId}
        ORDER BY priority
      `.pipe(wrapSqlError("loadEliminationRuleIds"))

      return Chunk.fromIterable(
        rows.map((row) => EliminationRuleId.make(row.id, { disableValidation: true }))
      )
    })

  // Helper to convert group row to entity
  const rowToConsolidationGroup = (
    row: ConsolidationGroupRow
  ): Effect.Effect<ConsolidationGroup, PersistenceError> =>
    Effect.gen(function* () {
      const members = yield* loadMembers(row.id)
      const eliminationRuleIds = yield* loadEliminationRuleIds(row.id)

      return ConsolidationGroup.make(
        {
          id: ConsolidationGroupId.make(row.id, { disableValidation: true }),
          organizationId: OrganizationId.make(row.organization_id, { disableValidation: true }),
          name: row.name,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Database string to union type
          reportingCurrency: row.reporting_currency as CurrencyCode,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Database string to union type
          consolidationMethod: row.consolidation_method as ConsolidationMethod,
          parentCompanyId: CompanyId.make(row.parent_company_id, { disableValidation: true }),
          members,
          eliminationRuleIds,
          isActive: row.is_active
        },
        { disableValidation: true }
      )
    })

  // Helper to convert run row to entity
  const rowToConsolidationRun = (row: ConsolidationRunRow): Effect.Effect<ConsolidationRun, PersistenceError> =>
    Effect.try({
      try: () => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- JSON parse result needs type assertion
        const stepsJson = JSON.parse(row.steps) as Array<{
          stepType: ConsolidationStepType
          status: ConsolidationStepStatus
          startedAt: number | null
          completedAt: number | null
          durationMs: number | null
          errorMessage: string | null
          details: string | null
        }>

        const steps = Chunk.fromIterable(
          stepsJson.map((s) =>
            ConsolidationStep.make(
              {
                stepType: s.stepType,
                status: s.status,
                startedAt: s.startedAt !== null
                  ? Option.some(Timestamp.make({ epochMillis: s.startedAt }, { disableValidation: true }))
                  : Option.none<Timestamp>(),
                completedAt: s.completedAt !== null
                  ? Option.some(Timestamp.make({ epochMillis: s.completedAt }, { disableValidation: true }))
                  : Option.none<Timestamp>(),
                durationMs: s.durationMs !== null ? Option.some(s.durationMs) : Option.none<number>(),
                errorMessage: s.errorMessage !== null
                  ? Option.some(s.errorMessage)
                  : Option.none<string>(),
                details: s.details !== null
                  ? Option.some(s.details)
                  : Option.none<string>()
              },
              { disableValidation: true }
            )
          )
        )

        const validationResult = row.validation_result !== null
          ? Option.some(ValidationResult.make(JSON.parse(row.validation_result), { disableValidation: true }))
          : Option.none<ValidationResult>()

        const consolidatedTrialBalance = row.consolidated_trial_balance !== null
          ? Option.some(
              ConsolidatedTrialBalance.make(JSON.parse(row.consolidated_trial_balance), { disableValidation: true })
            )
          : Option.none<ConsolidatedTrialBalance>()

        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- JSON parse result needs type assertion
        const eliminationEntryIdStrings = JSON.parse(row.elimination_entry_ids) as string[]
        const eliminationEntryIds = Chunk.fromIterable(
          eliminationEntryIdStrings.map(
            (id) => Schema.UUID.pipe(Schema.brand("EliminationEntryId")).make(id, { disableValidation: true })
          )
        )

        const options = JSON.parse(row.options)

        return ConsolidationRun.make(
          {
            id: ConsolidationRunId.make(row.id, { disableValidation: true }),
            groupId: ConsolidationGroupId.make(row.group_id, { disableValidation: true }),
            periodRef: FiscalPeriodRef.make(
              { year: row.period_year, period: row.period_number },
              { disableValidation: true }
            ),
            asOfDate: dateToLocalDate(row.as_of_date),
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Database string to union type
            status: row.status as ConsolidationRunStatus,
            steps,
            validationResult,
            consolidatedTrialBalance,
            eliminationEntryIds,
            options,
            initiatedBy: UserId.make(row.initiated_by, { disableValidation: true }),
            initiatedAt: Timestamp.make({ epochMillis: row.initiated_at.getTime() }, { disableValidation: true }),
            startedAt: row.started_at !== null
              ? Option.some(Timestamp.make({ epochMillis: row.started_at.getTime() }, { disableValidation: true }))
              : Option.none<Timestamp>(),
            completedAt: row.completed_at !== null
              ? Option.some(Timestamp.make({ epochMillis: row.completed_at.getTime() }, { disableValidation: true }))
              : Option.none<Timestamp>(),
            totalDurationMs: row.total_duration_ms !== null ? Option.some(row.total_duration_ms) : Option.none<number>(),
            errorMessage: row.error_message !== null
              ? Option.some(row.error_message)
              : Option.none<string>()
          },
          { disableValidation: true }
        )
      },
      catch: (cause) => new PersistenceError({ operation: "rowToConsolidationRun", cause })
    })

  // ConsolidationGroup operations
  const findGroup: ConsolidationRepositoryService["findGroup"] = (id) =>
    Effect.gen(function* () {
      const rows = yield* sql<ConsolidationGroupRow>`
        SELECT * FROM consolidation_groups WHERE id = ${id}
      `.pipe(wrapSqlError("findGroup"))

      if (rows.length === 0) {
        return Option.none()
      }

      const group = yield* rowToConsolidationGroup(rows[0])
      return Option.some(group)
    })

  const getGroup: ConsolidationRepositoryService["getGroup"] = (id) =>
    Effect.gen(function* () {
      const maybeGroup = yield* findGroup(id)
      return yield* Option.match(maybeGroup, {
        onNone: () => Effect.fail(new EntityNotFoundError({ entityType: "ConsolidationGroup", entityId: id })),
        onSome: Effect.succeed
      })
    })

  const findGroupsByOrganization: ConsolidationRepositoryService["findGroupsByOrganization"] = (organizationId) =>
    Effect.gen(function* () {
      const rows = yield* sql<ConsolidationGroupRow>`
        SELECT * FROM consolidation_groups
        WHERE organization_id = ${organizationId}
        ORDER BY name
      `.pipe(wrapSqlError("findGroupsByOrganization"))

      return yield* Effect.forEach(rows, rowToConsolidationGroup)
    })

  const findActiveGroups: ConsolidationRepositoryService["findActiveGroups"] = (organizationId) =>
    Effect.gen(function* () {
      const rows = yield* sql<ConsolidationGroupRow>`
        SELECT * FROM consolidation_groups
        WHERE organization_id = ${organizationId} AND is_active = true
        ORDER BY name
      `.pipe(wrapSqlError("findActiveGroups"))

      return yield* Effect.forEach(rows, rowToConsolidationGroup)
    })

  const createGroup: ConsolidationRepositoryService["createGroup"] = (group) =>
    Effect.gen(function* () {
      // Insert group
      yield* sql`
        INSERT INTO consolidation_groups (
          id, organization_id, name, reporting_currency,
          consolidation_method, parent_company_id, is_active
        ) VALUES (
          ${group.id},
          ${group.organizationId},
          ${group.name},
          ${group.reportingCurrency},
          ${group.consolidationMethod},
          ${group.parentCompanyId},
          ${group.isActive}
        )
      `.pipe(wrapSqlError("createGroup"))

      // Insert members
      for (const member of group.members) {
        yield* sql`
          INSERT INTO consolidation_members (
            id, consolidation_group_id, company_id, ownership_percentage,
            consolidation_method, acquisition_date, goodwill_amount,
            non_controlling_interest_percentage, vie_determination
          ) VALUES (
            ${crypto.randomUUID()},
            ${group.id},
            ${member.companyId},
            ${member.ownershipPercentage},
            ${member.consolidationMethod},
            ${member.acquisitionDate.toDate()},
            ${Option.match(member.goodwillAmount, { onNone: () => null, onSome: (v) => JSON.stringify(v) })},
            ${member.nonControllingInterestPercentage},
            ${Option.match(member.vieDetermination, { onNone: () => null, onSome: (v) => JSON.stringify(v) })}
          )
        `.pipe(wrapSqlError("createGroup:members"))
      }

      return group
    })

  const updateGroup: ConsolidationRepositoryService["updateGroup"] = (group) =>
    Effect.gen(function* () {
      const result = yield* sql`
        UPDATE consolidation_groups SET
          name = ${group.name},
          reporting_currency = ${group.reportingCurrency},
          consolidation_method = ${group.consolidationMethod},
          parent_company_id = ${group.parentCompanyId},
          is_active = ${group.isActive}
        WHERE id = ${group.id}
      `.pipe(wrapSqlError("updateGroup"))

      if (result.length === 0) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "ConsolidationGroup", entityId: group.id })
        )
      }

      // Update members: delete all and re-insert
      yield* sql`
        DELETE FROM consolidation_members WHERE consolidation_group_id = ${group.id}
      `.pipe(wrapSqlError("updateGroup:deleteMembers"))

      for (const member of group.members) {
        yield* sql`
          INSERT INTO consolidation_members (
            id, consolidation_group_id, company_id, ownership_percentage,
            consolidation_method, acquisition_date, goodwill_amount,
            non_controlling_interest_percentage, vie_determination
          ) VALUES (
            ${crypto.randomUUID()},
            ${group.id},
            ${member.companyId},
            ${member.ownershipPercentage},
            ${member.consolidationMethod},
            ${member.acquisitionDate.toDate()},
            ${Option.match(member.goodwillAmount, { onNone: () => null, onSome: (v) => JSON.stringify(v) })},
            ${member.nonControllingInterestPercentage},
            ${Option.match(member.vieDetermination, { onNone: () => null, onSome: (v) => JSON.stringify(v) })}
          )
        `.pipe(wrapSqlError("updateGroup:insertMembers"))
      }

      return group
    })

  const groupExists: ConsolidationRepositoryService["groupExists"] = (id) =>
    Effect.gen(function* () {
      const rows = yield* sql<{ count: string }>`
        SELECT COUNT(*) as count FROM consolidation_groups WHERE id = ${id}
      `.pipe(wrapSqlError("groupExists"))

      return parseInt(rows[0].count, 10) > 0
    })

  // ConsolidationRun operations
  const findRun: ConsolidationRepositoryService["findRun"] = (id) =>
    Effect.gen(function* () {
      const rows = yield* sql<ConsolidationRunRow>`
        SELECT * FROM consolidation_runs WHERE id = ${id}
      `.pipe(wrapSqlError("findRun"))

      if (rows.length === 0) {
        return Option.none()
      }

      const run = yield* rowToConsolidationRun(rows[0])
      return Option.some(run)
    })

  const getRun: ConsolidationRepositoryService["getRun"] = (id) =>
    Effect.gen(function* () {
      const maybeRun = yield* findRun(id)
      return yield* Option.match(maybeRun, {
        onNone: () => Effect.fail(new EntityNotFoundError({ entityType: "ConsolidationRun", entityId: id })),
        onSome: Effect.succeed
      })
    })

  const createRun: ConsolidationRepositoryService["createRun"] = (run) =>
    Effect.gen(function* () {
      const stepsJson = JSON.stringify(
        Chunk.toReadonlyArray(run.steps).map((s) => ({
          stepType: s.stepType,
          status: s.status,
          startedAt: Option.match(s.startedAt, { onNone: () => null, onSome: (t) => t.epochMillis }),
          completedAt: Option.match(s.completedAt, { onNone: () => null, onSome: (t) => t.epochMillis }),
          durationMs: Option.getOrNull(s.durationMs),
          errorMessage: Option.getOrNull(s.errorMessage),
          details: Option.getOrNull(s.details)
        }))
      )

      yield* sql`
        INSERT INTO consolidation_runs (
          id, group_id, period_year, period_number, as_of_date,
          status, steps, validation_result, consolidated_trial_balance,
          elimination_entry_ids, options, initiated_by, initiated_at,
          started_at, completed_at, total_duration_ms, error_message
        ) VALUES (
          ${run.id},
          ${run.groupId},
          ${run.periodRef.year},
          ${run.periodRef.period},
          ${run.asOfDate.toDate()},
          ${run.status},
          ${stepsJson}::jsonb,
          ${Option.match(run.validationResult, { onNone: () => null, onSome: (v) => JSON.stringify(v) })}::jsonb,
          ${Option.match(run.consolidatedTrialBalance, { onNone: () => null, onSome: (v) => JSON.stringify(v) })}::jsonb,
          ${JSON.stringify(Chunk.toReadonlyArray(run.eliminationEntryIds))}::jsonb,
          ${JSON.stringify(run.options)}::jsonb,
          ${run.initiatedBy},
          ${run.initiatedAt.toDate()},
          ${Option.match(run.startedAt, { onNone: () => null, onSome: (t) => t.toDate() })},
          ${Option.match(run.completedAt, { onNone: () => null, onSome: (t) => t.toDate() })},
          ${Option.getOrNull(run.totalDurationMs)},
          ${Option.getOrNull(run.errorMessage)}
        )
      `.pipe(wrapSqlError("createRun"))

      return run
    })

  const updateRun: ConsolidationRepositoryService["updateRun"] = (run) =>
    Effect.gen(function* () {
      const stepsJson = JSON.stringify(
        Chunk.toReadonlyArray(run.steps).map((s) => ({
          stepType: s.stepType,
          status: s.status,
          startedAt: Option.match(s.startedAt, { onNone: () => null, onSome: (t) => t.epochMillis }),
          completedAt: Option.match(s.completedAt, { onNone: () => null, onSome: (t) => t.epochMillis }),
          durationMs: Option.getOrNull(s.durationMs),
          errorMessage: Option.getOrNull(s.errorMessage),
          details: Option.getOrNull(s.details)
        }))
      )

      const result = yield* sql`
        UPDATE consolidation_runs SET
          status = ${run.status},
          steps = ${stepsJson}::jsonb,
          validation_result = ${Option.match(run.validationResult, { onNone: () => null, onSome: (v) => JSON.stringify(v) })}::jsonb,
          consolidated_trial_balance = ${Option.match(run.consolidatedTrialBalance, { onNone: () => null, onSome: (v) => JSON.stringify(v) })}::jsonb,
          elimination_entry_ids = ${JSON.stringify(Chunk.toReadonlyArray(run.eliminationEntryIds))}::jsonb,
          started_at = ${Option.match(run.startedAt, { onNone: () => null, onSome: (t) => t.toDate() })},
          completed_at = ${Option.match(run.completedAt, { onNone: () => null, onSome: (t) => t.toDate() })},
          total_duration_ms = ${Option.getOrNull(run.totalDurationMs)},
          error_message = ${Option.getOrNull(run.errorMessage)}
        WHERE id = ${run.id}
      `.pipe(wrapSqlError("updateRun"))

      if (result.length === 0) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "ConsolidationRun", entityId: run.id })
        )
      }

      return run
    })

  const findRunsByGroup: ConsolidationRepositoryService["findRunsByGroup"] = (groupId) =>
    Effect.gen(function* () {
      const rows = yield* sql<ConsolidationRunRow>`
        SELECT * FROM consolidation_runs
        WHERE group_id = ${groupId}
        ORDER BY initiated_at DESC
      `.pipe(wrapSqlError("findRunsByGroup"))

      return yield* Effect.forEach(rows, rowToConsolidationRun)
    })

  const findRunByGroupAndPeriod: ConsolidationRepositoryService["findRunByGroupAndPeriod"] = (groupId, period) =>
    Effect.gen(function* () {
      const rows = yield* sql<ConsolidationRunRow>`
        SELECT * FROM consolidation_runs
        WHERE group_id = ${groupId}
          AND period_year = ${period.year}
          AND period_number = ${period.period}
        ORDER BY initiated_at DESC
        LIMIT 1
      `.pipe(wrapSqlError("findRunByGroupAndPeriod"))

      if (rows.length === 0) {
        return Option.none()
      }

      const run = yield* rowToConsolidationRun(rows[0])
      return Option.some(run)
    })

  const findRunsByStatus: ConsolidationRepositoryService["findRunsByStatus"] = (groupId, status) =>
    Effect.gen(function* () {
      const rows = yield* sql<ConsolidationRunRow>`
        SELECT * FROM consolidation_runs
        WHERE group_id = ${groupId} AND status = ${status}
        ORDER BY initiated_at DESC
      `.pipe(wrapSqlError("findRunsByStatus"))

      return yield* Effect.forEach(rows, rowToConsolidationRun)
    })

  const findLatestCompletedRun: ConsolidationRepositoryService["findLatestCompletedRun"] = (groupId) =>
    Effect.gen(function* () {
      const rows = yield* sql<ConsolidationRunRow>`
        SELECT * FROM consolidation_runs
        WHERE group_id = ${groupId} AND status = 'Completed'
        ORDER BY completed_at DESC
        LIMIT 1
      `.pipe(wrapSqlError("findLatestCompletedRun"))

      if (rows.length === 0) {
        return Option.none()
      }

      const run = yield* rowToConsolidationRun(rows[0])
      return Option.some(run)
    })

  const findInProgressRuns: ConsolidationRepositoryService["findInProgressRuns"] = (groupId) =>
    Effect.gen(function* () {
      const rows = yield* sql<ConsolidationRunRow>`
        SELECT * FROM consolidation_runs
        WHERE group_id = ${groupId} AND status = 'InProgress'
        ORDER BY initiated_at DESC
      `.pipe(wrapSqlError("findInProgressRuns"))

      return yield* Effect.forEach(rows, rowToConsolidationRun)
    })

  const findRunsByPeriodRange: ConsolidationRepositoryService["findRunsByPeriodRange"] = (
    groupId,
    startPeriod,
    endPeriod
  ) =>
    Effect.gen(function* () {
      const rows = yield* sql<ConsolidationRunRow>`
        SELECT * FROM consolidation_runs
        WHERE group_id = ${groupId}
          AND (period_year > ${startPeriod.year}
               OR (period_year = ${startPeriod.year} AND period_number >= ${startPeriod.period}))
          AND (period_year < ${endPeriod.year}
               OR (period_year = ${endPeriod.year} AND period_number <= ${endPeriod.period}))
        ORDER BY period_year, period_number
      `.pipe(wrapSqlError("findRunsByPeriodRange"))

      return yield* Effect.forEach(rows, rowToConsolidationRun)
    })

  const runExists: ConsolidationRepositoryService["runExists"] = (id) =>
    Effect.gen(function* () {
      const rows = yield* sql<{ count: string }>`
        SELECT COUNT(*) as count FROM consolidation_runs WHERE id = ${id}
      `.pipe(wrapSqlError("runExists"))

      return parseInt(rows[0].count, 10) > 0
    })

  const deleteRun: ConsolidationRepositoryService["deleteRun"] = (id) =>
    Effect.gen(function* () {
      const exists = yield* runExists(id)
      if (!exists) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "ConsolidationRun", entityId: id })
        )
      }

      yield* sql`
        DELETE FROM consolidation_runs WHERE id = ${id}
      `.pipe(wrapSqlError("deleteRun"))
    })

  return {
    findGroup,
    getGroup,
    findGroupsByOrganization,
    findActiveGroups,
    createGroup,
    updateGroup,
    groupExists,
    findRun,
    getRun,
    createRun,
    updateRun,
    findRunsByGroup,
    findRunByGroupAndPeriod,
    findRunsByStatus,
    findLatestCompletedRun,
    findInProgressRuns,
    findRunsByPeriodRange,
    runExists,
    deleteRun
  } satisfies ConsolidationRepositoryService
})

/**
 * ConsolidationRepositoryLive - Layer providing ConsolidationRepository implementation
 *
 * Requires PgClient.PgClient (or SqlClient.SqlClient) in context.
 */
export const ConsolidationRepositoryLive = Layer.effect(ConsolidationRepository, make)
