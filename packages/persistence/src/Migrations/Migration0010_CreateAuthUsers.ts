/**
 * Migration0010_CreateAuthUsers
 *
 * Creates the auth_users table for storing authenticated user accounts.
 * This is the core user table that supports multiple auth providers through
 * the related auth_identities table.
 *
 * @module Migration0010_CreateAuthUsers
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to create the auth_users table
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Create enum for user role
  yield* sql`
    CREATE TYPE user_role AS ENUM (
      'admin',
      'owner',
      'member',
      'viewer'
    )
  `

  // Create enum for auth provider type
  yield* sql`
    CREATE TYPE auth_provider_type AS ENUM (
      'local',
      'workos',
      'google',
      'github',
      'saml'
    )
  `

  // Create auth_users table
  yield* sql`
    CREATE TABLE auth_users (
      id UUID PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      role user_role NOT NULL DEFAULT 'member',
      primary_provider auth_provider_type NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      -- Email must be unique (case-insensitive handled by index)
      CONSTRAINT auth_users_email_unique UNIQUE (email)
    )
  `

  // Create index on email for fast lookups (case-insensitive)
  yield* sql`
    CREATE INDEX idx_auth_users_email ON auth_users (LOWER(email))
  `

  // Create index on role for filtering by role
  yield* sql`
    CREATE INDEX idx_auth_users_role ON auth_users (role)
  `

  // Create index on primary_provider for provider-based queries
  yield* sql`
    CREATE INDEX idx_auth_users_primary_provider ON auth_users (primary_provider)
  `

  // Add trigger for updated_at
  yield* sql`
    CREATE TRIGGER update_auth_users_updated_at
      BEFORE UPDATE ON auth_users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
  `
})
