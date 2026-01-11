/**
 * AccountRepositoryLive - PostgreSQL implementation of AccountRepository
 *
 * Uses @effect/sql-pg for database operations with proper error handling
 * and Schema decoding for type-safe query results.
 *
 * @module AccountRepositoryLive
 */

import { SqlClient, SqlSchema } from "@effect/sql"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import {
  Account,
  AccountId,
  AccountCategory,
  AccountType,
  CashFlowCategory,
  NormalBalance
} from "@accountability/core/domain/Account"
import { AccountNumber } from "@accountability/core/domain/AccountNumber"
import { CompanyId } from "@accountability/core/domain/Company"
import { CurrencyCode } from "@accountability/core/domain/CurrencyCode"
import { Timestamp } from "@accountability/core/domain/Timestamp"
import { AccountRepository, type AccountRepositoryService } from "./AccountRepository.ts"
import { EntityNotFoundError, PersistenceError } from "./RepositoryError.ts"

/**
 * Schema for database row from accounts table
 * Uses proper literal types for enum fields to avoid type assertions
 */
const AccountRow = Schema.Struct({
  id: Schema.String,
  company_id: Schema.String,
  account_number: Schema.String,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  account_type: AccountType,
  account_category: AccountCategory,
  normal_balance: NormalBalance,
  parent_account_id: Schema.NullOr(Schema.String),
  hierarchy_level: Schema.Number,
  is_postable: Schema.Boolean,
  is_cash_flow_relevant: Schema.Boolean,
  cash_flow_category: Schema.NullOr(CashFlowCategory),
  is_intercompany: Schema.Boolean,
  intercompany_partner_id: Schema.NullOr(Schema.String),
  currency_restriction: Schema.NullOr(Schema.String),
  is_active: Schema.Boolean,
  created_at: Schema.DateFromSelf,
  deactivated_at: Schema.NullOr(Schema.DateFromSelf)
})
type AccountRow = typeof AccountRow.Type

/**
 * Schema for count query result
 */
const CountRow = Schema.Struct({
  count: Schema.String
})

/**
 * Convert database row to Account domain entity
 * Pure function - no Effect wrapping needed
 * Since the row schema uses proper literal types, no type assertions needed
 */
const rowToAccount = (row: AccountRow): Account =>
  Account.make({
    id: AccountId.make(row.id),
    companyId: CompanyId.make(row.company_id),
    accountNumber: AccountNumber.make(row.account_number),
    name: row.name,
    description: Option.fromNullable(row.description),
    accountType: row.account_type,
    accountCategory: row.account_category,
    normalBalance: row.normal_balance,
    parentAccountId: Option.fromNullable(row.parent_account_id).pipe(
      Option.map(AccountId.make)
    ),
    hierarchyLevel: row.hierarchy_level,
    isPostable: row.is_postable,
    isCashFlowRelevant: row.is_cash_flow_relevant,
    cashFlowCategory: Option.fromNullable(row.cash_flow_category),
    isIntercompany: row.is_intercompany,
    intercompanyPartnerId: Option.fromNullable(row.intercompany_partner_id).pipe(
      Option.map(CompanyId.make)
    ),
    currencyRestriction: Option.fromNullable(row.currency_restriction).pipe(
      Option.map(CurrencyCode.make)
    ),
    isActive: row.is_active,
    createdAt: Timestamp.make({ epochMillis: row.created_at.getTime() }),
    deactivatedAt: Option.fromNullable(row.deactivated_at).pipe(
      Option.map((d) => Timestamp.make({ epochMillis: d.getTime() }))
    )
  })

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
 * Implementation of AccountRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // SqlSchema query builders for type-safe queries
  const findAccountById = SqlSchema.findOne({
    Request: Schema.String,
    Result: AccountRow,
    execute: (id) => sql`SELECT * FROM accounts WHERE id = ${id}`
  })

  const findAccountsByCompany = SqlSchema.findAll({
    Request: Schema.String,
    Result: AccountRow,
    execute: (companyId) => sql`
      SELECT * FROM accounts
      WHERE company_id = ${companyId}
      ORDER BY account_number
    `
  })

  const findAccountByNumber = SqlSchema.findOne({
    Request: Schema.Struct({ companyId: Schema.String, accountNumber: Schema.String }),
    Result: AccountRow,
    execute: ({ companyId, accountNumber }) => sql`
      SELECT * FROM accounts
      WHERE company_id = ${companyId} AND account_number = ${accountNumber}
    `
  })

  const findActiveAccountsByCompany = SqlSchema.findAll({
    Request: Schema.String,
    Result: AccountRow,
    execute: (companyId) => sql`
      SELECT * FROM accounts
      WHERE company_id = ${companyId} AND is_active = true
      ORDER BY account_number
    `
  })

  const findAccountsByType = SqlSchema.findAll({
    Request: Schema.Struct({ companyId: Schema.String, accountType: Schema.String }),
    Result: AccountRow,
    execute: ({ companyId, accountType }) => sql`
      SELECT * FROM accounts
      WHERE company_id = ${companyId} AND account_type = ${accountType}
      ORDER BY account_number
    `
  })

  const findAccountChildren = SqlSchema.findAll({
    Request: Schema.String,
    Result: AccountRow,
    execute: (parentAccountId) => sql`
      SELECT * FROM accounts
      WHERE parent_account_id = ${parentAccountId}
      ORDER BY account_number
    `
  })

  const findIntercompany = SqlSchema.findAll({
    Request: Schema.String,
    Result: AccountRow,
    execute: (companyId) => sql`
      SELECT * FROM accounts
      WHERE company_id = ${companyId} AND is_intercompany = true
      ORDER BY account_number
    `
  })

  const countById = SqlSchema.single({
    Request: Schema.String,
    Result: CountRow,
    execute: (id) => sql`SELECT COUNT(*) as count FROM accounts WHERE id = ${id}`
  })

  const countByCompanyAndNumber = SqlSchema.single({
    Request: Schema.Struct({ companyId: Schema.String, accountNumber: Schema.String }),
    Result: CountRow,
    execute: ({ companyId, accountNumber }) => sql`
      SELECT COUNT(*) as count FROM accounts
      WHERE company_id = ${companyId} AND account_number = ${accountNumber}
    `
  })

  const findById: AccountRepositoryService["findById"] = (id) =>
    findAccountById(id).pipe(
      Effect.map(Option.map(rowToAccount)),
      wrapSqlError("findById")
    )

  const findByCompany: AccountRepositoryService["findByCompany"] = (companyId) =>
    findAccountsByCompany(companyId).pipe(
      Effect.map((rows) => rows.map(rowToAccount)),
      wrapSqlError("findByCompany")
    )

  const create: AccountRepositoryService["create"] = (account) =>
    Effect.gen(function* () {
      yield* sql`
        INSERT INTO accounts (
          id, company_id, account_number, name, description,
          account_type, account_category, normal_balance,
          parent_account_id, hierarchy_level, is_postable,
          is_cash_flow_relevant, cash_flow_category,
          is_intercompany, intercompany_partner_id, currency_restriction,
          is_active, created_at, deactivated_at
        ) VALUES (
          ${account.id},
          ${account.companyId},
          ${account.accountNumber},
          ${account.name},
          ${Option.getOrNull(account.description)},
          ${account.accountType},
          ${account.accountCategory},
          ${account.normalBalance},
          ${Option.getOrNull(account.parentAccountId)},
          ${account.hierarchyLevel},
          ${account.isPostable},
          ${account.isCashFlowRelevant},
          ${Option.getOrNull(account.cashFlowCategory)},
          ${account.isIntercompany},
          ${Option.getOrNull(account.intercompanyPartnerId)},
          ${Option.getOrNull(account.currencyRestriction)},
          ${account.isActive},
          ${account.createdAt.toDate()},
          ${Option.match(account.deactivatedAt, { onNone: () => null, onSome: (t) => t.toDate() })}
        )
      `.pipe(wrapSqlError("create"))

      return account
    })

  const update: AccountRepositoryService["update"] = (account) =>
    Effect.gen(function* () {
      const result = yield* sql`
        UPDATE accounts SET
          name = ${account.name},
          description = ${Option.getOrNull(account.description)},
          account_type = ${account.accountType},
          account_category = ${account.accountCategory},
          normal_balance = ${account.normalBalance},
          parent_account_id = ${Option.getOrNull(account.parentAccountId)},
          hierarchy_level = ${account.hierarchyLevel},
          is_postable = ${account.isPostable},
          is_cash_flow_relevant = ${account.isCashFlowRelevant},
          cash_flow_category = ${Option.getOrNull(account.cashFlowCategory)},
          is_intercompany = ${account.isIntercompany},
          intercompany_partner_id = ${Option.getOrNull(account.intercompanyPartnerId)},
          currency_restriction = ${Option.getOrNull(account.currencyRestriction)},
          is_active = ${account.isActive},
          deactivated_at = ${Option.match(account.deactivatedAt, { onNone: () => null, onSome: (t) => t.toDate() })}
        WHERE id = ${account.id}
      `.pipe(wrapSqlError("update"))

      if (result.length === 0) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "Account", entityId: account.id })
        )
      }

      return account
    })

  const findByNumber: AccountRepositoryService["findByNumber"] = (companyId, accountNumber) =>
    findAccountByNumber({ companyId, accountNumber }).pipe(
      Effect.map(Option.map(rowToAccount)),
      wrapSqlError("findByNumber")
    )

  const getById: AccountRepositoryService["getById"] = (id) =>
    Effect.gen(function* () {
      const maybeAccount = yield* findById(id)
      return yield* Option.match(maybeAccount, {
        onNone: () => Effect.fail(new EntityNotFoundError({ entityType: "Account", entityId: id })),
        onSome: Effect.succeed
      })
    })

  const findActiveByCompany: AccountRepositoryService["findActiveByCompany"] = (companyId) =>
    findActiveAccountsByCompany(companyId).pipe(
      Effect.map((rows) => rows.map(rowToAccount)),
      wrapSqlError("findActiveByCompany")
    )

  const findByType: AccountRepositoryService["findByType"] = (companyId, accountType) =>
    findAccountsByType({ companyId, accountType }).pipe(
      Effect.map((rows) => rows.map(rowToAccount)),
      wrapSqlError("findByType")
    )

  const findChildren: AccountRepositoryService["findChildren"] = (parentAccountId) =>
    findAccountChildren(parentAccountId).pipe(
      Effect.map((rows) => rows.map(rowToAccount)),
      wrapSqlError("findChildren")
    )

  const findIntercompanyAccounts: AccountRepositoryService["findIntercompanyAccounts"] = (companyId) =>
    findIntercompany(companyId).pipe(
      Effect.map((rows) => rows.map(rowToAccount)),
      wrapSqlError("findIntercompanyAccounts")
    )

  const exists: AccountRepositoryService["exists"] = (id) =>
    countById(id).pipe(
      Effect.map((row) => parseInt(row.count, 10) > 0),
      wrapSqlError("exists")
    )

  const isAccountNumberTaken: AccountRepositoryService["isAccountNumberTaken"] = (companyId, accountNumber) =>
    countByCompanyAndNumber({ companyId, accountNumber }).pipe(
      Effect.map((row) => parseInt(row.count, 10) > 0),
      wrapSqlError("isAccountNumberTaken")
    )

  return {
    findById,
    findByCompany,
    create,
    update,
    findByNumber,
    getById,
    findActiveByCompany,
    findByType,
    findChildren,
    findIntercompanyAccounts,
    exists,
    isAccountNumberTaken
  } satisfies AccountRepositoryService
})

/**
 * AccountRepositoryLive - Layer providing AccountRepository implementation
 *
 * Requires PgClient.PgClient (or SqlClient.SqlClient) in context.
 */
export const AccountRepositoryLive = Layer.effect(AccountRepository, make)
