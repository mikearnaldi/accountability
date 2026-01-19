/**
 * AccountRepository - Repository interface for Account entity persistence
 *
 * Uses Effect Context.Tag pattern for dependency injection.
 * All operations return Effect with typed errors.
 *
 * @module AccountRepository
 */

import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type * as Option from "effect/Option"
import type { Account, AccountId, AccountType } from "@accountability/core/accounting/Account"
import type { AccountNumber } from "@accountability/core/accounting/AccountNumber"
import type { CompanyId } from "@accountability/core/company/Company"
import type { OrganizationId } from "@accountability/core/organization/Organization"
import type { EntityNotFoundError, PersistenceError } from "../Errors/RepositoryError.ts"

/**
 * AccountRepository - Service interface for Account persistence
 *
 * Provides CRUD operations for Account entities with typed error handling.
 */
export interface AccountRepositoryService {
  /**
   * Find an account by its unique identifier within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param id - The account ID to search for
   * @returns Effect containing Option of Account (None if not found or not in org)
   */
  readonly findById: (
    organizationId: OrganizationId,
    id: AccountId
  ) => Effect.Effect<Option.Option<Account>, PersistenceError>

  /**
   * Find all accounts belonging to a company within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param companyId - The company ID to filter by
   * @returns Effect containing array of accounts
   */
  readonly findByCompany: (
    organizationId: OrganizationId,
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<Account>, PersistenceError>

  /**
   * Create a new account (company must belong to organization)
   *
   * @param account - The account entity to create
   * @returns Effect containing the created account
   */
  readonly create: (
    account: Account
  ) => Effect.Effect<Account, PersistenceError>

  /**
   * Update an existing account within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param account - The account entity with updated values
   * @returns Effect containing the updated account
   * @throws EntityNotFoundError if account doesn't exist or not in org
   */
  readonly update: (
    organizationId: OrganizationId,
    account: Account
  ) => Effect.Effect<Account, EntityNotFoundError | PersistenceError>

  /**
   * Find an account by its account number within a company/organization
   *
   * @param organizationId - The organization ID for authorization
   * @param companyId - The company ID to filter by
   * @param accountNumber - The account number to search for
   * @returns Effect containing Option of Account (None if not found)
   */
  readonly findByNumber: (
    organizationId: OrganizationId,
    companyId: CompanyId,
    accountNumber: AccountNumber
  ) => Effect.Effect<Option.Option<Account>, PersistenceError>

  /**
   * Find an account by its unique identifier, throwing if not found
   *
   * @param organizationId - The organization ID for authorization
   * @param id - The account ID to search for
   * @returns Effect containing the Account
   * @throws EntityNotFoundError if account doesn't exist or not in org
   */
  readonly getById: (
    organizationId: OrganizationId,
    id: AccountId
  ) => Effect.Effect<Account, EntityNotFoundError | PersistenceError>

  /**
   * Find all active accounts belonging to a company within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param companyId - The company ID to filter by
   * @returns Effect containing array of active accounts
   */
  readonly findActiveByCompany: (
    organizationId: OrganizationId,
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<Account>, PersistenceError>

  /**
   * Find accounts by type within a company/organization
   *
   * @param organizationId - The organization ID for authorization
   * @param companyId - The company ID to filter by
   * @param accountType - The account type to filter by
   * @returns Effect containing array of accounts matching the type
   */
  readonly findByType: (
    organizationId: OrganizationId,
    companyId: CompanyId,
    accountType: AccountType
  ) => Effect.Effect<ReadonlyArray<Account>, PersistenceError>

  /**
   * Find child accounts of a parent account within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param parentAccountId - The parent account ID
   * @returns Effect containing array of child accounts
   */
  readonly findChildren: (
    organizationId: OrganizationId,
    parentAccountId: AccountId
  ) => Effect.Effect<ReadonlyArray<Account>, PersistenceError>

  /**
   * Find all accounts marked for intercompany transactions within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param companyId - The company ID to filter by
   * @returns Effect containing array of intercompany accounts
   */
  readonly findIntercompanyAccounts: (
    organizationId: OrganizationId,
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<Account>, PersistenceError>

  /**
   * Check if an account exists within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param id - The account ID to check
   * @returns Effect containing boolean indicating existence
   */
  readonly exists: (
    organizationId: OrganizationId,
    id: AccountId
  ) => Effect.Effect<boolean, PersistenceError>

  /**
   * Check if an account number is already used within a company/organization
   *
   * @param organizationId - The organization ID for authorization
   * @param companyId - The company ID to check within
   * @param accountNumber - The account number to check
   * @returns Effect containing boolean indicating if number is taken
   */
  readonly isAccountNumberTaken: (
    organizationId: OrganizationId,
    companyId: CompanyId,
    accountNumber: AccountNumber
  ) => Effect.Effect<boolean, PersistenceError>
}

/**
 * AccountRepository - Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * import { AccountRepository } from "@accountability/persistence/Services/AccountRepository"
 *
 * const program = Effect.gen(function* () {
 *   const repo = yield* AccountRepository
 *   const account = yield* repo.findById(accountId)
 *   // ...
 * })
 * ```
 */
export class AccountRepository extends Context.Tag("AccountRepository")<
  AccountRepository,
  AccountRepositoryService
>() {}
