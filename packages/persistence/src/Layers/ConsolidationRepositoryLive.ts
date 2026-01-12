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
import * as BigDecimal from "effect/BigDecimal"
import type * as Brand from "effect/Brand"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { CompanyId, ConsolidationMethod } from "@accountability/core/Domains/Company"
import {
  ConsolidationGroup,
  ConsolidationGroupId,
  ConsolidationMember,
  EliminationRuleId,
  VIEDetermination
} from "@accountability/core/Domains/ConsolidationGroup"
import {
  ConsolidatedTrialBalance,
  ConsolidatedTrialBalanceLineItem,
  ConsolidationRun,
  ConsolidationRunId,
  ConsolidationRunOptions,
  ConsolidationRunStatus,
  ConsolidationStep,
  ConsolidationStepStatus,
  ConsolidationStepType,
  ValidationResult
} from "@accountability/core/Domains/ConsolidationRun"
import { CurrencyCode } from "@accountability/core/Domains/CurrencyCode"
import { FiscalPeriodRef } from "@accountability/core/Domains/FiscalPeriodRef"
import { LocalDate } from "@accountability/core/Domains/LocalDate"
import { MonetaryAmount } from "@accountability/core/Domains/MonetaryAmount"
import { OrganizationId } from "@accountability/core/Domains/Organization"
import { Timestamp } from "@accountability/core/Domains/Timestamp"
import { UserId } from "@accountability/core/Domains/JournalEntry"
import { Percentage } from "@accountability/core/Domains/Percentage"
import { ConsolidationRepository, type ConsolidationRepositoryService } from "../Services/ConsolidationRepository.ts"
import { EntityNotFoundError, wrapSqlError } from "../RepositoryError.ts"
import type { PersistenceError } from "../RepositoryError.ts"

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
  consolidation_group_id: Schema.String,
  fiscal_year: Schema.Number,
  fiscal_period: Schema.Number,
  as_of_date: Schema.DateFromSelf,
  status: ConsolidationRunStatus,
  validation_result: Schema.NullOr(Schema.Unknown),
  options: Schema.Unknown,
  initiated_by: Schema.String,
  initiated_at: Schema.DateFromSelf,
  started_at: Schema.NullOr(Schema.DateFromSelf),
  completed_at: Schema.NullOr(Schema.DateFromSelf),
  total_duration_ms: Schema.NullOr(Schema.Number),
  error_message: Schema.NullOr(Schema.String),
  created_at: Schema.DateFromSelf,
  updated_at: Schema.DateFromSelf
})
type ConsolidationRunRow = typeof ConsolidationRunRow.Type

/**
 * Schema for consolidation_run_steps table row
 */
const ConsolidationRunStepRow = Schema.Struct({
  id: Schema.String,
  consolidation_run_id: Schema.String,
  step_type: ConsolidationStepType,
  step_order: Schema.Number,
  status: ConsolidationStepStatus,
  started_at: Schema.NullOr(Schema.DateFromSelf),
  completed_at: Schema.NullOr(Schema.DateFromSelf),
  duration_ms: Schema.NullOr(Schema.Number),
  error_message: Schema.NullOr(Schema.String),
  details: Schema.NullOr(Schema.String)
})
type ConsolidationRunStepRow = typeof ConsolidationRunStepRow.Type

/**
 * Schema for elimination entry ID row from junction table
 */
const EliminationEntryIdRow = Schema.Struct({
  journal_entry_id: Schema.String
})
type EliminationEntryIdRow = typeof EliminationEntryIdRow.Type

/**
 * Schema for consolidated_trial_balances table row
 */
const ConsolidatedTrialBalanceRow = Schema.Struct({
  id: Schema.String,
  consolidation_run_id: Schema.String,
  consolidation_group_id: Schema.String,
  fiscal_year: Schema.Number,
  fiscal_period: Schema.Number,
  as_of_date: Schema.DateFromSelf,
  currency: CurrencyCode,
  line_items: Schema.Unknown,
  total_debits: Schema.Unknown,
  total_credits: Schema.Unknown,
  total_eliminations: Schema.Unknown,
  total_nci: Schema.Unknown,
  generated_at: Schema.DateFromSelf
})
type ConsolidatedTrialBalanceRow = typeof ConsolidatedTrialBalanceRow.Type

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
 * Convert step row to ConsolidationStep domain entity
 */
const rowToConsolidationStep = (row: ConsolidationRunStepRow): ConsolidationStep =>
  ConsolidationStep.make({
    stepType: row.step_type,
    status: row.status,
    startedAt: Option.fromNullable(row.started_at).pipe(
      Option.map((d) => Timestamp.make({ epochMillis: d.getTime() }))
    ),
    completedAt: Option.fromNullable(row.completed_at).pipe(
      Option.map((d) => Timestamp.make({ epochMillis: d.getTime() }))
    ),
    durationMs: Option.fromNullable(row.duration_ms),
    errorMessage: Option.fromNullable(row.error_message),
    details: Option.fromNullable(row.details)
  })

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
      WHERE consolidation_group_id = ${groupId}
      ORDER BY initiated_at DESC
    `
  })

  const findRunByGroupAndPeriod = SqlSchema.findOne({
    Request: Schema.Struct({ groupId: Schema.String, year: Schema.Number, period: Schema.Number }),
    Result: ConsolidationRunRow,
    execute: ({ groupId, year, period }) => sql`
      SELECT * FROM consolidation_runs
      WHERE consolidation_group_id = ${groupId}
        AND fiscal_year = ${year}
        AND fiscal_period = ${period}
      ORDER BY initiated_at DESC
      LIMIT 1
    `
  })

  const findRunsByGroupAndStatus = SqlSchema.findAll({
    Request: Schema.Struct({ groupId: Schema.String, status: Schema.String }),
    Result: ConsolidationRunRow,
    execute: ({ groupId, status }) => sql`
      SELECT * FROM consolidation_runs
      WHERE consolidation_group_id = ${groupId} AND status = ${status}
      ORDER BY initiated_at DESC
    `
  })

  const findLatestCompletedRunQuery = SqlSchema.findOne({
    Request: Schema.String,
    Result: ConsolidationRunRow,
    execute: (groupId) => sql`
      SELECT * FROM consolidation_runs
      WHERE consolidation_group_id = ${groupId} AND status = 'Completed'
      ORDER BY completed_at DESC
      LIMIT 1
    `
  })

  const findInProgressRunsQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: ConsolidationRunRow,
    execute: (groupId) => sql`
      SELECT * FROM consolidation_runs
      WHERE consolidation_group_id = ${groupId} AND status = 'InProgress'
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
      WHERE consolidation_group_id = ${groupId}
        AND (fiscal_year > ${startYear}
             OR (fiscal_year = ${startYear} AND fiscal_period >= ${startPeriod}))
        AND (fiscal_year < ${endYear}
             OR (fiscal_year = ${endYear} AND fiscal_period <= ${endPeriod}))
      ORDER BY fiscal_year, fiscal_period
    `
  })

  const countRunById = SqlSchema.single({
    Request: Schema.String,
    Result: CountRow,
    execute: (id) => sql`SELECT COUNT(*) as count FROM consolidation_runs WHERE id = ${id}`
  })

  // SqlSchema query builders for consolidation run steps
  const findStepsByRunId = SqlSchema.findAll({
    Request: Schema.String,
    Result: ConsolidationRunStepRow,
    execute: (runId) => sql`
      SELECT * FROM consolidation_run_steps
      WHERE consolidation_run_id = ${runId}
      ORDER BY step_order
    `
  })

  // SqlSchema query builders for elimination entry IDs
  const findEliminationEntryIdsByRunId = SqlSchema.findAll({
    Request: Schema.String,
    Result: EliminationEntryIdRow,
    execute: (runId) => sql`
      SELECT journal_entry_id FROM consolidation_run_elimination_entries
      WHERE consolidation_run_id = ${runId}
    `
  })

  // SqlSchema query builder for consolidated trial balance
  const findTrialBalanceByRunId = SqlSchema.findOne({
    Request: Schema.String,
    Result: ConsolidatedTrialBalanceRow,
    execute: (runId) => sql`
      SELECT * FROM consolidated_trial_balances
      WHERE consolidation_run_id = ${runId}
    `
  })

  // Helper to load steps for a run
  const loadSteps = (runId: string): Effect.Effect<Chunk.Chunk<ConsolidationStep>, PersistenceError> =>
    findStepsByRunId(runId).pipe(
      Effect.map((rows) => Chunk.fromIterable(rows.map(rowToConsolidationStep))),
      wrapSqlError("loadSteps")
    )

  // Helper to load elimination entry IDs for a run
  const loadEliminationEntryIds = (runId: string): Effect.Effect<Chunk.Chunk<string & Brand.Brand<"EliminationEntryId">>, PersistenceError> =>
    findEliminationEntryIdsByRunId(runId).pipe(
      Effect.map((rows) => Chunk.fromIterable(
        rows.map((row) => Schema.UUID.pipe(Schema.brand("EliminationEntryId")).make(row.journal_entry_id))
      )),
      wrapSqlError("loadEliminationEntryIds")
    )

  // Schema for line items in trial balance JSONB
  const LineItemSchema = Schema.Struct({
    accountNumber: Schema.String,
    accountName: Schema.String,
    accountType: Schema.Literal("Asset", "Liability", "Equity", "Revenue", "Expense"),
    aggregatedBalance: MonetaryAmount,
    eliminationAmount: MonetaryAmount,
    nciAmount: Schema.NullOr(MonetaryAmount),
    consolidatedBalance: MonetaryAmount
  })

  // Helper to load consolidated trial balance for a run
  const loadConsolidatedTrialBalance = (
    runId: string
  ): Effect.Effect<Option.Option<ConsolidatedTrialBalance>, PersistenceError> =>
    findTrialBalanceByRunId(runId).pipe(
      Effect.flatMap(Option.match({
        onNone: () => Effect.succeed(Option.none<ConsolidatedTrialBalance>()),
        onSome: (row) => Effect.gen(function* () {
          // Parse line items from JSONB
          const lineItemsRaw = yield* Schema.decodeUnknown(Schema.Array(LineItemSchema))(row.line_items).pipe(
            Effect.catchAll(() => Effect.succeed([]))
          )

          const lineItems = Chunk.fromIterable(
            lineItemsRaw.map((li) => ConsolidatedTrialBalanceLineItem.make({
              accountNumber: li.accountNumber,
              accountName: li.accountName,
              accountType: li.accountType,
              aggregatedBalance: li.aggregatedBalance,
              eliminationAmount: li.eliminationAmount,
              nciAmount: Option.fromNullable(li.nciAmount),
              consolidatedBalance: li.consolidatedBalance
            }))
          )

          // Parse total amounts from JSONB
          const totalDebits = yield* Schema.decodeUnknown(MonetaryAmount)(row.total_debits)
          const totalCredits = yield* Schema.decodeUnknown(MonetaryAmount)(row.total_credits)
          const totalEliminations = yield* Schema.decodeUnknown(MonetaryAmount)(row.total_eliminations)
          const totalNCI = yield* Schema.decodeUnknown(MonetaryAmount)(row.total_nci)

          return Option.some(ConsolidatedTrialBalance.make({
            consolidationRunId: ConsolidationRunId.make(row.consolidation_run_id),
            groupId: ConsolidationGroupId.make(row.consolidation_group_id),
            periodRef: FiscalPeriodRef.make({ year: row.fiscal_year, period: row.fiscal_period }),
            asOfDate: dateToLocalDate(row.as_of_date),
            currency: row.currency,
            lineItems,
            totalDebits,
            totalCredits,
            totalEliminations,
            totalNCI,
            generatedAt: Timestamp.make({ epochMillis: row.generated_at.getTime() })
          }))
        }).pipe(
          Effect.catchAll(() => Effect.succeed(Option.none<ConsolidatedTrialBalance>()))
        )
      })),
      wrapSqlError("loadConsolidatedTrialBalance")
    )

  // Helper to convert run row to entity (loads related data)
  const rowToConsolidationRun = (row: ConsolidationRunRow): Effect.Effect<ConsolidationRun, PersistenceError> =>
    Effect.gen(function* () {
      const steps = yield* loadSteps(row.id)
      const eliminationEntryIds = yield* loadEliminationEntryIds(row.id)
      const consolidatedTrialBalance = yield* loadConsolidatedTrialBalance(row.id)

      // Parse validation result from JSONB using Schema.decodeUnknown
      const validationResult = yield* Option.fromNullable(row.validation_result).pipe(
        Option.match({
          onNone: () => Effect.succeed(Option.none<ValidationResult>()),
          onSome: (json) => Schema.decodeUnknown(ValidationResult)(json).pipe(
            Effect.map(Option.some),
            Effect.catchAll(() => Effect.succeed(Option.none<ValidationResult>()))
          )
        })
      )

      // Parse options from JSONB using Schema with defaults
      const optionsSchema = Schema.Struct({
        skipValidation: Schema.optionalWith(Schema.Boolean, { default: () => false }),
        continueOnWarnings: Schema.optionalWith(Schema.Boolean, { default: () => true }),
        includeEquityMethodInvestments: Schema.optionalWith(Schema.Boolean, { default: () => true }),
        forceRegeneration: Schema.optionalWith(Schema.Boolean, { default: () => false })
      })
      const parsedOptions = yield* Schema.decodeUnknown(optionsSchema)(row.options).pipe(
        Effect.catchAll(() => Effect.succeed({
          skipValidation: false,
          continueOnWarnings: true,
          includeEquityMethodInvestments: true,
          forceRegeneration: false
        }))
      )
      const options = ConsolidationRunOptions.make(parsedOptions)

      return ConsolidationRun.make({
        id: ConsolidationRunId.make(row.id),
        groupId: ConsolidationGroupId.make(row.consolidation_group_id),
        periodRef: FiscalPeriodRef.make({ year: row.fiscal_year, period: row.fiscal_period }),
        asOfDate: dateToLocalDate(row.as_of_date),
        status: row.status,
        steps,
        validationResult,
        consolidatedTrialBalance,
        eliminationEntryIds,
        options,
        initiatedBy: UserId.make(row.initiated_by),
        initiatedAt: Timestamp.make({ epochMillis: row.initiated_at.getTime() }),
        startedAt: Option.fromNullable(row.started_at).pipe(
          Option.map((d) => Timestamp.make({ epochMillis: d.getTime() }))
        ),
        completedAt: Option.fromNullable(row.completed_at).pipe(
          Option.map((d) => Timestamp.make({ epochMillis: d.getTime() }))
        ),
        totalDurationMs: Option.fromNullable(row.total_duration_ms),
        errorMessage: Option.fromNullable(row.error_message)
      })
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
        const goodwillAmount = Option.fromNullable(row.goodwill_amount).pipe(
          Option.map((json) => JSON.parse(json))
        )

        const vieDetermination = Option.fromNullable(row.vie_determination).pipe(
          Option.map((json) => VIEDetermination.make(JSON.parse(json)))
        )

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
      Effect.flatMap(Option.match({
        onNone: () => Effect.succeed(Option.none<ConsolidationRun>()),
        onSome: (row) => rowToConsolidationRun(row).pipe(Effect.map(Option.some))
      })),
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
      // Insert main run record
      yield* sql`
        INSERT INTO consolidation_runs (
          id, consolidation_group_id, fiscal_year, fiscal_period, as_of_date,
          status, validation_result, options, initiated_by, initiated_at,
          started_at, completed_at, total_duration_ms, error_message
        ) VALUES (
          ${run.id},
          ${run.groupId},
          ${run.periodRef.year},
          ${run.periodRef.period},
          ${run.asOfDate.toDate()},
          ${run.status},
          ${Option.match(run.validationResult, { onNone: () => null, onSome: (v) => JSON.stringify(v) })}::jsonb,
          ${JSON.stringify(run.options)}::jsonb,
          ${run.initiatedBy},
          ${run.initiatedAt.toDate()},
          ${Option.match(run.startedAt, { onNone: () => null, onSome: (t) => t.toDate() })},
          ${Option.match(run.completedAt, { onNone: () => null, onSome: (t) => t.toDate() })},
          ${Option.getOrNull(run.totalDurationMs)},
          ${Option.getOrNull(run.errorMessage)}
        )
      `.pipe(wrapSqlError("createRun"))

      // Insert steps
      let stepOrder = 1
      for (const step of run.steps) {
        yield* sql`
          INSERT INTO consolidation_run_steps (
            id, consolidation_run_id, step_type, step_order, status,
            started_at, completed_at, duration_ms, error_message, details
          ) VALUES (
            ${crypto.randomUUID()},
            ${run.id},
            ${step.stepType},
            ${stepOrder},
            ${step.status},
            ${Option.match(step.startedAt, { onNone: () => null, onSome: (t) => t.toDate() })},
            ${Option.match(step.completedAt, { onNone: () => null, onSome: (t) => t.toDate() })},
            ${Option.getOrNull(step.durationMs)},
            ${Option.getOrNull(step.errorMessage)},
            ${Option.getOrNull(step.details)}
          )
        `.pipe(wrapSqlError("createRun:steps"))
        stepOrder++
      }

      // Insert elimination entry IDs
      for (const entryId of run.eliminationEntryIds) {
        yield* sql`
          INSERT INTO consolidation_run_elimination_entries (
            consolidation_run_id, journal_entry_id
          ) VALUES (
            ${run.id}, ${entryId}
          )
        `.pipe(wrapSqlError("createRun:eliminationEntries"))
      }

      // Insert consolidated trial balance if present
      if (Option.isSome(run.consolidatedTrialBalance)) {
        const tb = run.consolidatedTrialBalance.value

        // Encode MonetaryAmount instances to their JSON representation
        const encodeMonetaryAmount = (ma: MonetaryAmount) => ({
          amount: BigDecimal.format(ma.amount),
          currency: ma.currency
        })

        const lineItemsJson = JSON.stringify(Chunk.toArray(tb.lineItems).map((li) => ({
          accountNumber: li.accountNumber,
          accountName: li.accountName,
          accountType: li.accountType,
          aggregatedBalance: encodeMonetaryAmount(li.aggregatedBalance),
          eliminationAmount: encodeMonetaryAmount(li.eliminationAmount),
          nciAmount: Option.match(li.nciAmount, {
            onNone: () => null,
            onSome: encodeMonetaryAmount
          }),
          consolidatedBalance: encodeMonetaryAmount(li.consolidatedBalance)
        })))

        yield* sql`
          INSERT INTO consolidated_trial_balances (
            id, consolidation_run_id, consolidation_group_id, fiscal_year, fiscal_period,
            as_of_date, currency, line_items, total_debits, total_credits,
            total_eliminations, total_nci, generated_at
          ) VALUES (
            ${crypto.randomUUID()},
            ${run.id},
            ${run.groupId},
            ${run.periodRef.year},
            ${run.periodRef.period},
            ${run.asOfDate.toDate()},
            ${tb.currency},
            ${lineItemsJson}::jsonb,
            ${JSON.stringify(encodeMonetaryAmount(tb.totalDebits))}::jsonb,
            ${JSON.stringify(encodeMonetaryAmount(tb.totalCredits))}::jsonb,
            ${JSON.stringify(encodeMonetaryAmount(tb.totalEliminations))}::jsonb,
            ${JSON.stringify(encodeMonetaryAmount(tb.totalNCI))}::jsonb,
            ${tb.generatedAt.toDate()}
          )
        `.pipe(wrapSqlError("createRun:trialBalance"))
      }

      return run
    })

  const updateRun: ConsolidationRepositoryService["updateRun"] = (run) =>
    Effect.gen(function* () {
      // Check if run exists
      const exists = yield* runExists(run.id)
      if (!exists) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "ConsolidationRun", entityId: run.id })
        )
      }

      // Update main run record
      yield* sql`
        UPDATE consolidation_runs SET
          status = ${run.status},
          validation_result = ${Option.match(run.validationResult, { onNone: () => null, onSome: (v) => JSON.stringify(v) })}::jsonb,
          started_at = ${Option.match(run.startedAt, { onNone: () => null, onSome: (t) => t.toDate() })},
          completed_at = ${Option.match(run.completedAt, { onNone: () => null, onSome: (t) => t.toDate() })},
          total_duration_ms = ${Option.getOrNull(run.totalDurationMs)},
          error_message = ${Option.getOrNull(run.errorMessage)}
        WHERE id = ${run.id}
      `.pipe(wrapSqlError("updateRun"))

      // Delete and re-insert steps
      yield* sql`
        DELETE FROM consolidation_run_steps WHERE consolidation_run_id = ${run.id}
      `.pipe(wrapSqlError("updateRun:deleteSteps"))

      let stepOrder = 1
      for (const step of run.steps) {
        yield* sql`
          INSERT INTO consolidation_run_steps (
            id, consolidation_run_id, step_type, step_order, status,
            started_at, completed_at, duration_ms, error_message, details
          ) VALUES (
            ${crypto.randomUUID()},
            ${run.id},
            ${step.stepType},
            ${stepOrder},
            ${step.status},
            ${Option.match(step.startedAt, { onNone: () => null, onSome: (t) => t.toDate() })},
            ${Option.match(step.completedAt, { onNone: () => null, onSome: (t) => t.toDate() })},
            ${Option.getOrNull(step.durationMs)},
            ${Option.getOrNull(step.errorMessage)},
            ${Option.getOrNull(step.details)}
          )
        `.pipe(wrapSqlError("updateRun:steps"))
        stepOrder++
      }

      // Delete and re-insert elimination entry IDs
      yield* sql`
        DELETE FROM consolidation_run_elimination_entries WHERE consolidation_run_id = ${run.id}
      `.pipe(wrapSqlError("updateRun:deleteEliminationEntries"))

      for (const entryId of run.eliminationEntryIds) {
        yield* sql`
          INSERT INTO consolidation_run_elimination_entries (
            consolidation_run_id, journal_entry_id
          ) VALUES (
            ${run.id}, ${entryId}
          )
        `.pipe(wrapSqlError("updateRun:eliminationEntries"))
      }

      // Delete and re-insert consolidated trial balance
      yield* sql`
        DELETE FROM consolidated_trial_balances WHERE consolidation_run_id = ${run.id}
      `.pipe(wrapSqlError("updateRun:deleteTrialBalance"))

      if (Option.isSome(run.consolidatedTrialBalance)) {
        const tb = run.consolidatedTrialBalance.value

        // Encode MonetaryAmount instances to their JSON representation
        const encodeMonetaryAmount = (ma: MonetaryAmount) => ({
          amount: BigDecimal.format(ma.amount),
          currency: ma.currency
        })

        const lineItemsJson = JSON.stringify(Chunk.toArray(tb.lineItems).map((li) => ({
          accountNumber: li.accountNumber,
          accountName: li.accountName,
          accountType: li.accountType,
          aggregatedBalance: encodeMonetaryAmount(li.aggregatedBalance),
          eliminationAmount: encodeMonetaryAmount(li.eliminationAmount),
          nciAmount: Option.match(li.nciAmount, {
            onNone: () => null,
            onSome: encodeMonetaryAmount
          }),
          consolidatedBalance: encodeMonetaryAmount(li.consolidatedBalance)
        })))

        yield* sql`
          INSERT INTO consolidated_trial_balances (
            id, consolidation_run_id, consolidation_group_id, fiscal_year, fiscal_period,
            as_of_date, currency, line_items, total_debits, total_credits,
            total_eliminations, total_nci, generated_at
          ) VALUES (
            ${crypto.randomUUID()},
            ${run.id},
            ${run.groupId},
            ${run.periodRef.year},
            ${run.periodRef.period},
            ${run.asOfDate.toDate()},
            ${tb.currency},
            ${lineItemsJson}::jsonb,
            ${JSON.stringify(encodeMonetaryAmount(tb.totalDebits))}::jsonb,
            ${JSON.stringify(encodeMonetaryAmount(tb.totalCredits))}::jsonb,
            ${JSON.stringify(encodeMonetaryAmount(tb.totalEliminations))}::jsonb,
            ${JSON.stringify(encodeMonetaryAmount(tb.totalNCI))}::jsonb,
            ${tb.generatedAt.toDate()}
          )
        `.pipe(wrapSqlError("updateRun:trialBalance"))
      }

      return run
    })

  const findRunsByGroupOp: ConsolidationRepositoryService["findRunsByGroup"] = (groupId) =>
    findRunsByGroup(groupId).pipe(
      Effect.flatMap((rows) => Effect.forEach(rows, rowToConsolidationRun)),
      wrapSqlError("findRunsByGroup")
    )

  const findRunByGroupAndPeriodOp: ConsolidationRepositoryService["findRunByGroupAndPeriod"] = (groupId, period) =>
    findRunByGroupAndPeriod({ groupId, year: period.year, period: period.period }).pipe(
      Effect.flatMap(Option.match({
        onNone: () => Effect.succeed(Option.none<ConsolidationRun>()),
        onSome: (row) => rowToConsolidationRun(row).pipe(Effect.map(Option.some))
      })),
      wrapSqlError("findRunByGroupAndPeriod")
    )

  const findRunsByStatus: ConsolidationRepositoryService["findRunsByStatus"] = (groupId, status) =>
    findRunsByGroupAndStatus({ groupId, status }).pipe(
      Effect.flatMap((rows) => Effect.forEach(rows, rowToConsolidationRun)),
      wrapSqlError("findRunsByStatus")
    )

  const findLatestCompletedRun: ConsolidationRepositoryService["findLatestCompletedRun"] = (groupId) =>
    findLatestCompletedRunQuery(groupId).pipe(
      Effect.flatMap(Option.match({
        onNone: () => Effect.succeed(Option.none<ConsolidationRun>()),
        onSome: (row) => rowToConsolidationRun(row).pipe(Effect.map(Option.some))
      })),
      wrapSqlError("findLatestCompletedRun")
    )

  const findInProgressRuns: ConsolidationRepositoryService["findInProgressRuns"] = (groupId) =>
    findInProgressRunsQuery(groupId).pipe(
      Effect.flatMap((rows) => Effect.forEach(rows, rowToConsolidationRun)),
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
      Effect.flatMap((rows) => Effect.forEach(rows, rowToConsolidationRun)),
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
