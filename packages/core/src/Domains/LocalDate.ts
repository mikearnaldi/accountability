/**
 * LocalDate - Re-export for backward compatibility
 *
 * This file re-exports from the new canonical location in shared/values.
 * Use '@accountability/core/shared/values/LocalDate' for new imports.
 *
 * @deprecated Import from '@accountability/core/shared/values/LocalDate' instead
 * @module Domains/LocalDate
 */

export {
  LocalDate,
  isLocalDate,
  fromString,
  fromDate,
  fromDateTime,
  today,
  todayEffect,
  Order_,
  Order_ as Order,
  isBefore,
  isAfter,
  equals,
  addDays,
  addMonths,
  addYears,
  diffInDays,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isLeapYear,
  daysInMonth,
  LocalDateFromString
} from "../shared/values/LocalDate.ts"
