/**
 * LocalDate - Re-export from canonical location
 *
 * This file provides the new import path for LocalDate while maintaining
 * backward compatibility during the core package reorganization.
 *
 * @module shared/values/LocalDate
 */

export {
  LocalDate,
  isLocalDate,
  fromString,
  fromDate,
  fromDateTime,
  today,
  todayEffect,
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
} from "../../Domains/LocalDate.ts"
