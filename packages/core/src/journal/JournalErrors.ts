/**
 * JournalErrors - Re-export from canonical location
 *
 * This file provides the new import path for Journal-related errors
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module journal/JournalErrors
 */

export {
  JournalEntryNotFoundError,
  isJournalEntryNotFoundError,
  UnbalancedJournalEntryError,
  isUnbalancedJournalEntryError,
  JournalEntryStatusError,
  isJournalEntryStatusError,
  JournalEntryAlreadyReversedError,
  isJournalEntryAlreadyReversedError
} from "../Errors/DomainErrors.ts"
