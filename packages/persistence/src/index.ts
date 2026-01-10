/**
 * @accountability/persistence
 *
 * Repository interfaces for all core entities using the Effect Context.Tag pattern.
 * All operations return Effect with typed errors for proper error handling.
 *
 * @module persistence
 */

// Repository Error Types
export {
  EntityNotFoundError,
  isEntityNotFoundError,
  DuplicateEntityError,
  isDuplicateEntityError,
  PersistenceError,
  isPersistenceError,
  ValidationError,
  isValidationError,
  ConcurrencyError,
  isConcurrencyError,
  type RepositoryError
} from "./RepositoryError.js"

// Company Repository
export {
  CompanyRepository,
  type CompanyRepositoryService
} from "./CompanyRepository.js"

// Account Repository
export {
  AccountRepository,
  type AccountRepositoryService
} from "./AccountRepository.js"

// Journal Entry Repository
export {
  JournalEntryRepository,
  type JournalEntryRepositoryService
} from "./JournalEntryRepository.js"

// Exchange Rate Repository
export {
  ExchangeRateRepository,
  type ExchangeRateRepositoryService
} from "./ExchangeRateRepository.js"

// Fiscal Period Repository
export {
  FiscalPeriodRepository,
  type FiscalPeriodRepositoryService
} from "./FiscalPeriodRepository.js"

// Consolidation Repository
export {
  ConsolidationRepository,
  type ConsolidationRepositoryService
} from "./ConsolidationRepository.js"
