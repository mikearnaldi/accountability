/**
 * AccountRepositoryLive - PostgreSQL implementation of AccountRepository
 *
 * Uses @effect/sql-pg for database operations with proper error handling
 * and Schema decoding for type-safe query results.
 *
 * @module AccountRepositoryLive
 */

import { SqlClient } from "@effect/sql"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import {
  Account,
  AccountId,
  type AccountCategory,
  type AccountType,
  type CashFlowCategory,
  type NormalBalance
} from "@accountability/core/domain/Account"
import { AccountNumber } from "@accountability/core/domain/AccountNumber"
import { CompanyId } from "@accountability/core/domain/Company"
import { CurrencyCode } from "@accountability/core/domain/CurrencyCode"
import { Timestamp } from "@accountability/core/domain/Timestamp"
import { AccountRepository, type AccountRepositoryService } from "./AccountRepository.ts"
import { EntityNotFoundError, PersistenceError } from "./RepositoryError.ts"

/**
 * Database row type for accounts table
 */
interface AccountRow {
  readonly id: string
  readonly company_id: string
  readonly account_number: string
  readonly name: string
  readonly description: string | null
  readonly account_type: string
  readonly account_category: string
  readonly normal_balance: string
  readonly parent_account_id: string | null
  readonly hierarchy_level: number
  readonly is_postable: boolean
  readonly is_cash_flow_relevant: boolean
  readonly cash_flow_category: string | null
  readonly is_intercompany: boolean
  readonly intercompany_partner_id: string | null
  readonly currency_restriction: string | null
  readonly is_active: boolean
  readonly created_at: Date
  readonly deactivated_at: Date | null
}

/**
 * Convert database row to Account domain entity
 */
const rowToAccount = (row: AccountRow): Effect.Effect<Account, PersistenceError> =>
  Effect.try({
    try: () =>
      Account.make(
        {
          id: AccountId.make(row.id, { disableValidation: true }),
          companyId: CompanyId.make(row.company_id, { disableValidation: true }),
          accountNumber: AccountNumber.make(row.account_number, { disableValidation: true }),
          name: row.name,
          description: row.description !== null
            ? Option.some(row.description)
            : Option.none<string>(),
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Database string to union type
          accountType: row.account_type as AccountType,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Database string to union type
          accountCategory: row.account_category as AccountCategory,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Database string to union type
          normalBalance: row.normal_balance as NormalBalance,
          parentAccountId: row.parent_account_id !== null
            ? Option.some(AccountId.make(row.parent_account_id, { disableValidation: true }))
            : Option.none<typeof AccountId.Type>(),
          hierarchyLevel: row.hierarchy_level,
          isPostable: row.is_postable,
          isCashFlowRelevant: row.is_cash_flow_relevant,
          cashFlowCategory: row.cash_flow_category !== null
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Database string to union type
            ? Option.some(row.cash_flow_category as CashFlowCategory)
            : Option.none<CashFlowCategory>(),
          isIntercompany: row.is_intercompany,
          intercompanyPartnerId: row.intercompany_partner_id !== null
            ? Option.some(CompanyId.make(row.intercompany_partner_id, { disableValidation: true }))
            : Option.none<typeof CompanyId.Type>(),
          currencyRestriction: row.currency_restriction !== null
            ? Option.some(CurrencyCode.make(row.currency_restriction, { disableValidation: true }))
            : Option.none<typeof CurrencyCode.Type>(),
          isActive: row.is_active,
          createdAt: Timestamp.make({ epochMillis: row.created_at.getTime() }, { disableValidation: true }),
          deactivatedAt: row.deactivated_at !== null
            ? Option.some(Timestamp.make({ epochMillis: row.deactivated_at.getTime() }, { disableValidation: true }))
            : Option.none<Timestamp>()
        },
        { disableValidation: true }
      ),
    catch: (cause) => new PersistenceError({ operation: "rowToAccount", cause })
  })

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
 * Implementation of AccountRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  const findById: AccountRepositoryService["findById"] = (id) =>
    Effect.gen(function* () {
      const rows = yield* sql<AccountRow>`
        SELECT * FROM accounts WHERE id = ${id}
      `.pipe(wrapSqlError("findById"))

      if (rows.length === 0) {
        return Option.none()
      }

      const account = yield* rowToAccount(rows[0])
      return Option.some(account)
    })

  const findByCompany: AccountRepositoryService["findByCompany"] = (companyId) =>
    Effect.gen(function* () {
      const rows = yield* sql<AccountRow>`
        SELECT * FROM accounts
        WHERE company_id = ${companyId}
        ORDER BY account_number
      `.pipe(wrapSqlError("findByCompany"))

      return yield* Effect.forEach(rows, rowToAccount)
    })

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
    Effect.gen(function* () {
      const rows = yield* sql<AccountRow>`
        SELECT * FROM accounts
        WHERE company_id = ${companyId} AND account_number = ${accountNumber}
      `.pipe(wrapSqlError("findByNumber"))

      if (rows.length === 0) {
        return Option.none()
      }

      const account = yield* rowToAccount(rows[0])
      return Option.some(account)
    })

  const getById: AccountRepositoryService["getById"] = (id) =>
    Effect.gen(function* () {
      const maybeAccount = yield* findById(id)
      return yield* Option.match(maybeAccount, {
        onNone: () => Effect.fail(new EntityNotFoundError({ entityType: "Account", entityId: id })),
        onSome: Effect.succeed
      })
    })

  const findActiveByCompany: AccountRepositoryService["findActiveByCompany"] = (companyId) =>
    Effect.gen(function* () {
      const rows = yield* sql<AccountRow>`
        SELECT * FROM accounts
        WHERE company_id = ${companyId} AND is_active = true
        ORDER BY account_number
      `.pipe(wrapSqlError("findActiveByCompany"))

      return yield* Effect.forEach(rows, rowToAccount)
    })

  const findByType: AccountRepositoryService["findByType"] = (companyId, accountType) =>
    Effect.gen(function* () {
      const rows = yield* sql<AccountRow>`
        SELECT * FROM accounts
        WHERE company_id = ${companyId} AND account_type = ${accountType}
        ORDER BY account_number
      `.pipe(wrapSqlError("findByType"))

      return yield* Effect.forEach(rows, rowToAccount)
    })

  const findChildren: AccountRepositoryService["findChildren"] = (parentAccountId) =>
    Effect.gen(function* () {
      const rows = yield* sql<AccountRow>`
        SELECT * FROM accounts
        WHERE parent_account_id = ${parentAccountId}
        ORDER BY account_number
      `.pipe(wrapSqlError("findChildren"))

      return yield* Effect.forEach(rows, rowToAccount)
    })

  const findIntercompanyAccounts: AccountRepositoryService["findIntercompanyAccounts"] = (companyId) =>
    Effect.gen(function* () {
      const rows = yield* sql<AccountRow>`
        SELECT * FROM accounts
        WHERE company_id = ${companyId} AND is_intercompany = true
        ORDER BY account_number
      `.pipe(wrapSqlError("findIntercompanyAccounts"))

      return yield* Effect.forEach(rows, rowToAccount)
    })

  const exists: AccountRepositoryService["exists"] = (id) =>
    Effect.gen(function* () {
      const rows = yield* sql<{ count: string }>`
        SELECT COUNT(*) as count FROM accounts WHERE id = ${id}
      `.pipe(wrapSqlError("exists"))

      return parseInt(rows[0].count, 10) > 0
    })

  const isAccountNumberTaken: AccountRepositoryService["isAccountNumberTaken"] = (companyId, accountNumber) =>
    Effect.gen(function* () {
      const rows = yield* sql<{ count: string }>`
        SELECT COUNT(*) as count FROM accounts
        WHERE company_id = ${companyId} AND account_number = ${accountNumber}
      `.pipe(wrapSqlError("isAccountNumberTaken"))

      return parseInt(rows[0].count, 10) > 0
    })

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
