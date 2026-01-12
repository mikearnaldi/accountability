/**
 * AccountSelector - Reusable account selector/picker component
 *
 * A searchable dropdown component for selecting accounts from the Chart of Accounts.
 * Features:
 * - Type-ahead search filtering
 * - Hierarchical display with indentation
 * - Optional account type filtering
 * - Full keyboard navigation (arrow keys, enter, escape)
 * - ARIA-compliant accessibility
 * - Controlled component pattern with value/onChange
 *
 * @module AccountSelector
 */

import * as React from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import type { Account, AccountId, AccountType } from "@accountability/core/Domains/Account"
import type { CompanyId } from "@accountability/core/Domains/Company"
import { ApiClient } from "../atoms/ApiClient.ts"
import * as Duration from "effect/Duration"
import { buildHierarchicalList, filterBySearch } from "./AccountSelectorUtils.ts"

// =============================================================================
// Types
// =============================================================================

export interface AccountSelectorProps {
  /**
   * The currently selected account ID (controlled)
   */
  readonly value: AccountId | null

  /**
   * Callback when an account is selected
   */
  readonly onChange: (accountId: AccountId | null) => void

  /**
   * Company ID to fetch accounts for (required)
   */
  readonly companyId: CompanyId

  /**
   * Optional filter by account type
   */
  readonly accountType?: AccountType | undefined

  /**
   * Optional filter to only show postable accounts
   */
  readonly isPostable?: boolean | undefined

  /**
   * Optional filter to only show active accounts
   */
  readonly isActive?: boolean | undefined

  /**
   * Placeholder text when no account is selected
   */
  readonly placeholder?: string

  /**
   * Whether the selector is disabled
   */
  readonly disabled?: boolean

  /**
   * Optional CSS class name
   */
  readonly className?: string

  /**
   * Accessible label for the selector
   */
  readonly "aria-label"?: string

  /**
   * ID of the element that labels this selector
   */
  readonly "aria-labelledby"?: string

  /**
   * Optional ID for the component
   */
  readonly id?: string
}

// =============================================================================
// Atoms for AccountSelector
// =============================================================================

/**
 * Create a parameterized accounts query atom
 *
 * Uses conditional spreading to avoid passing undefined values
 * (required for exactOptionalPropertyTypes compatibility)
 */
const createAccountsQueryAtom = (params: {
  companyId: CompanyId
  accountType?: AccountType | undefined
  isActive?: boolean | undefined
  isPostable?: boolean | undefined
}) => {
  // Build urlParams object without undefined values
  const urlParams: {
    companyId: CompanyId
    accountType?: AccountType
    isActive?: boolean
    isPostable?: boolean
    limit: number
    offset: number
  } = {
    companyId: params.companyId,
    limit: 1000,
    offset: 0
  }

  // Only add optional properties if they are not undefined
  if (params.accountType !== undefined) {
    urlParams.accountType = params.accountType
  }
  if (params.isActive !== undefined) {
    urlParams.isActive = params.isActive
  }
  if (params.isPostable !== undefined) {
    urlParams.isPostable = params.isPostable
  }

  return ApiClient.query("accounts", "listAccounts", {
    urlParams,
    timeToLive: Duration.minutes(5)
  })
}

// =============================================================================
// Component
// =============================================================================

/**
 * AccountSelector Component
 *
 * A fully accessible, searchable dropdown for selecting accounts.
 * Displays accounts in a hierarchical tree structure with indentation.
 */
export function AccountSelector({
  value,
  onChange,
  companyId,
  accountType,
  isPostable,
  isActive,
  placeholder = "Select an account...",
  disabled = false,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  id
}: AccountSelectorProps): React.ReactElement {
  // Generate unique IDs for ARIA
  const componentId = id ?? React.useId()
  const listboxId = `${componentId}-listbox`
  const inputId = `${componentId}-input`

  // Local state
  const [isOpen, setIsOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1)

  // Refs
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listboxRef = React.useRef<HTMLUListElement>(null)

  // Create memoized query atom based on props
  const accountsQueryAtom = React.useMemo(
    () => createAccountsQueryAtom({
      companyId,
      accountType,
      isActive,
      isPostable
    }),
    [companyId, accountType, isActive, isPostable]
  )

  // Fetch accounts using the atom
  const accountsResult = useAtomValue(accountsQueryAtom)

  // Process accounts into hierarchical list
  const hierarchicalAccounts = React.useMemo(() => {
    if (!Result.isSuccess(accountsResult)) {
      return []
    }
    return buildHierarchicalList(accountsResult.value.accounts)
  }, [accountsResult])

  // Filter accounts by search
  const filteredAccounts = React.useMemo(
    () => filterBySearch(hierarchicalAccounts, searchQuery),
    [hierarchicalAccounts, searchQuery]
  )

  // Find selected account
  const selectedAccount = React.useMemo(() => {
    if (value === null) return null
    return hierarchicalAccounts.find(({ account }) => account.id === value)?.account ?? null
  }, [hierarchicalAccounts, value])

  // Reset highlighted index when filtered list changes
  React.useEffect(() => {
    setHighlightedIndex(filteredAccounts.length > 0 ? 0 : -1)
  }, [filteredAccounts.length, searchQuery])

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target
      if (containerRef.current && target instanceof Node && !containerRef.current.contains(target)) {
        setIsOpen(false)
        setSearchQuery("")
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Scroll highlighted item into view
  React.useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listboxRef.current) {
      const highlightedElement = listboxRef.current.children[highlightedIndex]
      if (highlightedElement instanceof HTMLElement) {
        highlightedElement.scrollIntoView({ block: "nearest" })
      }
    }
  }, [highlightedIndex, isOpen])

  // Event handlers
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value)
    if (!isOpen) {
      setIsOpen(true)
    }
  }

  const handleInputFocus = () => {
    if (!disabled) {
      setIsOpen(true)
    }
  }

  const handleSelectAccount = (account: Account) => {
    onChange(account.id)
    setIsOpen(false)
    setSearchQuery("")
    inputRef.current?.blur()
  }

  const handleClear = (event: React.MouseEvent) => {
    event.stopPropagation()
    onChange(null)
    setSearchQuery("")
    inputRef.current?.focus()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
        } else {
          setHighlightedIndex((prev) =>
            prev < filteredAccounts.length - 1 ? prev + 1 : prev
          )
        }
        break

      case "ArrowUp":
        event.preventDefault()
        if (isOpen) {
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
        }
        break

      case "Enter":
        event.preventDefault()
        if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredAccounts.length) {
          handleSelectAccount(filteredAccounts[highlightedIndex].account)
        } else if (!isOpen) {
          setIsOpen(true)
        }
        break

      case "Escape":
        event.preventDefault()
        setIsOpen(false)
        setSearchQuery("")
        break

      case "Tab":
        if (isOpen) {
          setIsOpen(false)
          setSearchQuery("")
        }
        break

      case "Home":
        if (isOpen && filteredAccounts.length > 0) {
          event.preventDefault()
          setHighlightedIndex(0)
        }
        break

      case "End":
        if (isOpen && filteredAccounts.length > 0) {
          event.preventDefault()
          setHighlightedIndex(filteredAccounts.length - 1)
        }
        break
    }
  }

  // Determine loading/error state
  const isLoading = Result.isInitial(accountsResult) || Result.isWaiting(accountsResult)
  const hasError = Result.isFailure(accountsResult)

  // Styles (inline for portability - can be extracted to CSS)
  const containerStyle: React.CSSProperties = {
    position: "relative",
    display: "inline-block",
    width: "100%"
  }

  const inputContainerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    border: "1px solid #ccc",
    borderRadius: "4px",
    padding: "8px 12px",
    backgroundColor: disabled ? "#f5f5f5" : "#fff",
    cursor: disabled ? "not-allowed" : "text"
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    border: "none",
    outline: "none",
    fontSize: "14px",
    backgroundColor: "transparent",
    cursor: disabled ? "not-allowed" : "text"
  }

  const dropdownStyle: React.CSSProperties = {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    maxHeight: "300px",
    overflowY: "auto",
    backgroundColor: "#fff",
    border: "1px solid #ccc",
    borderRadius: "4px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
    zIndex: 1000,
    marginTop: "4px",
    listStyle: "none",
    padding: 0,
    margin: 0
  }

  const optionStyle = (isHighlighted: boolean, isSelected: boolean): React.CSSProperties => ({
    padding: "8px 12px",
    cursor: "pointer",
    backgroundColor: isHighlighted ? "#e6f7ff" : isSelected ? "#f0f0f0" : "#fff",
    borderBottom: "1px solid #f0f0f0"
  })

  const accountDisplayStyle = (depth: number): React.CSSProperties => ({
    paddingLeft: `${depth * 16}px`,
    display: "flex",
    alignItems: "center",
    gap: "8px"
  })

  const accountNumberStyle: React.CSSProperties = {
    fontFamily: "monospace",
    fontSize: "12px",
    color: "#666",
    minWidth: "60px"
  }

  const accountNameStyle: React.CSSProperties = {
    flex: 1
  }

  const accountTypeStyle: React.CSSProperties = {
    fontSize: "11px",
    color: "#999",
    marginLeft: "auto"
  }

  const clearButtonStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "0 4px",
    color: "#999",
    fontSize: "16px"
  }

  const chevronStyle: React.CSSProperties = {
    marginLeft: "8px",
    color: "#999",
    transition: "transform 0.2s",
    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)"
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      id={componentId}
    >
      {/* Input Container */}
      <div
        style={inputContainerStyle}
        onClick={() => !disabled && inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-activedescendant={
            isOpen && highlightedIndex >= 0
              ? `${listboxId}-option-${highlightedIndex}`
              : undefined
          }
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-autocomplete="list"
          aria-busy={isLoading}
          aria-invalid={hasError}
          autoComplete="off"
          disabled={disabled}
          placeholder={selectedAccount ? "" : placeholder}
          value={isOpen ? searchQuery : (selectedAccount?.name ?? "")}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          style={inputStyle}
        />

        {/* Selected value display when not searching */}
        {!isOpen && selectedAccount && (
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={accountNumberStyle}>{selectedAccount.accountNumber}</span>
          </span>
        )}

        {/* Clear button */}
        {value !== null && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            style={clearButtonStyle}
            aria-label="Clear selection"
            tabIndex={-1}
          >
            x
          </button>
        )}

        {/* Dropdown chevron */}
        <span style={chevronStyle} aria-hidden="true">
          v
        </span>
      </div>

      {/* Dropdown List */}
      {isOpen && (
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label="Accounts"
          style={dropdownStyle}
        >
          {isLoading && (
            <li style={{ padding: "12px", textAlign: "center", color: "#999" }}>
              Loading accounts...
            </li>
          )}

          {hasError && (
            <li style={{ padding: "12px", textAlign: "center", color: "#f5222d" }}>
              Error loading accounts
            </li>
          )}

          {!isLoading && !hasError && filteredAccounts.length === 0 && (
            <li style={{ padding: "12px", textAlign: "center", color: "#999" }}>
              {searchQuery ? "No accounts match your search" : "No accounts available"}
            </li>
          )}

          {!isLoading && !hasError && filteredAccounts.map(({ account, depth }, index) => {
            const isHighlighted = index === highlightedIndex
            const isSelected = account.id === value

            return (
              <li
                key={account.id}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={isSelected}
                style={optionStyle(isHighlighted, isSelected)}
                onClick={() => handleSelectAccount(account)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <div style={accountDisplayStyle(depth)}>
                  <span style={accountNumberStyle}>{account.accountNumber}</span>
                  <span style={accountNameStyle}>{account.name}</span>
                  <span style={accountTypeStyle}>{account.accountType}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
