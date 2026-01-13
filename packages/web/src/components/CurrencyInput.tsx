/**
 * CurrencyInput - Currency input component with proper formatting
 *
 * A fully-featured currency input component that provides:
 * - Currency symbol display (prefix or suffix based on locale)
 * - Proper decimal formatting (2-4 places based on currency)
 * - Thousand separators
 * - Negative number support with proper display
 * - Optional currency code selector dropdown
 * - Controlled component returning BigDecimal-compatible string
 * - Currency list loaded via useAtomValue(currenciesAtom)
 * - Currency metadata (symbol, decimal places) from currencyAtom(code)
 *
 * @module CurrencyInput
 */

import * as React from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import { Currency } from "@accountability/core/Domains/Currency"
import type { CurrencyCode } from "@accountability/core/Domains/CurrencyCode"
import { currenciesAtom, currencyAtom } from "../atoms/currencies.ts"
import {
  parseFormattedValue,
  formatNumericValue,
  validateDecimalPlaces,
  toBigDecimalString,
  DEFAULT_LOCALE,
  LOCALES
} from "./CurrencyInputUtils.ts"

// =============================================================================
// Types
// =============================================================================

export interface CurrencyInputProps {
  /**
   * The current value as a BigDecimal-compatible string (e.g., "1234.56")
   */
  readonly value: string

  /**
   * Callback when the value changes
   * Returns a BigDecimal-compatible string or empty string
   */
  readonly onChange: (value: string) => void

  /**
   * The currency code for formatting
   */
  readonly currencyCode: CurrencyCode

  /**
   * Callback when currency code changes (if showCurrencySelector is true)
   */
  readonly onCurrencyChange?: (code: CurrencyCode) => void

  /**
   * Whether to show the currency selector dropdown
   */
  readonly showCurrencySelector?: boolean

  /**
   * Whether negative values are allowed
   */
  readonly allowNegative?: boolean

  /**
   * Locale for formatting (defaults to "en-US")
   */
  readonly locale?: string

  /**
   * Placeholder text when empty
   */
  readonly placeholder?: string

  /**
   * Whether the input is disabled
   */
  readonly disabled?: boolean

  /**
   * Whether the input is read-only
   */
  readonly readOnly?: boolean

  /**
   * Optional CSS class name
   */
  readonly className?: string

  /**
   * Accessible label for the input
   */
  readonly "aria-label"?: string

  /**
   * ID of the element that labels this input
   */
  readonly "aria-labelledby"?: string

  /**
   * Optional ID for the component
   */
  readonly id?: string

  /**
   * Whether the value is invalid
   */
  readonly "aria-invalid"?: boolean

  /**
   * ID of the element that describes this input
   */
  readonly "aria-describedby"?: string

  /**
   * Optional data-testid for testing
   */
  readonly "data-testid"?: string
}

// =============================================================================
// Sub-components
// =============================================================================

interface CurrencySelectorProps {
  readonly value: CurrencyCode
  readonly onChange: (code: CurrencyCode) => void
  readonly disabled?: boolean
  readonly currencies: ReadonlyArray<Currency>
  readonly id?: string
}

function CurrencySelector({
  value,
  onChange,
  disabled,
  currencies,
  id
}: CurrencySelectorProps): React.ReactElement {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    // The value comes from our own select options which are CurrencyCode values
    // We use identity to verify the type without an unsafe cast
    const selectedCode = event.target.value
    // Find the currency to validate the code exists
    const currency = currencies.find((c) => c.code === selectedCode)
    if (currency) {
      onChange(currency.code)
    }
  }

  const selectStyle: React.CSSProperties = {
    padding: "8px 12px",
    border: "1px solid #ccc",
    borderRadius: "4px 0 0 4px",
    borderRight: "none",
    backgroundColor: disabled ? "#f5f5f5" : "#fff",
    fontSize: "14px",
    cursor: disabled ? "not-allowed" : "pointer",
    outline: "none",
    minWidth: "80px"
  }

  return (
    <select
      id={id}
      value={value}
      onChange={handleChange}
      disabled={disabled}
      style={selectStyle}
      aria-label="Select currency"
    >
      {currencies.map((currency) => (
        <option key={currency.code} value={currency.code}>
          {currency.code} ({currency.symbol})
        </option>
      ))}
    </select>
  )
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * CurrencyInput Component
 *
 * A controlled currency input with proper formatting and decimal handling.
 */
export function CurrencyInput({
  value,
  onChange,
  currencyCode,
  onCurrencyChange,
  showCurrencySelector = false,
  allowNegative = true,
  locale: localeName = "en-US",
  placeholder = "0.00",
  disabled = false,
  readOnly = false,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "data-testid": dataTestId
}: CurrencyInputProps): React.ReactElement {
  // Generate unique IDs
  const componentId = id ?? React.useId()
  const inputId = `${componentId}-input`
  const selectorId = `${componentId}-selector`

  // Get locale configuration
  const localeConfig = LOCALES[localeName] ?? DEFAULT_LOCALE

  // Get currency data from atoms
  const currencies = useAtomValue(currenciesAtom)
  const currency = useAtomValue(currencyAtom(currencyCode))

  // Default currency if not found - use Currency.make to get proper class instance
  const effectiveCurrency: Currency = currency ?? Currency.make({
    code: currencyCode,
    name: currencyCode,
    symbol: currencyCode,
    decimalPlaces: 2,
    isActive: true
  })

  // Local state for display value (formatted)
  const [displayValue, setDisplayValue] = React.useState(() =>
    formatNumericValue(value, effectiveCurrency.decimalPlaces, localeConfig)
  )
  const [isFocused, setIsFocused] = React.useState(false)

  // Input ref
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Update display value when external value changes (not during focus)
  React.useEffect(() => {
    if (!isFocused) {
      setDisplayValue(
        formatNumericValue(value, effectiveCurrency.decimalPlaces, localeConfig)
      )
    }
  }, [value, effectiveCurrency.decimalPlaces, localeConfig, isFocused])

  // Handle input change
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value

    // Parse to raw value
    let rawValue = parseFormattedValue(inputValue, localeConfig)

    // Remove negative sign if not allowed
    if (!allowNegative && rawValue.startsWith("-")) {
      rawValue = rawValue.substring(1)
    }

    // Validate decimal places
    rawValue = validateDecimalPlaces(rawValue, effectiveCurrency.decimalPlaces)

    // Update display value with minimal formatting (just during typing)
    setDisplayValue(inputValue)

    // Notify parent with BigDecimal-compatible string
    const bigDecimalValue = toBigDecimalString(rawValue, localeConfig)
    onChange(bigDecimalValue)
  }

  // Handle focus
  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    // Select all text on focus for easy replacement
    event.target.select()
  }

  // Handle blur - format the value properly
  const handleBlur = () => {
    setIsFocused(false)

    // Parse and reformat the current display value
    const rawValue = parseFormattedValue(displayValue, localeConfig)
    const bigDecimalValue = toBigDecimalString(rawValue, localeConfig)

    if (bigDecimalValue === "") {
      setDisplayValue("")
      onChange("")
    } else {
      const formatted = formatNumericValue(
        bigDecimalValue,
        effectiveCurrency.decimalPlaces,
        localeConfig
      )
      setDisplayValue(formatted)
      onChange(bigDecimalValue)
    }
  }

  // Handle key down - prevent invalid characters
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow control keys
    if (
      event.key === "Backspace" ||
      event.key === "Delete" ||
      event.key === "Tab" ||
      event.key === "Escape" ||
      event.key === "Enter" ||
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight" ||
      event.key === "Home" ||
      event.key === "End" ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return
    }

    // Allow digits
    if (/\d/.test(event.key)) {
      return
    }

    // Allow decimal separator
    if (event.key === localeConfig.decimalSeparator || event.key === ".") {
      // Only allow one decimal separator
      if (displayValue.includes(localeConfig.decimalSeparator) || displayValue.includes(".")) {
        event.preventDefault()
      }
      return
    }

    // Allow minus sign at start (if negative allowed)
    if (allowNegative && event.key === "-") {
      const input = event.currentTarget
      if (input.selectionStart === 0 && !displayValue.includes("-")) {
        return
      }
      event.preventDefault()
      return
    }

    // Prevent all other characters
    event.preventDefault()
  }

  // Handle currency selector change
  const handleCurrencyChange = (code: CurrencyCode) => {
    if (onCurrencyChange) {
      onCurrencyChange(code)
    }
  }

  // Styles
  const containerStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "stretch",
    width: "100%"
  }

  const inputContainerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    flex: 1,
    border: "1px solid #ccc",
    borderRadius: showCurrencySelector ? "0 4px 4px 0" : "4px",
    backgroundColor: disabled ? "#f5f5f5" : "#fff",
    overflow: "hidden"
  }

  const symbolStyle: React.CSSProperties = {
    padding: localeConfig.symbolPosition === "prefix" ? "0 0 0 12px" : "0 12px 0 0",
    color: "#666",
    fontWeight: 500,
    fontSize: "14px",
    userSelect: "none"
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: "8px 12px",
    border: "none",
    outline: "none",
    fontSize: "14px",
    textAlign: "right",
    backgroundColor: "transparent",
    cursor: disabled ? "not-allowed" : "text",
    minWidth: 0
  }

  return (
    <div className={className} style={containerStyle} id={componentId} data-testid={dataTestId}>
      {/* Currency Selector */}
      {showCurrencySelector && onCurrencyChange && (
        <CurrencySelector
          id={selectorId}
          value={currencyCode}
          onChange={handleCurrencyChange}
          disabled={disabled}
          currencies={currencies}
        />
      )}

      {/* Input Container */}
      <div style={inputContainerStyle}>
        {/* Prefix Symbol */}
        {localeConfig.symbolPosition === "prefix" && (
          <span style={symbolStyle} aria-hidden="true">
            {effectiveCurrency.symbol}
          </span>
        )}

        {/* Input Field */}
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          autoComplete="off"
          style={inputStyle}
        />

        {/* Suffix Symbol */}
        {localeConfig.symbolPosition === "suffix" && (
          <span style={symbolStyle} aria-hidden="true">
            {effectiveCurrency.symbol}
          </span>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Exports
// =============================================================================

export type { LocaleConfig } from "./CurrencyInputUtils.ts"
export {
  parseFormattedValue,
  formatNumericValue,
  formatWithSymbol,
  toBigDecimalString,
  LOCALES,
  DEFAULT_LOCALE
} from "./CurrencyInputUtils.ts"
