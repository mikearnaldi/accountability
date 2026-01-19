/**
 * Action - Re-export from canonical location
 *
 * This file provides the new import path for Action and ResourceType value objects
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module authorization/Action
 */

export {
  Action,
  type Action as ActionType,
  isAction,
  ActionValues,
  ResourceType,
  type ResourceType as ResourceTypeType,
  isResourceType
} from "../Auth/Action.ts"
