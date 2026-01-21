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
} from "@accountability/core/accounting/Account"
import { AccountNumber } from "@accountability/core/accounting/AccountNumber"
import { CompanyId } from "@accountability/core/company/Company"
import { CurrencyCode } from "@accountability/core/currency/CurrencyCode"
import { Timestamp } from "@accountability/core/shared/values/Timestamp"
import { AccountRepository, type AccountRepositoryService } from "../Services/AccountRepository.ts"
import { EntityNotFoundError, wrapSqlError } from "../Errors/RepositoryError.ts"

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
  is_retained_earnings: Schema.Boolean,
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
    isRetainedEarnings: row.is_retained_earnings,
    createdAt: Timestamp.make({ epochMillis: row.created_at.getTime() }),
    deactivatedAt: Option.fromNullable(row.deactivated_at).pipe(
      Option.map((d) => Timestamp.make({ epochMillis: d.getTime() }))
    )
  })

/**
 * Implementation of AccountRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Request schemas for queries with organizationId
  const FindByOrgAndIdRequest = Schema.Struct({ organizationId: Schema.String, id: Schema.String })
  const FindByOrgAndCompanyRequest = Schema.Struct({ organizationId: Schema.String, companyId: Schema.String })
  const FindByOrgCompanyAndNumberRequest = Schema.Struct({ organizationId: Schema.String, companyId: Schema.String, accountNumber: Schema.String })
  const FindByOrgCompanyAndTypeRequest = Schema.Struct({ organizationId: Schema.String, companyId: Schema.String, accountType: Schema.String })
  const FindChildrenRequest = Schema.Struct({ organizationId: Schema.String, parentAccountId: Schema.String })

  // SqlSchema query builders for type-safe queries with organization filtering
  const findAccountByOrgAndId = SqlSchema.findOne({
    Request: FindByOrgAndIdRequest,
    Result: AccountRow,
    execute: ({ organizationId, id }) => sql`
      SELECT a.* FROM accounts a
      INNER JOIN companies c ON a.company_id = c.id
      WHERE a.id = ${id} AND c.organization_id = ${organizationId}
    `
  })

  const findAccountsByOrgAndCompany = SqlSchema.findAll({
    Request: FindByOrgAndCompanyRequest,
    Result: AccountRow,
    execute: ({ organizationId, companyId }) => sql`
      SELECT a.* FROM accounts a
      INNER JOIN companies c ON a.company_id = c.id
      WHERE a.company_id = ${companyId} AND c.organization_id = ${organizationId}
      ORDER BY a.account_number
    `
  })

  const findAccountByOrgCompanyNumber = SqlSchema.findOne({
    Request: FindByOrgCompanyAndNumberRequest,
    Result: AccountRow,
    execute: ({ organizationId, companyId, accountNumber }) => sql`
      SELECT a.* FROM accounts a
      INNER JOIN companies c ON a.company_id = c.id
      WHERE a.company_id = ${companyId} AND a.account_number = ${accountNumber} AND c.organization_id = ${organizationId}
    `
  })

  const findActiveAccountsByOrgAndCompany = SqlSchema.findAll({
    Request: FindByOrgAndCompanyRequest,
    Result: AccountRow,
    execute: ({ organizationId, companyId }) => sql`
      SELECT a.* FROM accounts a
      INNER JOIN companies c ON a.company_id = c.id
      WHERE a.company_id = ${companyId} AND a.is_active = true AND c.organization_id = ${organizationId}
      ORDER BY a.account_number
    `
  })

  const findAccountsByOrgCompanyType = SqlSchema.findAll({
    Request: FindByOrgCompanyAndTypeRequest,
    Result: AccountRow,
    execute: ({ organizationId, companyId, accountType }) => sql`
      SELECT a.* FROM accounts a
      INNER JOIN companies c ON a.company_id = c.id
      WHERE a.company_id = ${companyId} AND a.account_type = ${accountType} AND c.organization_id = ${organizationId}
      ORDER BY a.account_number
    `
  })

  const findAccountChildrenByOrg = SqlSchema.findAll({
    Request: FindChildrenRequest,
    Result: AccountRow,
    execute: ({ organizationId, parentAccountId }) => sql`
      SELECT a.* FROM accounts a
      INNER JOIN companies c ON a.company_id = c.id
      WHERE a.parent_account_id = ${parentAccountId} AND c.organization_id = ${organizationId}
      ORDER BY a.account_number
    `
  })

  const findIntercompanyByOrg = SqlSchema.findAll({
    Request: FindByOrgAndCompanyRequest,
    Result: AccountRow,
    execute: ({ organizationId, companyId }) => sql`
      SELECT a.* FROM accounts a
      INNER JOIN companies c ON a.company_id = c.id
      WHERE a.company_id = ${companyId} AND a.is_intercompany = true AND c.organization_id = ${organizationId}
      ORDER BY a.account_number
    `
  })

  const countByOrgAndId = SqlSchema.single({
    Request: FindByOrgAndIdRequest,
    Result: CountRow,
    execute: ({ organizationId, id }) => sql`
      SELECT COUNT(*) as count FROM accounts a
      INNER JOIN companies c ON a.company_id = c.id
      WHERE a.id = ${id} AND c.organization_id = ${organizationId}
    `
  })

  const countByOrgCompanyAndNumber = SqlSchema.single({
    Request: FindByOrgCompanyAndNumberRequest,
    Result: CountRow,
    execute: ({ organizationId, companyId, accountNumber }) => sql`
      SELECT COUNT(*) as count FROM accounts a
      INNER JOIN companies c ON a.company_id = c.id
      WHERE a.company_id = ${companyId} AND a.account_number = ${accountNumber} AND c.organization_id = ${organizationId}
    `
  })

  const findById: AccountRepositoryService["findById"] = (organizationId, id) =>
    findAccountByOrgAndId({ organizationId, id }).pipe(
      Effect.map(Option.map(rowToAccount)),
      wrapSqlError("findById")
    )

  const findByCompany: AccountRepositoryService["findByCompany"] = (organizationId, companyId) =>
    findAccountsByOrgAndCompany({ organizationId, companyId }).pipe(
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
          is_active, is_retained_earnings, created_at, deactivated_at
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
          ${account.isRetainedEarnings},
          ${account.createdAt.toDate()},
          ${Option.match(account.deactivatedAt, { onNone: () => null, onSome: (t) => t.toDate() })}
        )
      `.pipe(wrapSqlError("create"))

      return account
    })

  const update: AccountRepositoryService["update"] = (organizationId, account) =>
    Effect.gen(function* () {
      // Use RETURNING to verify the row was updated and belongs to the org
      const result = yield* sql`
        UPDATE accounts a SET
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
          is_retained_earnings = ${account.isRetainedEarnings},
          deactivated_at = ${Option.match(account.deactivatedAt, { onNone: () => null, onSome: (t) => t.toDate() })}
        FROM companies c
        WHERE a.id = ${account.id}
          AND a.company_id = c.id
          AND c.organization_id = ${organizationId}
        RETURNING a.id
      `.pipe(wrapSqlError("update"))

      if (result.length === 0) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "Account", entityId: account.id })
        )
      }

      return account
    })

  const findByNumber: AccountRepositoryService["findByNumber"] = (organizationId, companyId, accountNumber) =>
    findAccountByOrgCompanyNumber({ organizationId, companyId, accountNumber }).pipe(
      Effect.map(Option.map(rowToAccount)),
      wrapSqlError("findByNumber")
    )

  const getById: AccountRepositoryService["getById"] = (organizationId, id) =>
    Effect.gen(function* () {
      const maybeAccount = yield* findById(organizationId, id)
      return yield* Option.match(maybeAccount, {
        onNone: () => Effect.fail(new EntityNotFoundError({ entityType: "Account", entityId: id })),
        onSome: Effect.succeed
      })
    })

  const findActiveByCompany: AccountRepositoryService["findActiveByCompany"] = (organizationId, companyId) =>
    findActiveAccountsByOrgAndCompany({ organizationId, companyId }).pipe(
      Effect.map((rows) => rows.map(rowToAccount)),
      wrapSqlError("findActiveByCompany")
    )

  const findByType: AccountRepositoryService["findByType"] = (organizationId, companyId, accountType) =>
    findAccountsByOrgCompanyType({ organizationId, companyId, accountType }).pipe(
      Effect.map((rows) => rows.map(rowToAccount)),
      wrapSqlError("findByType")
    )

  const findChildren: AccountRepositoryService["findChildren"] = (organizationId, parentAccountId) =>
    findAccountChildrenByOrg({ organizationId, parentAccountId }).pipe(
      Effect.map((rows) => rows.map(rowToAccount)),
      wrapSqlError("findChildren")
    )

  const findIntercompanyAccounts: AccountRepositoryService["findIntercompanyAccounts"] = (organizationId, companyId) =>
    findIntercompanyByOrg({ organizationId, companyId }).pipe(
      Effect.map((rows) => rows.map(rowToAccount)),
      wrapSqlError("findIntercompanyAccounts")
    )

  const exists: AccountRepositoryService["exists"] = (organizationId, id) =>
    countByOrgAndId({ organizationId, id }).pipe(
      Effect.map((row) => parseInt(row.count, 10) > 0),
      wrapSqlError("exists")
    )

  const isAccountNumberTaken: AccountRepositoryService["isAccountNumberTaken"] = (organizationId, companyId, accountNumber) =>
    countByOrgCompanyAndNumber({ organizationId, companyId, accountNumber }).pipe(
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
