/**
 * Timestamp - Re-export from canonical location
 *
 * This file provides the new import path for Timestamp while maintaining
 * backward compatibility during the core package reorganization.
 *
 * @module shared/values/Timestamp
 */

export {
  Timestamp,
  isTimestamp,
  fromDateTime,
  fromDate,
  fromString,
  now,
  nowEffect,
  Order_ as Order,
  isBefore,
  isAfter,
  equals,
  addMillis,
  addSeconds,
  addMinutes,
  addHours,
  addDays,
  diffInMillis,
  diffInSeconds,
  min,
  max,
  EPOCH
} from "../../Domains/Timestamp.ts"
