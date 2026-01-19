/**
 * PolicyId - Re-export from canonical location
 *
 * This file provides backward compatibility during the core package reorganization.
 * The canonical location for this module is now: authorization/PolicyId.ts
 *
 * @module Auth/PolicyId
 * @deprecated Import from "@accountability/core/authorization/PolicyId" instead
 */

export {
  PolicyId,
  type PolicyId as PolicyIdType,
  isPolicyId
} from "../authorization/PolicyId.ts"
