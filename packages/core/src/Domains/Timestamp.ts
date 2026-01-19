/**
 * Timestamp - Re-export for backward compatibility
 *
 * This file re-exports from the new canonical location in shared/values.
 * Use '@accountability/core/shared/values/Timestamp' for new imports.
 *
 * @deprecated Import from '@accountability/core/shared/values/Timestamp' instead
 * @module Domains/Timestamp
 */

export {
  Timestamp,
  isTimestamp,
  fromDateTime,
  fromDate,
  fromString,
  now,
  nowEffect,
  Order_,
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
} from "../shared/values/Timestamp.ts"
