/**
 * Migration0017_CreateAuthorization
 *
 * Creates authorization tables for multi-organization membership, invitations,
 * custom policies (ABAC), and authorization audit logging.
 *
 * Tables created:
 * - user_organization_members: User-to-organization membership with roles
 * - organization_invitations: Pending/accepted/revoked invitations
 * - organization_policies: Custom ABAC policies
 * - authorization_audit_log: Denied access attempt logging
 *
 * Also adds is_platform_admin column to auth_users.
 *
 * @module Migration0017_CreateAuthorization
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to create authorization tables
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Create enum for base roles in organization membership
  yield* sql`
    CREATE TYPE base_role AS ENUM (
      'owner',
      'admin',
      'member',
      'viewer'
    )
  `

  // Create enum for membership status
  yield* sql`
    CREATE TYPE membership_status AS ENUM (
      'active',
      'suspended',
      'removed'
    )
  `

  // Create enum for invitation status
  yield* sql`
    CREATE TYPE invitation_status AS ENUM (
      'pending',
      'accepted',
      'revoked'
    )
  `

  // Create enum for policy effect
  yield* sql`
    CREATE TYPE policy_effect AS ENUM (
      'allow',
      'deny'
    )
  `

  // Add is_platform_admin column to auth_users
  yield* sql`
    ALTER TABLE auth_users
    ADD COLUMN is_platform_admin BOOLEAN NOT NULL DEFAULT false
  `

  // Create user_organization_members table
  yield* sql`
    CREATE TABLE user_organization_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

      -- Base role determines default permission set
      role base_role NOT NULL,

      -- Functional roles (can have multiple)
      is_controller BOOLEAN NOT NULL DEFAULT false,
      is_finance_manager BOOLEAN NOT NULL DEFAULT false,
      is_accountant BOOLEAN NOT NULL DEFAULT false,
      is_period_admin BOOLEAN NOT NULL DEFAULT false,
      is_consolidation_manager BOOLEAN NOT NULL DEFAULT false,

      -- Membership status with soft delete support
      status membership_status NOT NULL DEFAULT 'active',
      removed_at TIMESTAMPTZ,
      removed_by UUID REFERENCES auth_users(id),
      removal_reason TEXT,

      -- Reinstatement tracking
      reinstated_at TIMESTAMPTZ,
      reinstated_by UUID REFERENCES auth_users(id),

      -- Audit fields
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      invited_by UUID REFERENCES auth_users(id),

      UNIQUE(user_id, organization_id)
    )
  `

  // Create indexes for user_organization_members
  yield* sql`
    CREATE INDEX idx_user_org_members_user
      ON user_organization_members(user_id)
      WHERE status = 'active'
  `

  yield* sql`
    CREATE INDEX idx_user_org_members_org
      ON user_organization_members(organization_id)
      WHERE status = 'active'
  `

  yield* sql`
    CREATE INDEX idx_user_org_members_role
      ON user_organization_members(role)
  `

  // Add trigger for updated_at
  yield* sql`
    CREATE TRIGGER update_user_org_members_updated_at
      BEFORE UPDATE ON user_organization_members
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
  `

  // Create organization_invitations table
  yield* sql`
    CREATE TABLE organization_invitations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

      -- Invitation details
      email TEXT NOT NULL,
      role base_role NOT NULL,

      -- Functional roles to assign on acceptance (stored as JSONB array)
      functional_roles JSONB NOT NULL DEFAULT '[]',

      -- Token for accepting invitation (hashed for security)
      token_hash TEXT NOT NULL UNIQUE,

      -- Status tracking (no expiration - invites last until revoked)
      status invitation_status NOT NULL DEFAULT 'pending',
      accepted_at TIMESTAMPTZ,
      accepted_by UUID REFERENCES auth_users(id),
      revoked_at TIMESTAMPTZ,
      revoked_by UUID REFERENCES auth_users(id),

      -- Audit
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      invited_by UUID NOT NULL REFERENCES auth_users(id)
    )
  `

  // Create partial unique index for pending invitations per org per email
  yield* sql`
    CREATE UNIQUE INDEX idx_org_invitations_pending_unique
      ON organization_invitations(organization_id, LOWER(email))
      WHERE status = 'pending'
  `

  // Create index for token lookup
  yield* sql`
    CREATE INDEX idx_org_invitations_token
      ON organization_invitations(token_hash)
      WHERE status = 'pending'
  `

  // Create index for email lookup
  yield* sql`
    CREATE INDEX idx_org_invitations_email
      ON organization_invitations(LOWER(email))
      WHERE status = 'pending'
  `

  // Create index for organization lookup
  yield* sql`
    CREATE INDEX idx_org_invitations_org
      ON organization_invitations(organization_id)
  `

  // Create organization_policies table for ABAC
  yield* sql`
    CREATE TABLE organization_policies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

      -- Policy definition
      name TEXT NOT NULL,
      description TEXT,

      -- Conditions (JSONB for flexibility)
      subject_condition JSONB NOT NULL,
      resource_condition JSONB NOT NULL,
      action_condition JSONB NOT NULL,
      environment_condition JSONB,

      -- Effect and priority
      effect policy_effect NOT NULL,
      priority INTEGER NOT NULL DEFAULT 500,

      -- System policies cannot be modified/deleted
      is_system_policy BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN NOT NULL DEFAULT true,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by UUID REFERENCES auth_users(id),

      UNIQUE(organization_id, name)
    )
  `

  // Create index for active policies lookup
  yield* sql`
    CREATE INDEX idx_org_policies_active
      ON organization_policies(organization_id)
      WHERE is_active = true
  `

  // Create index for priority-based ordering
  yield* sql`
    CREATE INDEX idx_org_policies_priority
      ON organization_policies(organization_id, priority DESC)
      WHERE is_active = true
  `

  // Add trigger for updated_at
  yield* sql`
    CREATE TRIGGER update_org_policies_updated_at
      BEFORE UPDATE ON organization_policies
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
  `

  // Create authorization_audit_log table for denied access attempts
  yield* sql`
    CREATE TABLE authorization_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      -- Who was denied
      user_id UUID NOT NULL REFERENCES auth_users(id),
      organization_id UUID NOT NULL REFERENCES organizations(id),

      -- What was attempted
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id UUID,

      -- Why it was denied
      denial_reason TEXT NOT NULL,
      matched_policy_ids UUID[],

      -- Request context
      ip_address TEXT,
      user_agent TEXT,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // Create indexes for authorization_audit_log
  yield* sql`
    CREATE INDEX idx_auth_audit_user
      ON authorization_audit_log(user_id)
  `

  yield* sql`
    CREATE INDEX idx_auth_audit_org
      ON authorization_audit_log(organization_id)
  `

  yield* sql`
    CREATE INDEX idx_auth_audit_time
      ON authorization_audit_log(created_at DESC)
  `

  yield* sql`
    CREATE INDEX idx_auth_audit_action
      ON authorization_audit_log(action)
  `

  yield* sql`
    CREATE INDEX idx_auth_audit_org_time
      ON authorization_audit_log(organization_id, created_at DESC)
  `
})
