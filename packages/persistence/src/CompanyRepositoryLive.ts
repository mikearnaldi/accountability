/**
 * CompanyRepositoryLive - PostgreSQL implementation of CompanyRepository
 *
 * Uses @effect/sql-pg for database operations with proper error handling
 * and Schema decoding for type-safe query results.
 *
 * @module CompanyRepositoryLive
 */

import { SqlClient } from "@effect/sql"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { Company, CompanyId, FiscalYearEnd, type ConsolidationMethod } from "@accountability/core/domain/Company"
import { CurrencyCode } from "@accountability/core/domain/CurrencyCode"
import { JurisdictionCode } from "@accountability/core/domain/JurisdictionCode"
import { OrganizationId } from "@accountability/core/domain/Organization"
import { Percentage } from "@accountability/core/domain/Percentage"
import { Timestamp } from "@accountability/core/domain/Timestamp"
import { CompanyRepository, type CompanyRepositoryService } from "./CompanyRepository.ts"
import { EntityNotFoundError, PersistenceError } from "./RepositoryError.ts"

/**
 * Database row type for companies table
 */
interface CompanyRow {
  readonly id: string
  readonly organization_id: string
  readonly name: string
  readonly legal_name: string
  readonly jurisdiction: string
  readonly tax_id: string | null
  readonly functional_currency: string
  readonly reporting_currency: string
  readonly fiscal_year_end_month: number
  readonly fiscal_year_end_day: number
  readonly parent_company_id: string | null
  readonly ownership_percentage: string | null
  readonly consolidation_method: string | null
  readonly is_active: boolean
  readonly created_at: Date
}

/**
 * Convert database row to Company domain entity
 */
const rowToCompany = (row: CompanyRow): Effect.Effect<Company, PersistenceError> =>
  Effect.try({
    try: () =>
      Company.make(
        {
          id: CompanyId.make(row.id, { disableValidation: true }),
          organizationId: OrganizationId.make(row.organization_id, { disableValidation: true }),
          name: row.name,
          legalName: row.legal_name,
          jurisdiction: JurisdictionCode.make(row.jurisdiction, { disableValidation: true }),
          taxId: row.tax_id !== null
            ? Option.some(row.tax_id)
            : Option.none<string>(),
          functionalCurrency: CurrencyCode.make(row.functional_currency, { disableValidation: true }),
          reportingCurrency: CurrencyCode.make(row.reporting_currency, { disableValidation: true }),
          fiscalYearEnd: FiscalYearEnd.make(
            { month: row.fiscal_year_end_month, day: row.fiscal_year_end_day },
            { disableValidation: true }
          ),
          parentCompanyId: row.parent_company_id !== null
            ? Option.some(CompanyId.make(row.parent_company_id, { disableValidation: true }))
            : Option.none<typeof CompanyId.Type>(),
          ownershipPercentage: row.ownership_percentage !== null
            ? Option.some(Percentage.make(parseFloat(row.ownership_percentage), { disableValidation: true }))
            : Option.none<typeof Percentage.Type>(),
          consolidationMethod: row.consolidation_method !== null
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Database string to union type
            ? Option.some(row.consolidation_method as ConsolidationMethod)
            : Option.none<ConsolidationMethod>(),
          isActive: row.is_active,
          createdAt: Timestamp.make({ epochMillis: row.created_at.getTime() }, { disableValidation: true })
        },
        { disableValidation: true }
      ),
    catch: (cause) => new PersistenceError({ operation: "rowToCompany", cause })
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
 * Implementation of CompanyRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  const findById: CompanyRepositoryService["findById"] = (id) =>
    Effect.gen(function* () {
      const rows = yield* sql<CompanyRow>`
        SELECT * FROM companies WHERE id = ${id}
      `.pipe(wrapSqlError("findById"))

      if (rows.length === 0) {
        return Option.none()
      }

      const company = yield* rowToCompany(rows[0])
      return Option.some(company)
    })

  const findByOrganization: CompanyRepositoryService["findByOrganization"] = (organizationId) =>
    Effect.gen(function* () {
      const rows = yield* sql<CompanyRow>`
        SELECT * FROM companies WHERE organization_id = ${organizationId} ORDER BY name
      `.pipe(wrapSqlError("findByOrganization"))

      return yield* Effect.forEach(rows, rowToCompany)
    })

  const create: CompanyRepositoryService["create"] = (company) =>
    Effect.gen(function* () {
      yield* sql`
        INSERT INTO companies (
          id, organization_id, name, legal_name, jurisdiction, tax_id,
          functional_currency, reporting_currency, fiscal_year_end_month, fiscal_year_end_day,
          parent_company_id, ownership_percentage, consolidation_method, is_active, created_at
        ) VALUES (
          ${company.id},
          ${company.organizationId},
          ${company.name},
          ${company.legalName},
          ${company.jurisdiction},
          ${Option.getOrNull(company.taxId)},
          ${company.functionalCurrency},
          ${company.reportingCurrency},
          ${company.fiscalYearEnd.month},
          ${company.fiscalYearEnd.day},
          ${Option.getOrNull(company.parentCompanyId)},
          ${Option.getOrNull(company.ownershipPercentage)},
          ${Option.getOrNull(company.consolidationMethod)},
          ${company.isActive},
          ${company.createdAt.toDate()}
        )
      `.pipe(wrapSqlError("create"))

      return company
    })

  const update: CompanyRepositoryService["update"] = (company) =>
    Effect.gen(function* () {
      const result = yield* sql`
        UPDATE companies SET
          name = ${company.name},
          legal_name = ${company.legalName},
          jurisdiction = ${company.jurisdiction},
          tax_id = ${Option.getOrNull(company.taxId)},
          functional_currency = ${company.functionalCurrency},
          reporting_currency = ${company.reportingCurrency},
          fiscal_year_end_month = ${company.fiscalYearEnd.month},
          fiscal_year_end_day = ${company.fiscalYearEnd.day},
          parent_company_id = ${Option.getOrNull(company.parentCompanyId)},
          ownership_percentage = ${Option.getOrNull(company.ownershipPercentage)},
          consolidation_method = ${Option.getOrNull(company.consolidationMethod)},
          is_active = ${company.isActive}
        WHERE id = ${company.id}
      `.pipe(wrapSqlError("update"))

      if (result.length === 0) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "Company", entityId: company.id })
        )
      }

      return company
    })

  const getById: CompanyRepositoryService["getById"] = (id) =>
    Effect.gen(function* () {
      const maybeCompany = yield* findById(id)
      return yield* Option.match(maybeCompany, {
        onNone: () => Effect.fail(new EntityNotFoundError({ entityType: "Company", entityId: id })),
        onSome: Effect.succeed
      })
    })

  const findActiveByOrganization: CompanyRepositoryService["findActiveByOrganization"] = (organizationId) =>
    Effect.gen(function* () {
      const rows = yield* sql<CompanyRow>`
        SELECT * FROM companies
        WHERE organization_id = ${organizationId} AND is_active = true
        ORDER BY name
      `.pipe(wrapSqlError("findActiveByOrganization"))

      return yield* Effect.forEach(rows, rowToCompany)
    })

  const findSubsidiaries: CompanyRepositoryService["findSubsidiaries"] = (parentCompanyId) =>
    Effect.gen(function* () {
      const rows = yield* sql<CompanyRow>`
        SELECT * FROM companies
        WHERE parent_company_id = ${parentCompanyId}
        ORDER BY name
      `.pipe(wrapSqlError("findSubsidiaries"))

      return yield* Effect.forEach(rows, rowToCompany)
    })

  const exists: CompanyRepositoryService["exists"] = (id) =>
    Effect.gen(function* () {
      const rows = yield* sql<{ count: string }>`
        SELECT COUNT(*) as count FROM companies WHERE id = ${id}
      `.pipe(wrapSqlError("exists"))

      return parseInt(rows[0].count, 10) > 0
    })

  return {
    findById,
    findByOrganization,
    create,
    update,
    getById,
    findActiveByOrganization,
    findSubsidiaries,
    exists
  } satisfies CompanyRepositoryService
})

/**
 * CompanyRepositoryLive - Layer providing CompanyRepository implementation
 *
 * Requires PgClient.PgClient (or SqlClient.SqlClient) in context.
 *
 * Usage:
 * ```typescript
 * import { CompanyRepositoryLive } from "@accountability/persistence/CompanyRepositoryLive"
 * import { PgContainer } from "./test/Utils.ts"
 *
 * const TestLayer = CompanyRepositoryLive.pipe(
 *   Layer.provide(PgContainer.ClientLive)
 * )
 * ```
 */
export const CompanyRepositoryLive = Layer.effect(CompanyRepository, make)
