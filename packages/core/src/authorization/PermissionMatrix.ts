/**
 * PermissionMatrix - Re-export from canonical location
 *
 * This file provides the new import path for PermissionMatrix utilities
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module authorization/PermissionMatrix
 */

export {
  getBaseRolePermissions,
  getFunctionalRolePermissions,
  computeEffectivePermissions,
  hasPermission,
  getResourceType,
  permissionSetToArray
} from "../Auth/PermissionMatrix.ts"
