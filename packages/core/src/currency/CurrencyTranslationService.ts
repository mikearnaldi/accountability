/**
 * CurrencyTranslationService - Re-export from canonical location
 *
 * This file provides backward compatibility for imports from the currency/ location.
 * The canonical source is at consolidation/CurrencyTranslationService.ts since it's
 * specifically for consolidation per ASC 830.
 *
 * @module currency/CurrencyTranslationService
 * @deprecated Import from @accountability/core/consolidation/CurrencyTranslationService instead
 */

export * from "../consolidation/CurrencyTranslationService.ts"
