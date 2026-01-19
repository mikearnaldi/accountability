/**
 * FunctionalRole - Re-export from canonical location
 *
 * This file provides backward compatibility during the core package reorganization.
 * The canonical location for this module is now: authorization/FunctionalRole.ts
 *
 * @module Auth/FunctionalRole
 * @deprecated Import from "@accountability/core/authorization/FunctionalRole" instead
 */

export {
  FunctionalRole,
  type FunctionalRole as FunctionalRoleType,
  isFunctionalRole,
  FunctionalRoleValues,
  FunctionalRoles,
  type FunctionalRoles as FunctionalRolesType
} from "../authorization/FunctionalRole.ts"
