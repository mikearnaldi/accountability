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

import { SqlClient, SqlSchema } from "@effect/sql"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { CompanyId, ConsolidationMethod } from "@accountability/core/domain/Company"
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
  ConsolidationRunStatus,
  ConsolidationStep,
  ConsolidationStepStatus,
  ConsolidationStepType,
  ValidationResult
} from "@accountability/core/domain/ConsolidationRun"
import { CurrencyCode } from "@accountability/core/domain/CurrencyCode"
import { FiscalPeriodRef } from "@accountability/core/domain/FiscalPeriodRef"
import { LocalDate } from "@accountability/core/domain/LocalDate"
import { OrganizationId } from "@accountability/core/domain/Organization"
import { Timestamp } from "@accountability/core/domain/Timestamp"
import { UserId } from "@accountability/core/domain/JournalEntry"
import { Percentage } from "@accountability/core/domain/Percentage"
import { ConsolidationRepository, type ConsolidationRepositoryService } from "./ConsolidationRepository.ts"
import { EntityNotFoundError, PersistenceError } from "./RepositoryError.ts"

/**
 * Schema for database row from consolidation_groups table
 * Uses proper literal types for enum fields to avoid type assertions
 */
const ConsolidationGroupRow = Schema.Struct({
  id: Schema.String,
  organization_id: Schema.String,
  name: Schema.String,
  reporting_currency: CurrencyCode,
  consolidation_method: ConsolidationMethod,
  parent_company_id: Schema.String,
  is_active: Schema.Boolean
})
type ConsolidationGroupRow = typeof ConsolidationGroupRow.Type

/**
 * Schema for database row from consolidation_members table
 * Uses proper literal types for enum fields to avoid type assertions
 */
const ConsolidationMemberRow = Schema.Struct({
  id: Schema.String,
  consolidation_group_id: Schema.String,
  company_id: Schema.String,
  ownership_percentage: Schema.String,
  consolidation_method: ConsolidationMethod,
  acquisition_date: Schema.DateFromSelf,
  goodwill_amount: Schema.NullOr(Schema.String),
  non_controlling_interest_percentage: Schema.String,
  vie_determination: Schema.NullOr(Schema.String)
})
type ConsolidationMemberRow = typeof ConsolidationMemberRow.Type

/**
 * Schema for elimination rule ID row
 */
const EliminationRuleIdRow = Schema.Struct({
  id: Schema.String
})
type EliminationRuleIdRow = typeof EliminationRuleIdRow.Type

/**
 * Schema for database row from consolidation_runs table
 * Uses proper literal types for enum fields to avoid type assertions
 */
const ConsolidationRunRow = Schema.Struct({
  id: Schema.String,
  group_id: Schema.String,
  period_year: Schema.Number,
  period_number: Schema.Number,
  as_of_date: Schema.DateFromSelf,
  status: ConsolidationRunStatus,
  steps: Schema.String,
  validation_result: Schema.NullOr(Schema.String),
  consolidated_trial_balance: Schema.NullOr(Schema.String),
  elimination_entry_ids: Schema.String,
  options: Schema.String,
  initiated_by: Schema.String,
  initiated_at: Schema.DateFromSelf,
  started_at: Schema.NullOr(Schema.DateFromSelf),
  completed_at: Schema.NullOr(Schema.DateFromSelf),
  total_duration_ms: Schema.NullOr(Schema.Number),
  error_message: Schema.NullOr(Schema.String)
})
type ConsolidationRunRow = typeof ConsolidationRunRow.Type

/**
 * Schema for count query result
 */
const CountRow = Schema.Struct({
  count: Schema.String
})

/**
 * Convert Date to LocalDate
 * Pure function - no validation needed, values come from database
 */
const dateToLocalDate = (date: Date): LocalDate =>
  LocalDate.make({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() })

/**
 * Wrap SQL errors in PersistenceError
 * Uses mapError to only transform expected errors, not defects
 */
const wrapSqlError =
  (operation: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, PersistenceError, R> =>
    Effect.mapError(effect, (cause) =>
      new PersistenceError({ operation, cause })
    )

/**
 * Schema for parsed step JSON from database
 * Uses proper literal types for type-safe decoding
 */
const StepJsonSchema = Schema.Struct({
  stepType: ConsolidationStepType,
  status: ConsolidationStepStatus,
  startedAt: Schema.NullOr(Schema.Number),
  completedAt: Schema.NullOr(Schema.Number),
  durationMs: Schema.NullOr(Schema.Number),
  errorMessage: Schema.NullOr(Schema.String),
  details: Schema.NullOr(Schema.String)
})

/**
 * Schema for array of step JSON
 */
const StepsJsonSchema = Schema.Array(StepJsonSchema)

/**
 * Schema for elimination entry IDs from JSON
 */
const EliminationEntryIdsJsonSchema = Schema.Array(Schema.String)

/**
 * Convert database row to ConsolidationRun domain entity
 * Pure function - uses Schema.decodeUnknownSync for JSON parsing (throws on invalid data)
 * Database values are trusted, so parse errors indicate data corruption
 */
const rowToConsolidationRun = (row: ConsolidationRunRow): ConsolidationRun => {
  const stepsJson = Schema.decodeUnknownSync(StepsJsonSchema)(JSON.parse(row.steps))

  const steps = Chunk.fromIterable(
    stepsJson.map((s) =>
      ConsolidationStep.make({
        stepType: s.stepType,
        status: s.status,
        startedAt: s.startedAt !== null
          ? Option.some(Timestamp.make({ epochMillis: s.startedAt }))
          : Option.none<Timestamp>(),
        completedAt: s.completedAt !== null
          ? Option.some(Timestamp.make({ epochMillis: s.completedAt }))
          : Option.none<Timestamp>(),
        durationMs: s.durationMs !== null ? Option.some(s.durationMs) : Option.none<number>(),
        errorMessage: s.errorMessage !== null
          ? Option.some(s.errorMessage)
          : Option.none<string>(),
        details: s.details !== null
          ? Option.some(s.details)
          : Option.none<string>()
      })
    )
  )

  const validationResult = row.validation_result !== null
    ? Option.some(ValidationResult.make(JSON.parse(row.validation_result)))
    : Option.none<ValidationResult>()

  const consolidatedTrialBalance = row.consolidated_trial_balance !== null
    ? Option.some(ConsolidatedTrialBalance.make(JSON.parse(row.consolidated_trial_balance)))
    : Option.none<ConsolidatedTrialBalance>()

  const eliminationEntryIdStrings = Schema.decodeUnknownSync(EliminationEntryIdsJsonSchema)(
    JSON.parse(row.elimination_entry_ids)
  )
  const eliminationEntryIds = Chunk.fromIterable(
    eliminationEntryIdStrings.map(
      (id) => Schema.UUID.pipe(Schema.brand("EliminationEntryId")).make(id)
    )
  )

  const options = JSON.parse(row.options)

  return ConsolidationRun.make({
    id: ConsolidationRunId.make(row.id),
    groupId: ConsolidationGroupId.make(row.group_id),
    periodRef: FiscalPeriodRef.make({ year: row.period_year, period: row.period_number }),
    asOfDate: dateToLocalDate(row.as_of_date),
    status: row.status,
    steps,
    validationResult,
    consolidatedTrialBalance,
    eliminationEntryIds,
    options,
    initiatedBy: UserId.make(row.initiated_by),
    initiatedAt: Timestamp.make({ epochMillis: row.initiated_at.getTime() }),
    startedAt: row.started_at !== null
      ? Option.some(Timestamp.make({ epochMillis: row.started_at.getTime() }))
      : Option.none<Timestamp>(),
    completedAt: row.completed_at !== null
      ? Option.some(Timestamp.make({ epochMillis: row.completed_at.getTime() }))
      : Option.none<Timestamp>(),
    totalDurationMs: row.total_duration_ms !== null ? Option.some(row.total_duration_ms) : Option.none<number>(),
    errorMessage: row.error_message !== null
      ? Option.some(row.error_message)
      : Option.none<string>()
  })
}

/**
 * Implementation of ConsolidationRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // SqlSchema query builders for ConsolidationGroup
  const findGroupById = SqlSchema.findOne({
    Request: Schema.String,
    Result: ConsolidationGroupRow,
    execute: (id) => sql`SELECT * FROM consolidation_groups WHERE id = ${id}`
  })

  const findGroupsByOrganization = SqlSchema.findAll({
    Request: Schema.String,
    Result: ConsolidationGroupRow,
    execute: (organizationId) => sql`
      SELECT * FROM consolidation_groups
      WHERE organization_id = ${organizationId}
      ORDER BY name
    `
  })

  const findActiveGroupsByOrganization = SqlSchema.findAll({
    Request: Schema.String,
    Result: ConsolidationGroupRow,
    execute: (organizationId) => sql`
      SELECT * FROM consolidation_groups
      WHERE organization_id = ${organizationId} AND is_active = true
      ORDER BY name
    `
  })

  const countGroupById = SqlSchema.single({
    Request: Schema.String,
    Result: CountRow,
    execute: (id) => sql`SELECT COUNT(*) as count FROM consolidation_groups WHERE id = ${id}`
  })

  // SqlSchema query builders for ConsolidationRun
  const findRunById = SqlSchema.findOne({
    Request: Schema.String,
    Result: ConsolidationRunRow,
    execute: (id) => sql`SELECT * FROM consolidation_runs WHERE id = ${id}`
  })

  const findRunsByGroup = SqlSchema.findAll({
    Request: Schema.String,
    Result: ConsolidationRunRow,
    execute: (groupId) => sql`
      SELECT * FROM consolidation_runs
      WHERE group_id = ${groupId}
      ORDER BY initiated_at DESC
    `
  })

  const findRunByGroupAndPeriod = SqlSchema.findOne({
    Request: Schema.Struct({ groupId: Schema.String, year: Schema.Number, period: Schema.Number }),
    Result: ConsolidationRunRow,
    execute: ({ groupId, year, period }) => sql`
      SELECT * FROM consolidation_runs
      WHERE group_id = ${groupId}
        AND period_year = ${year}
        AND period_number = ${period}
      ORDER BY initiated_at DESC
      LIMIT 1
    `
  })

  const findRunsByGroupAndStatus = SqlSchema.findAll({
    Request: Schema.Struct({ groupId: Schema.String, status: Schema.String }),
    Result: ConsolidationRunRow,
    execute: ({ groupId, status }) => sql`
      SELECT * FROM consolidation_runs
      WHERE group_id = ${groupId} AND status = ${status}
      ORDER BY initiated_at DESC
    `
  })

  const findLatestCompletedRunQuery = SqlSchema.findOne({
    Request: Schema.String,
    Result: ConsolidationRunRow,
    execute: (groupId) => sql`
      SELECT * FROM consolidation_runs
      WHERE group_id = ${groupId} AND status = 'Completed'
      ORDER BY completed_at DESC
      LIMIT 1
    `
  })

  const findInProgressRunsQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: ConsolidationRunRow,
    execute: (groupId) => sql`
      SELECT * FROM consolidation_runs
      WHERE group_id = ${groupId} AND status = 'InProgress'
      ORDER BY initiated_at DESC
    `
  })

  const findRunsByPeriodRangeQuery = SqlSchema.findAll({
    Request: Schema.Struct({
      groupId: Schema.String,
      startYear: Schema.Number,
      startPeriod: Schema.Number,
      endYear: Schema.Number,
      endPeriod: Schema.Number
    }),
    Result: ConsolidationRunRow,
    execute: ({ groupId, startYear, startPeriod, endYear, endPeriod }) => sql`
      SELECT * FROM consolidation_runs
      WHERE group_id = ${groupId}
        AND (period_year > ${startYear}
             OR (period_year = ${startYear} AND period_number >= ${startPeriod}))
        AND (period_year < ${endYear}
             OR (period_year = ${endYear} AND period_number <= ${endPeriod}))
      ORDER BY period_year, period_number
    `
  })

  const countRunById = SqlSchema.single({
    Request: Schema.String,
    Result: CountRow,
    execute: (id) => sql`SELECT COUNT(*) as count FROM consolidation_runs WHERE id = ${id}`
  })

  // SqlSchema query builders for members and elimination rules
  const findMembersByGroup = SqlSchema.findAll({
    Request: Schema.String,
    Result: ConsolidationMemberRow,
    execute: (groupId) => sql`
      SELECT * FROM consolidation_members
      WHERE consolidation_group_id = ${groupId}
      ORDER BY company_id
    `
  })

  const findEliminationRuleIdsByGroup = SqlSchema.findAll({
    Request: Schema.String,
    Result: EliminationRuleIdRow,
    execute: (groupId) => sql`
      SELECT id FROM elimination_rules
      WHERE consolidation_group_id = ${groupId}
      ORDER BY priority
    `
  })

  // Helper to load members for a group
  const loadMembers = (groupId: string): Effect.Effect<Chunk.Chunk<ConsolidationMember>, PersistenceError> =>
    findMembersByGroup(groupId).pipe(
      Effect.map((rows) => Chunk.fromIterable(rows.map((row) => {
        const goodwillAmount = row.goodwill_amount !== null
          ? Option.some(JSON.parse(row.goodwill_amount))
          : Option.none<unknown>()

        const vieDetermination = row.vie_determination !== null
          ? Option.some(VIEDetermination.make(JSON.parse(row.vie_determination)))
          : Option.none<VIEDetermination>()

        return ConsolidationMember.make({
          companyId: CompanyId.make(row.company_id),
          ownershipPercentage: Percentage.make(parseFloat(row.ownership_percentage)),
          consolidationMethod: row.consolidation_method,
          acquisitionDate: dateToLocalDate(row.acquisition_date),
          goodwillAmount,
          nonControllingInterestPercentage: Percentage.make(
            parseFloat(row.non_controlling_interest_percentage)
          ),
          vieDetermination
        })
      }))),
      wrapSqlError("loadMembers")
    )

  // Helper to load elimination rule IDs for a group
  const loadEliminationRuleIds = (groupId: string): Effect.Effect<Chunk.Chunk<EliminationRuleId>, PersistenceError> =>
    findEliminationRuleIdsByGroup(groupId).pipe(
      Effect.map((rows) => Chunk.fromIterable(rows.map((row) => EliminationRuleId.make(row.id)))),
      wrapSqlError("loadEliminationRuleIds")
    )

  // Helper to convert group row to entity (loads related data)
  const rowToConsolidationGroup = (
    row: ConsolidationGroupRow
  ): Effect.Effect<ConsolidationGroup, PersistenceError> =>
    Effect.gen(function* () {
      const members = yield* loadMembers(row.id)
      const eliminationRuleIds = yield* loadEliminationRuleIds(row.id)

      return ConsolidationGroup.make({
        id: ConsolidationGroupId.make(row.id),
        organizationId: OrganizationId.make(row.organization_id),
        name: row.name,
        reportingCurrency: row.reporting_currency,
        consolidationMethod: row.consolidation_method,
        parentCompanyId: CompanyId.make(row.parent_company_id),
        members,
        eliminationRuleIds,
        isActive: row.is_active
      })
    })

  // ConsolidationGroup operations
  const findGroup: ConsolidationRepositoryService["findGroup"] = (id) =>
    findGroupById(id).pipe(
      Effect.flatMap(Option.match({
        onNone: () => Effect.succeed(Option.none<ConsolidationGroup>()),
        onSome: (row) => rowToConsolidationGroup(row).pipe(Effect.map(Option.some))
      })),
      wrapSqlError("findGroup")
    )

  const getGroup: ConsolidationRepositoryService["getGroup"] = (id) =>
    Effect.gen(function* () {
      const maybeGroup = yield* findGroup(id)
      return yield* Option.match(maybeGroup, {
        onNone: () => Effect.fail(new EntityNotFoundError({ entityType: "ConsolidationGroup", entityId: id })),
        onSome: Effect.succeed
      })
    })

  const findGroupsByOrganizationOp: ConsolidationRepositoryService["findGroupsByOrganization"] = (organizationId) =>
    findGroupsByOrganization(organizationId).pipe(
      Effect.flatMap((rows) => Effect.forEach(rows, rowToConsolidationGroup)),
      wrapSqlError("findGroupsByOrganization")
    )

  const findActiveGroups: ConsolidationRepositoryService["findActiveGroups"] = (organizationId) =>
    findActiveGroupsByOrganization(organizationId).pipe(
      Effect.flatMap((rows) => Effect.forEach(rows, rowToConsolidationGroup)),
      wrapSqlError("findActiveGroups")
    )

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
    countGroupById(id).pipe(
      Effect.map((row) => parseInt(row.count, 10) > 0),
      wrapSqlError("groupExists")
    )

  // ConsolidationRun operations
  const findRun: ConsolidationRepositoryService["findRun"] = (id) =>
    findRunById(id).pipe(
      Effect.map(Option.map(rowToConsolidationRun)),
      wrapSqlError("findRun")
    )

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

  const findRunsByGroupOp: ConsolidationRepositoryService["findRunsByGroup"] = (groupId) =>
    findRunsByGroup(groupId).pipe(
      Effect.map((rows) => rows.map(rowToConsolidationRun)),
      wrapSqlError("findRunsByGroup")
    )

  const findRunByGroupAndPeriodOp: ConsolidationRepositoryService["findRunByGroupAndPeriod"] = (groupId, period) =>
    findRunByGroupAndPeriod({ groupId, year: period.year, period: period.period }).pipe(
      Effect.map(Option.map(rowToConsolidationRun)),
      wrapSqlError("findRunByGroupAndPeriod")
    )

  const findRunsByStatus: ConsolidationRepositoryService["findRunsByStatus"] = (groupId, status) =>
    findRunsByGroupAndStatus({ groupId, status }).pipe(
      Effect.map((rows) => rows.map(rowToConsolidationRun)),
      wrapSqlError("findRunsByStatus")
    )

  const findLatestCompletedRun: ConsolidationRepositoryService["findLatestCompletedRun"] = (groupId) =>
    findLatestCompletedRunQuery(groupId).pipe(
      Effect.map(Option.map(rowToConsolidationRun)),
      wrapSqlError("findLatestCompletedRun")
    )

  const findInProgressRuns: ConsolidationRepositoryService["findInProgressRuns"] = (groupId) =>
    findInProgressRunsQuery(groupId).pipe(
      Effect.map((rows) => rows.map(rowToConsolidationRun)),
      wrapSqlError("findInProgressRuns")
    )

  const findRunsByPeriodRange: ConsolidationRepositoryService["findRunsByPeriodRange"] = (
    groupId,
    startPeriod,
    endPeriod
  ) =>
    findRunsByPeriodRangeQuery({
      groupId,
      startYear: startPeriod.year,
      startPeriod: startPeriod.period,
      endYear: endPeriod.year,
      endPeriod: endPeriod.period
    }).pipe(
      Effect.map((rows) => rows.map(rowToConsolidationRun)),
      wrapSqlError("findRunsByPeriodRange")
    )

  const runExists: ConsolidationRepositoryService["runExists"] = (id) =>
    countRunById(id).pipe(
      Effect.map((row) => parseInt(row.count, 10) > 0),
      wrapSqlError("runExists")
    )

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
    findGroupsByOrganization: findGroupsByOrganizationOp,
    findActiveGroups,
    createGroup,
    updateGroup,
    groupExists,
    findRun,
    getRun,
    createRun,
    updateRun,
    findRunsByGroup: findRunsByGroupOp,
    findRunByGroupAndPeriod: findRunByGroupAndPeriodOp,
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
