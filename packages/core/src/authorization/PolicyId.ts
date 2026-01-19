/**
 * PolicyId - Re-export from canonical location
 *
 * This file provides the new import path for PolicyId value object
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module authorization/PolicyId
 */

export {
  PolicyId,
  type PolicyId as PolicyIdType,
  isPolicyId
} from "../Auth/PolicyId.ts"
