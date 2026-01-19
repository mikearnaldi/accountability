/**
 * EliminationRuleRepositoryLive - PostgreSQL implementation of EliminationRuleRepository
 *
 * Uses @effect/sql-pg for database operations with proper error handling
 * and Schema decoding for type-safe query results.
 *
 * @module EliminationRuleRepositoryLive
 */

import { SqlClient, SqlSchema } from "@effect/sql"
import * as BigDecimal from "effect/BigDecimal"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import {
  ConsolidationGroupId,
  EliminationRuleId
} from "@accountability/core/consolidation/ConsolidationGroup"
import { AccountId, AccountCategory } from "@accountability/core/accounting/Account"
import { AccountNumber } from "@accountability/core/accounting/AccountNumber"
import {
  EliminationRule,
  EliminationType,
  TriggerCondition,
  type AccountSelector,
  AccountSelectorById,
  AccountSelectorByRange,
  AccountSelectorByCategory
} from "@accountability/core/consolidation/EliminationRule"
import {
  EliminationRuleRepository,
  type EliminationRuleRepositoryService
} from "../Services/EliminationRuleRepository.ts"
import { EntityNotFoundError, wrapSqlError } from "../Errors/RepositoryError.ts"

/**
 * Schema for AccountSelector JSON stored in database
 */
const AccountSelectorJson = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("ById"),
    accountId: Schema.String
  }),
  Schema.Struct({
    _tag: Schema.Literal("ByRange"),
    fromAccountNumber: Schema.String,
    toAccountNumber: Schema.String
  }),
  Schema.Struct({
    _tag: Schema.Literal("ByCategory"),
    category: AccountCategory
  })
)
type AccountSelectorJson = typeof AccountSelectorJson.Type

/**
 * Schema for TriggerCondition JSON stored in database
 */
const TriggerConditionJson = Schema.Struct({
  description: Schema.String,
  sourceAccounts: Schema.Array(AccountSelectorJson),
  minimumAmount: Schema.NullOr(Schema.String)
})
type TriggerConditionJson = typeof TriggerConditionJson.Type

/**
 * Schema for database row from elimination_rules table
 */
const EliminationRuleRow = Schema.Struct({
  id: Schema.String,
  consolidation_group_id: Schema.String,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  elimination_type: EliminationType,
  trigger_conditions: Schema.Array(TriggerConditionJson),
  source_accounts: Schema.Array(AccountSelectorJson),
  target_accounts: Schema.Array(AccountSelectorJson),
  debit_account_id: Schema.String,
  credit_account_id: Schema.String,
  is_automatic: Schema.Boolean,
  priority: Schema.Number,
  is_active: Schema.Boolean
})
type EliminationRuleRow = typeof EliminationRuleRow.Type

/**
 * Schema for count query result
 */
const CountRow = Schema.Struct({
  count: Schema.String
})

/**
 * Convert JSON AccountSelector to domain AccountSelector
 */
const jsonToAccountSelector = (json: AccountSelectorJson): AccountSelector => {
  switch (json._tag) {
    case "ById":
      return AccountSelectorById.make({
        accountId: AccountId.make(json.accountId)
      })
    case "ByRange":
      return AccountSelectorByRange.make({
        fromAccountNumber: AccountNumber.make(json.fromAccountNumber),
        toAccountNumber: AccountNumber.make(json.toAccountNumber)
      })
    case "ByCategory":
      return AccountSelectorByCategory.make({
        category: json.category
      })
  }
}

/**
 * Convert domain AccountSelector to JSON for database storage
 */
const accountSelectorToJson = (selector: AccountSelector): AccountSelectorJson => {
  switch (selector._tag) {
    case "ById":
      return {
        _tag: "ById",
        accountId: selector.accountId
      }
    case "ByRange":
      return {
        _tag: "ByRange",
        fromAccountNumber: selector.fromAccountNumber,
        toAccountNumber: selector.toAccountNumber
      }
    case "ByCategory":
      return {
        _tag: "ByCategory",
        category: selector.category
      }
  }
}

/**
 * Convert JSON TriggerCondition to domain TriggerCondition
 */
const jsonToTriggerCondition = (json: TriggerConditionJson): TriggerCondition =>
  TriggerCondition.make({
    description: json.description,
    sourceAccounts: Chunk.fromIterable(json.sourceAccounts.map(jsonToAccountSelector)),
    minimumAmount: Option.fromNullable(json.minimumAmount).pipe(
      Option.map((s) => BigDecimal.unsafeFromString(s))
    )
  })

/**
 * Convert domain TriggerCondition to JSON for database storage
 */
const triggerConditionToJson = (condition: TriggerCondition): TriggerConditionJson => ({
  description: condition.description,
  sourceAccounts: Chunk.toArray(condition.sourceAccounts).map(accountSelectorToJson),
  minimumAmount: Option.match(condition.minimumAmount, {
    onNone: () => null,
    onSome: (bd) => BigDecimal.format(bd)
  })
})

/**
 * Convert database row to EliminationRule domain entity
 */
const rowToEliminationRule = (row: EliminationRuleRow): EliminationRule =>
  EliminationRule.make({
    id: EliminationRuleId.make(row.id),
    consolidationGroupId: ConsolidationGroupId.make(row.consolidation_group_id),
    name: row.name,
    description: Option.fromNullable(row.description),
    eliminationType: row.elimination_type,
    triggerConditions: Chunk.fromIterable(row.trigger_conditions.map(jsonToTriggerCondition)),
    sourceAccounts: Chunk.fromIterable(row.source_accounts.map(jsonToAccountSelector)),
    targetAccounts: Chunk.fromIterable(row.target_accounts.map(jsonToAccountSelector)),
    debitAccountId: AccountId.make(row.debit_account_id),
    creditAccountId: AccountId.make(row.credit_account_id),
    isAutomatic: row.is_automatic,
    priority: row.priority,
    isActive: row.is_active
  })

/**
 * Implementation of EliminationRuleRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Query builders
  const findRuleById = SqlSchema.findOne({
    Request: Schema.String,
    Result: EliminationRuleRow,
    execute: (id) => sql`SELECT * FROM elimination_rules WHERE id = ${id}`
  })

  const findByGroupQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: EliminationRuleRow,
    execute: (groupId) => sql`
      SELECT * FROM elimination_rules
      WHERE consolidation_group_id = ${groupId}
      ORDER BY priority ASC
    `
  })

  const findActiveByGroupQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: EliminationRuleRow,
    execute: (groupId) => sql`
      SELECT * FROM elimination_rules
      WHERE consolidation_group_id = ${groupId} AND is_active = true
      ORDER BY priority ASC
    `
  })

  const findAutomaticByGroupQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: EliminationRuleRow,
    execute: (groupId) => sql`
      SELECT * FROM elimination_rules
      WHERE consolidation_group_id = ${groupId} AND is_automatic = true AND is_active = true
      ORDER BY priority ASC
    `
  })

  const findByTypeQuery = SqlSchema.findAll({
    Request: Schema.Struct({ groupId: Schema.String, eliminationType: Schema.String }),
    Result: EliminationRuleRow,
    execute: ({ groupId, eliminationType }) => sql`
      SELECT * FROM elimination_rules
      WHERE consolidation_group_id = ${groupId} AND elimination_type = ${eliminationType}
      ORDER BY priority ASC
    `
  })

  const findHighPriorityQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: EliminationRuleRow,
    execute: (groupId) => sql`
      SELECT * FROM elimination_rules
      WHERE consolidation_group_id = ${groupId} AND priority <= 10 AND is_active = true
      ORDER BY priority ASC
    `
  })

  const countById = SqlSchema.single({
    Request: Schema.String,
    Result: CountRow,
    execute: (id) => sql`SELECT COUNT(*) as count FROM elimination_rules WHERE id = ${id}`
  })

  // Service methods
  const findById: EliminationRuleRepositoryService["findById"] = (id) =>
    findRuleById(id).pipe(
      Effect.map(Option.map(rowToEliminationRule)),
      wrapSqlError("findById")
    )

  const getById: EliminationRuleRepositoryService["getById"] = (id) =>
    Effect.gen(function* () {
      const maybeRule = yield* findById(id)
      return yield* Option.match(maybeRule, {
        onNone: () => Effect.fail(new EntityNotFoundError({ entityType: "EliminationRule", entityId: id })),
        onSome: Effect.succeed
      })
    })

  const create: EliminationRuleRepositoryService["create"] = (rule) =>
    Effect.gen(function* () {
      const triggerConditionsJson = JSON.stringify(Chunk.toArray(rule.triggerConditions).map(triggerConditionToJson))
      const sourceAccountsJson = JSON.stringify(Chunk.toArray(rule.sourceAccounts).map(accountSelectorToJson))
      const targetAccountsJson = JSON.stringify(Chunk.toArray(rule.targetAccounts).map(accountSelectorToJson))

      yield* sql`
        INSERT INTO elimination_rules (
          id, consolidation_group_id, name, description, elimination_type,
          trigger_conditions, source_accounts, target_accounts,
          debit_account_id, credit_account_id, is_automatic, priority, is_active
        ) VALUES (
          ${rule.id},
          ${rule.consolidationGroupId},
          ${rule.name},
          ${Option.getOrNull(rule.description)},
          ${rule.eliminationType},
          ${triggerConditionsJson}::jsonb,
          ${sourceAccountsJson}::jsonb,
          ${targetAccountsJson}::jsonb,
          ${rule.debitAccountId},
          ${rule.creditAccountId},
          ${rule.isAutomatic},
          ${rule.priority},
          ${rule.isActive}
        )
      `.pipe(wrapSqlError("create"))

      return rule
    })

  const update: EliminationRuleRepositoryService["update"] = (rule) =>
    Effect.gen(function* () {
      const exists_ = yield* exists(rule.id)
      if (!exists_) {
        return yield* Effect.fail(new EntityNotFoundError({ entityType: "EliminationRule", entityId: rule.id }))
      }

      const triggerConditionsJson = JSON.stringify(Chunk.toArray(rule.triggerConditions).map(triggerConditionToJson))
      const sourceAccountsJson = JSON.stringify(Chunk.toArray(rule.sourceAccounts).map(accountSelectorToJson))
      const targetAccountsJson = JSON.stringify(Chunk.toArray(rule.targetAccounts).map(accountSelectorToJson))

      yield* sql`
        UPDATE elimination_rules SET
          consolidation_group_id = ${rule.consolidationGroupId},
          name = ${rule.name},
          description = ${Option.getOrNull(rule.description)},
          elimination_type = ${rule.eliminationType},
          trigger_conditions = ${triggerConditionsJson}::jsonb,
          source_accounts = ${sourceAccountsJson}::jsonb,
          target_accounts = ${targetAccountsJson}::jsonb,
          debit_account_id = ${rule.debitAccountId},
          credit_account_id = ${rule.creditAccountId},
          is_automatic = ${rule.isAutomatic},
          priority = ${rule.priority},
          is_active = ${rule.isActive},
          updated_at = NOW()
        WHERE id = ${rule.id}
      `.pipe(wrapSqlError("update"))

      return rule
    })

  const delete_: EliminationRuleRepositoryService["delete"] = (id) =>
    Effect.gen(function* () {
      const exists_ = yield* exists(id)
      if (!exists_) {
        return yield* Effect.fail(new EntityNotFoundError({ entityType: "EliminationRule", entityId: id }))
      }

      yield* sql`DELETE FROM elimination_rules WHERE id = ${id}`.pipe(wrapSqlError("delete"))
    })

  const findByConsolidationGroup: EliminationRuleRepositoryService["findByConsolidationGroup"] = (groupId) =>
    findByGroupQuery(groupId).pipe(
      Effect.map((rows) => rows.map(rowToEliminationRule)),
      wrapSqlError("findByConsolidationGroup")
    )

  const findActiveByConsolidationGroup: EliminationRuleRepositoryService["findActiveByConsolidationGroup"] = (
    groupId
  ) =>
    findActiveByGroupQuery(groupId).pipe(
      Effect.map((rows) => rows.map(rowToEliminationRule)),
      wrapSqlError("findActiveByConsolidationGroup")
    )

  const findAutomaticByConsolidationGroup: EliminationRuleRepositoryService["findAutomaticByConsolidationGroup"] = (
    groupId
  ) =>
    findAutomaticByGroupQuery(groupId).pipe(
      Effect.map((rows) => rows.map(rowToEliminationRule)),
      wrapSqlError("findAutomaticByConsolidationGroup")
    )

  const findByType: EliminationRuleRepositoryService["findByType"] = (groupId, eliminationType) =>
    findByTypeQuery({ groupId, eliminationType }).pipe(
      Effect.map((rows) => rows.map(rowToEliminationRule)),
      wrapSqlError("findByType")
    )

  const findHighPriority: EliminationRuleRepositoryService["findHighPriority"] = (groupId) =>
    findHighPriorityQuery(groupId).pipe(
      Effect.map((rows) => rows.map(rowToEliminationRule)),
      wrapSqlError("findHighPriority")
    )

  const exists: EliminationRuleRepositoryService["exists"] = (id) =>
    countById(id).pipe(
      Effect.map((row) => parseInt(row.count, 10) > 0),
      wrapSqlError("exists")
    )

  const activate: EliminationRuleRepositoryService["activate"] = (id) =>
    Effect.gen(function* () {
      const exists_ = yield* exists(id)
      if (!exists_) {
        return yield* Effect.fail(new EntityNotFoundError({ entityType: "EliminationRule", entityId: id }))
      }

      yield* sql`
        UPDATE elimination_rules SET
          is_active = true,
          updated_at = NOW()
        WHERE id = ${id}
      `.pipe(wrapSqlError("activate"))

      return yield* getById(id)
    })

  const deactivate: EliminationRuleRepositoryService["deactivate"] = (id) =>
    Effect.gen(function* () {
      const exists_ = yield* exists(id)
      if (!exists_) {
        return yield* Effect.fail(new EntityNotFoundError({ entityType: "EliminationRule", entityId: id }))
      }

      yield* sql`
        UPDATE elimination_rules SET
          is_active = false,
          updated_at = NOW()
        WHERE id = ${id}
      `.pipe(wrapSqlError("deactivate"))

      return yield* getById(id)
    })

  const updatePriority: EliminationRuleRepositoryService["updatePriority"] = (id, priority) =>
    Effect.gen(function* () {
      const exists_ = yield* exists(id)
      if (!exists_) {
        return yield* Effect.fail(new EntityNotFoundError({ entityType: "EliminationRule", entityId: id }))
      }

      yield* sql`
        UPDATE elimination_rules SET
          priority = ${priority},
          updated_at = NOW()
        WHERE id = ${id}
      `.pipe(wrapSqlError("updatePriority"))

      return yield* getById(id)
    })

  const createMany: EliminationRuleRepositoryService["createMany"] = (rules) =>
    Effect.gen(function* () {
      for (const rule of rules) {
        yield* create(rule)
      }
      return rules
    })

  return {
    findById,
    getById,
    create,
    update,
    delete: delete_,
    findByConsolidationGroup,
    findActiveByConsolidationGroup,
    findAutomaticByConsolidationGroup,
    findByType,
    findHighPriority,
    exists,
    activate,
    deactivate,
    updatePriority,
    createMany
  } satisfies EliminationRuleRepositoryService
})

/**
 * EliminationRuleRepositoryLive - Layer providing EliminationRuleRepository implementation
 *
 * Requires PgClient.PgClient (or SqlClient.SqlClient) in context.
 */
export const EliminationRuleRepositoryLive = Layer.effect(EliminationRuleRepository, make)
