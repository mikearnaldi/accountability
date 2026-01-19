/**
 * RepositoryError - Re-export from new location
 *
 * DEPRECATED: Import from shared/errors/RepositoryError.ts instead.
 *
 * @module Errors/RepositoryError
 */

export {
  EntityNotFoundError,
  isEntityNotFoundError,
  PersistenceError,
  isPersistenceError
} from "../shared/errors/RepositoryError.ts"
