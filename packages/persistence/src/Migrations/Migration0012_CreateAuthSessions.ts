/**
 * Migration0012_CreateAuthSessions
 *
 * Creates the auth_sessions table for tracking authenticated user sessions.
 * Sessions are created upon successful authentication and invalidated
 * on logout or expiration. The session ID is a secure random token.
 *
 * @module Migration0012_CreateAuthSessions
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to create the auth_sessions table
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Create auth_sessions table
  // Note: id is VARCHAR (not UUID) because session IDs are secure random tokens
  yield* sql`
    CREATE TABLE auth_sessions (
      id VARCHAR(255) PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      provider auth_provider_type NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      user_agent VARCHAR(1024) NULL,
      ip_address VARCHAR(45) NULL
    )
  `

  // Create index on user_id for finding all sessions for a user
  yield* sql`
    CREATE INDEX idx_auth_sessions_user_id ON auth_sessions (user_id)
  `

  // Create index on expires_at for efficient expired session cleanup
  yield* sql`
    CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions (expires_at)
  `

  // Create index on provider for provider-specific session queries
  yield* sql`
    CREATE INDEX idx_auth_sessions_provider ON auth_sessions (provider)
  `

  // Create composite index for finding active sessions by user
  // Note: Cannot use partial index with NOW() as it's not immutable
  // The query planner will use this composite index for filtering by user_id and expires_at
  yield* sql`
    CREATE INDEX idx_auth_sessions_user_active
      ON auth_sessions (user_id, expires_at)
  `
})
