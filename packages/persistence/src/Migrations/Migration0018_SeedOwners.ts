/**
 * Migration0018_SeedOwners
 *
 * Seeds existing organization creators as owners in user_organization_members.
 * This migration handles organizations created before the authorization system
 * was implemented.
 *
 * Strategy:
 * 1. Skip organizations that already have members (created after auth feature)
 * 2. Look up audit_log for Organization Create events to find the creator
 * 3. Insert the creator as owner with all functional roles
 *
 * @module Migration0018_SeedOwners
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to seed organization owners from audit log
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Insert owners for organizations without members using audit_log
  // This uses a CTE to:
  // 1. Find organizations without any members
  // 2. Join with audit_log to find the user who created each organization
  // 3. Insert them as owner with all functional roles enabled
  //
  // Note: audit_log.entity_id is VARCHAR, so we cast to UUID when joining
  yield* sql`
    WITH orgs_without_members AS (
      SELECT o.id AS organization_id
      FROM organizations o
      WHERE NOT EXISTS (
        SELECT 1
        FROM user_organization_members m
        WHERE m.organization_id = o.id
      )
    ),
    org_creators AS (
      SELECT DISTINCT ON (owm.organization_id)
        owm.organization_id,
        al.user_id AS creator_id
      FROM audit_log al
      JOIN orgs_without_members owm ON al.entity_id = owm.organization_id::text
      WHERE al.entity_type = 'Organization'
        AND al.action = 'Create'
        AND al.user_id IS NOT NULL
      ORDER BY owm.organization_id, al.timestamp ASC
    )
    INSERT INTO user_organization_members (
      id,
      user_id,
      organization_id,
      role,
      is_controller,
      is_finance_manager,
      is_accountant,
      is_period_admin,
      is_consolidation_manager,
      status,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      oc.creator_id,
      oc.organization_id,
      'owner'::base_role,
      true,  -- is_controller
      true,  -- is_finance_manager
      true,  -- is_accountant
      true,  -- is_period_admin
      true,  -- is_consolidation_manager
      'active'::membership_status,
      NOW(),
      NOW()
    FROM org_creators oc
    WHERE EXISTS (
      SELECT 1 FROM auth_users au WHERE au.id = oc.creator_id
    )
    ON CONFLICT (user_id, organization_id) DO NOTHING
  `

  // Also seed system policies for organizations that don't have them yet
  // This handles organizations created before the policy seeding was added
  yield* sql`
    WITH orgs_without_policies AS (
      SELECT o.id AS organization_id
      FROM organizations o
      WHERE NOT EXISTS (
        SELECT 1
        FROM organization_policies p
        WHERE p.organization_id = o.id
          AND p.is_system_policy = true
      )
    )
    INSERT INTO organization_policies (
      id,
      organization_id,
      name,
      description,
      subject_condition,
      resource_condition,
      action_condition,
      environment_condition,
      effect,
      priority,
      is_system_policy,
      is_active,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      owp.organization_id,
      p.name,
      p.description,
      p.subject_condition,
      p.resource_condition,
      p.action_condition,
      NULL,
      p.effect,
      p.priority,
      true,
      true,
      NOW(),
      NOW()
    FROM orgs_without_policies owp
    CROSS JOIN (
      VALUES
        (
          'Platform Admin Full Access',
          'System policy: Platform administrators have full access to all resources',
          '{"isPlatformAdmin": true}'::jsonb,
          '{"type": "*"}'::jsonb,
          '{"actions": ["*"]}'::jsonb,
          'allow'::policy_effect,
          1000
        ),
        (
          'Organization Owner Full Access',
          'System policy: Organization owners have full access to all organization resources',
          '{"roles": ["owner"]}'::jsonb,
          '{"type": "*"}'::jsonb,
          '{"actions": ["*"]}'::jsonb,
          'allow'::policy_effect,
          900
        ),
        (
          'Viewer Read-Only Access',
          'System policy: Viewers can only read resources and view reports',
          '{"roles": ["viewer"]}'::jsonb,
          '{"type": "*"}'::jsonb,
          '{"actions": ["organization:read", "company:read", "account:read", "journal_entry:read", "fiscal_period:read", "consolidation_group:read", "report:read", "report:export", "exchange_rate:read"]}'::jsonb,
          'allow'::policy_effect,
          100
        ),
        (
          'Locked Period Protection',
          'System policy: Prevent modifications to journal entries in locked fiscal periods',
          '{"roles": ["*"]}'::jsonb,
          '{"type": "journal_entry", "attributes": {"periodStatus": ["Locked"]}}'::jsonb,
          '{"actions": ["journal_entry:create", "journal_entry:update", "journal_entry:post", "journal_entry:reverse"]}'::jsonb,
          'deny'::policy_effect,
          999
        )
    ) AS p(name, description, subject_condition, resource_condition, action_condition, effect, priority)
    ON CONFLICT (organization_id, name) DO NOTHING
  `
})
