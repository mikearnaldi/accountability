/**
 * Migration0011_CreateAuthIdentities
 *
 * Creates the auth_identities table for linking users to authentication providers.
 * Each user can have multiple identities (e.g., local password + Google OAuth).
 * The password_hash column is only used for 'local' provider identities.
 *
 * @module Migration0011_CreateAuthIdentities
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to create the auth_identities table
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Create auth_identities table
  yield* sql`
    CREATE TABLE auth_identities (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      provider auth_provider_type NOT NULL,
      provider_id VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NULL,
      provider_data JSONB NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      -- Each provider can only have one identity per provider_id
      CONSTRAINT auth_identities_provider_provider_id_unique UNIQUE (provider, provider_id)
    )
  `

  // Create index on user_id for finding all identities for a user
  yield* sql`
    CREATE INDEX idx_auth_identities_user_id ON auth_identities (user_id)
  `

  // Create composite index on (provider, provider_id) for identity lookups
  // This is the primary lookup path for authentication
  yield* sql`
    CREATE INDEX idx_auth_identities_provider_provider_id
      ON auth_identities (provider, provider_id)
  `

  // Create index on provider for provider-specific queries
  yield* sql`
    CREATE INDEX idx_auth_identities_provider ON auth_identities (provider)
  `
})
