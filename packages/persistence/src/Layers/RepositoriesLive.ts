/**
 * RepositoriesLive - Combined layer providing all real repository implementations
 *
 * This module provides a single layer that combines all repository implementations
 * for use in production and testing with real database connections.
 *
 * Dependencies:
 * - PgClient.PgClient (SqlClient.SqlClient) - Must be provided by the caller
 *
 * @module RepositoriesLive
 */

import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { AuthProvider } from "@accountability/core/authentication/AuthProvider"
import {
  SessionTokenGeneratorLive,
  SessionTokenConfigTag,
  CryptoRandomAdapterTag
} from "@accountability/core/authentication/SessionTokenGenerator"
import {
  BcryptPasswordHasherLive,
  PasswordHasherConfigTag,
  BcryptAdapterTag
} from "@accountability/core/authentication/PasswordHasher"
import { AccountRepositoryLive } from "./AccountRepositoryLive.ts"
import { CompanyRepositoryLive } from "./CompanyRepositoryLive.ts"
import { OrganizationRepositoryLive } from "./OrganizationRepositoryLive.ts"
import { JournalEntryRepositoryLive } from "./JournalEntryRepositoryLive.ts"
import { JournalEntryLineRepositoryLive } from "./JournalEntryLineRepositoryLive.ts"
import { ExchangeRateRepositoryLive } from "./ExchangeRateRepositoryLive.ts"
import { ConsolidationRepositoryLive } from "./ConsolidationRepositoryLive.ts"
import { IntercompanyTransactionRepositoryLive } from "./IntercompanyTransactionRepositoryLive.ts"
import { EliminationRuleRepositoryLive } from "./EliminationRuleRepositoryLive.ts"
import { AuditLogRepositoryLive } from "./AuditLogRepositoryLive.ts"
import { AuthorizationAuditRepositoryLive } from "./AuthorizationAuditRepositoryLive.ts"
import { UserRepositoryLive } from "./UserRepositoryLive.ts"
import { IdentityRepositoryLive } from "./IdentityRepositoryLive.ts"
import { SessionRepositoryLive } from "./SessionRepositoryLive.ts"
import { OrganizationMemberRepositoryLive } from "./OrganizationMemberRepositoryLive.ts"
import { InvitationRepositoryLive } from "./InvitationRepositoryLive.ts"
import { PolicyRepositoryLive } from "./PolicyRepositoryLive.ts"
import { AuthServiceLive } from "./AuthServiceLive.ts"
import { OrganizationMemberServiceLive } from "./OrganizationMemberServiceLive.ts"
import { InvitationServiceLive } from "./InvitationServiceLive.ts"
import { FiscalPeriodRepositoryLive } from "./FiscalPeriodRepositoryLive.ts"
import { FiscalPeriodServiceLive } from "./FiscalPeriodServiceLive.ts"
import { AuditLogServiceLive } from "./AuditLogServiceLive.ts"
import { LocalAuthProviderLive } from "./LocalAuthProviderLive.ts"
import { LocalAuthProvider } from "../Services/LocalAuthProvider.ts"
import { AuthServiceConfig, SessionDurationConfig } from "../Services/AuthServiceConfig.ts"

/**
 * RepositoriesLive - Combined layer providing all repository implementations
 *
 * This layer provides implementations for:
 * - AccountRepository
 * - CompanyRepository
 * - OrganizationRepository
 * - JournalEntryRepository
 * - JournalEntryLineRepository
 * - ExchangeRateRepository
 * - ConsolidationRepository
 * - IntercompanyTransactionRepository
 * - EliminationRuleRepository
 * - AuditLogRepository
 * - AuthorizationAuditRepository
 * - UserRepository
 * - IdentityRepository
 * - SessionRepository
 *
 * All implementations use PostgreSQL via @effect/sql-pg.
 *
 * Usage:
 * ```typescript
 * import { RepositoriesLive } from "@accountability/persistence/Layers/RepositoriesLive"
 * import { PgClientLive } from "@accountability/persistence/Layers/PgClientLive"
 *
 * const FullLayer = RepositoriesLive.pipe(
 *   Layer.provide(PgClientLive)
 * )
 * ```
 *
 * For testing with shared testcontainers:
 * ```typescript
 * import { RepositoriesLive } from "@accountability/persistence/Layers/RepositoriesLive"
 * import { SharedPgClientLive } from "./test/Utils.ts"
 *
 * const TestLayer = RepositoriesLive.pipe(
 *   Layer.provide(SharedPgClientLive)
 * )
 * ```
 */
export const RepositoriesLive = Layer.mergeAll(
  AccountRepositoryLive,
  CompanyRepositoryLive,
  OrganizationRepositoryLive,
  JournalEntryRepositoryLive,
  JournalEntryLineRepositoryLive,
  ExchangeRateRepositoryLive,
  ConsolidationRepositoryLive,
  IntercompanyTransactionRepositoryLive,
  EliminationRuleRepositoryLive,
  AuditLogRepositoryLive,
  AuthorizationAuditRepositoryLive,
  UserRepositoryLive,
  IdentityRepositoryLive,
  SessionRepositoryLive,
  OrganizationMemberRepositoryLive,
  InvitationRepositoryLive,
  PolicyRepositoryLive,
  FiscalPeriodRepositoryLive
)

// =============================================================================
// Crypto Adapters for Authentication Services
// =============================================================================

/**
 * WebCryptoAdapter - Provides random bytes using the Web Crypto API
 *
 * Works in both Node.js and browsers since crypto.getRandomValues
 * is available in both environments.
 */
const WebCryptoAdapter = Layer.succeed(CryptoRandomAdapterTag, {
  getRandomBytes: (length: number) =>
    Effect.sync(() => {
      const bytes = new Uint8Array(length)
      crypto.getRandomValues(bytes)
      return bytes
    })
})

/**
 * SimpleBcryptAdapter - Bcrypt adapter using the native Web Crypto API
 *
 * This is a simplified password hashing implementation using PBKDF2.
 * For production use, consider using the bcryptjs package instead.
 *
 * Note: This implementation uses PBKDF2 which is acceptable but bcrypt
 * or argon2 are preferred for password hashing.
 */
const SimpleBcryptAdapter = Layer.succeed(BcryptAdapterTag, {
  hash: (password: string, rounds: number): Effect.Effect<string> =>
    Effect.promise(async () => {
      const encoder = new TextEncoder()
      const data = encoder.encode(password)
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        data,
        "PBKDF2",
        false,
        ["deriveBits"]
      )
      const iterations = Math.pow(2, rounds)
      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          salt,
          iterations,
          hash: "SHA-256"
        },
        keyMaterial,
        256
      )
      const hashArray = new Uint8Array(derivedBits)
      const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("")
      const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, "0")).join("")
      return `pbkdf2$${rounds}$${saltHex}$${hashHex}`
    }),
  compare: (password: string, hash: string): Effect.Effect<boolean> =>
    Effect.promise(async () => {
      const parts = hash.split("$")
      if (parts.length !== 4 || parts[0] !== "pbkdf2") {
        return false
      }
      const rounds = parseInt(parts[1], 10)
      const saltHex = parts[2]
      const storedHashHex = parts[3]

      const salt = new Uint8Array(
        saltHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) ?? []
      )
      const encoder = new TextEncoder()
      const data = encoder.encode(password)
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        data,
        "PBKDF2",
        false,
        ["deriveBits"]
      )
      const iterations = Math.pow(2, rounds)
      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          salt,
          iterations,
          hash: "SHA-256"
        },
        keyMaterial,
        256
      )
      const hashArray = new Uint8Array(derivedBits)
      const computedHashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, "0")).join("")

      return computedHashHex === storedHashHex
    })
})

// =============================================================================
// Auth Service Dependencies
// =============================================================================

/**
 * SessionTokenGeneratorWithCrypto - SessionTokenGenerator with Web Crypto
 */
const SessionTokenGeneratorWithCrypto = SessionTokenGeneratorLive.pipe(
  Layer.provide(WebCryptoAdapter),
  Layer.provide(SessionTokenConfigTag.Default)
)

/**
 * PasswordHasherWithCrypto - PasswordHasher with PBKDF2 implementation
 */
const PasswordHasherWithCrypto = BcryptPasswordHasherLive.pipe(
  Layer.provide(SimpleBcryptAdapter),
  Layer.provide(PasswordHasherConfigTag.Fast) // Use fast for development
)

/**
 * LocalAuthProviderWithDeps - LocalAuthProvider with repositories and hasher
 */
const LocalAuthProviderWithDeps = LocalAuthProviderLive.pipe(
  Layer.provide(PasswordHasherWithCrypto),
  Layer.provide(UserRepositoryLive),
  Layer.provide(IdentityRepositoryLive)
)

/**
 * AuthServiceConfigDefault - Default configuration with local provider
 *
 * Creates the AuthServiceConfig with the local authentication provider.
 */
const AuthServiceConfigDefault = Layer.effect(
  AuthServiceConfig,
  Effect.gen(function* () {
    const localProvider = yield* LocalAuthProvider
    const providers: Chunk.Chunk<AuthProvider> = Chunk.of(localProvider)
    return {
      providers,
      sessionDurations: SessionDurationConfig.Default,
      autoProvisionUsers: true,
      linkIdentitiesByEmail: true
    }
  })
).pipe(Layer.provide(LocalAuthProviderWithDeps))

/**
 * AuthServiceWithDeps - AuthServiceLive with all dependencies
 */
const AuthServiceWithDeps = AuthServiceLive.pipe(
  Layer.provide(AuthServiceConfigDefault),
  Layer.provide(SessionTokenGeneratorWithCrypto),
  Layer.provide(PasswordHasherWithCrypto),
  Layer.provide(UserRepositoryLive),
  Layer.provide(IdentityRepositoryLive),
  Layer.provide(SessionRepositoryLive)
)

// =============================================================================
// Combined Layers
// =============================================================================

/**
 * OrganizationMemberServiceWithDeps - OrganizationMemberService with repository
 */
const OrganizationMemberServiceWithDeps = OrganizationMemberServiceLive.pipe(
  Layer.provide(OrganizationMemberRepositoryLive)
)

/**
 * InvitationServiceWithDeps - InvitationService with repositories
 */
const InvitationServiceWithDeps = InvitationServiceLive.pipe(
  Layer.provide(InvitationRepositoryLive),
  Layer.provide(OrganizationMemberRepositoryLive)
)

/**
 * AuditLogServiceWithDeps - AuditLogService with repository and user lookup
 */
const AuditLogServiceWithDeps = AuditLogServiceLive.pipe(
  Layer.provide(AuditLogRepositoryLive),
  Layer.provide(UserRepositoryLive)
)

/**
 * FiscalPeriodServiceWithDeps - FiscalPeriodService with repository and audit logging
 */
const FiscalPeriodServiceWithDeps = FiscalPeriodServiceLive.pipe(
  Layer.provide(FiscalPeriodRepositoryLive),
  Layer.provide(AuditLogServiceWithDeps)
)

/**
 * RepositoriesWithAuthLive - Repositories plus AuthService
 *
 * Includes all repository implementations plus the AuthService.
 * This is the layer to use when the application needs authentication.
 *
 * Provides:
 * - All repositories
 * - AuthService
 * - PasswordHasher (for password verification/hashing in API handlers)
 * - OrganizationMemberService
 * - InvitationService
 * - FiscalPeriodService
 * - AuditLogService
 */
export const RepositoriesWithAuthLive = Layer.mergeAll(
  RepositoriesLive,
  AuthServiceWithDeps,
  PasswordHasherWithCrypto,
  OrganizationMemberServiceWithDeps,
  InvitationServiceWithDeps,
  FiscalPeriodServiceWithDeps,
  AuditLogServiceWithDeps
)
