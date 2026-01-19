/**
 * FunctionalRole - Re-export from canonical location
 *
 * This file provides the new import path for FunctionalRole value object
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module authorization/FunctionalRole
 */

export {
  FunctionalRole,
  type FunctionalRole as FunctionalRoleType,
  isFunctionalRole,
  FunctionalRoleValues,
  FunctionalRoles,
  type FunctionalRoles as FunctionalRolesType
} from "../Auth/FunctionalRole.ts"
