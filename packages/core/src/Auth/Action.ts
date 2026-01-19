/**
 * Action - Re-export from canonical location
 *
 * This file provides backward compatibility during the core package reorganization.
 * The canonical location for this module is now: authorization/Action.ts
 *
 * @module Auth/Action
 * @deprecated Import from "@accountability/core/authorization/Action" instead
 */

export {
  Action,
  type Action as ActionType,
  isAction,
  ActionValues,
  ResourceType,
  type ResourceType as ResourceTypeType,
  isResourceType
} from "../authorization/Action.ts"
