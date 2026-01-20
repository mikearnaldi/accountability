/**
 * Combobox component
 *
 * A searchable dropdown select with fuzzy filtering.
 * Features:
 * - Type to search/filter options
 * - Fuzzy matching (partial, case-insensitive)
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Floating dropdown with collision detection
 * - Matches existing Select styling
 */

import { clsx } from "clsx"
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent
} from "react"
import {
  useFloating,
  useClick,
  useDismiss,
  useInteractions,
  offset,
  flip,
  size,
  autoUpdate,
  FloatingPortal
} from "@floating-ui/react"
import { ChevronDown, Check } from "lucide-react"

export interface ComboboxOption {
  readonly value: string
  readonly label: string
  readonly searchText?: string // Additional text to search against
  readonly disabled?: boolean
}

interface ComboboxProps {
  /** Currently selected value */
  readonly value: string
  /** Callback when value changes */
  readonly onChange: (value: string) => void
  /** Available options */
  readonly options: readonly ComboboxOption[]
  /** Placeholder text when no value selected */
  readonly placeholder?: string
  /** Whether the combobox is disabled */
  readonly disabled?: boolean
  /** Additional class name for the trigger */
  readonly className?: string
  /** Test ID for E2E testing */
  readonly "data-testid"?: string
}

/**
 * Simple fuzzy match - checks if all characters in query appear in text in order
 */
function fuzzyMatch(text: string, query: string): boolean {
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()

  // Simple contains check for better UX
  if (lowerText.includes(lowerQuery)) {
    return true
  }

  // Fuzzy: all query chars must appear in order
  let textIndex = 0
  for (const char of lowerQuery) {
    const foundIndex = lowerText.indexOf(char, textIndex)
    if (foundIndex === -1) {
      return false
    }
    textIndex = foundIndex + 1
  }
  return true
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  className,
  "data-testid": testId
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Find selected option
  const selectedOption = options.find((opt) => opt.value === value)

  // Filter options based on query
  const filteredOptions = query
    ? options.filter((opt) => {
        const searchTarget = opt.searchText
          ? `${opt.label} ${opt.searchText}`
          : opt.label
        return fuzzyMatch(searchTarget, query)
      })
    : options

  // Floating UI setup
  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      size({
        apply({ rects, elements, availableHeight }) {
          Object.assign(elements.floating.style, {
            width: `${rects.reference.width}px`,
            maxHeight: `${Math.min(300, availableHeight)}px`
          })
        },
        padding: 8
      })
    ],
    whileElementsMounted: autoUpdate
  })

  const click = useClick(context)
  const dismiss = useDismiss(context)
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss])

  // Reset highlight when filtered options change
  useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredOptions.length])

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlighted = listRef.current.children[highlightedIndex]
      if (highlighted instanceof HTMLElement) {
        highlighted.scrollIntoView({ block: "nearest" })
      }
    }
  }, [highlightedIndex, isOpen])

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Clear query when closing
  useEffect(() => {
    if (!isOpen) {
      setQuery("")
    }
  }, [isOpen])

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue)
      setIsOpen(false)
      setQuery("")
    },
    [onChange]
  )

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    if (!isOpen) {
      setIsOpen(true)
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev))
        break
      case "Enter":
        e.preventDefault()
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex].value)
        }
        break
      case "Escape":
        e.preventDefault()
        setIsOpen(false)
        break
      case "Tab":
        setIsOpen(false)
        break
    }
  }

  return (
    <>
      {/* Trigger button */}
      <div
        ref={refs.setReference}
        {...getReferenceProps()}
        className={clsx(
          "relative flex w-full items-center rounded-lg border bg-white",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-0 focus-within:ring-blue-500 focus-within:border-blue-500",
          disabled
            ? "bg-gray-50 text-gray-500 cursor-not-allowed border-gray-300"
            : "cursor-pointer border-gray-300",
          className
        )}
        data-testid={testId}
      >
        {isOpen ? (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={selectedOption?.label || placeholder}
            disabled={disabled}
            className="w-full rounded-lg border-0 bg-transparent py-2 pl-3 pr-9 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0"
            autoComplete="off"
          />
        ) : (
          <button
            type="button"
            disabled={disabled}
            onKeyDown={handleKeyDown}
            className={clsx(
              "w-full rounded-lg border-0 bg-transparent py-2 pl-3 pr-9 text-left",
              "focus:outline-none",
              disabled ? "cursor-not-allowed" : "cursor-pointer",
              selectedOption ? "text-gray-900" : "text-gray-500"
            )}
          >
            {selectedOption?.label || placeholder}
          </button>
        )}
        <ChevronDown
          className={clsx(
            "pointer-events-none absolute right-3 h-4 w-4 text-gray-500 transition-transform",
            isOpen && "rotate-180"
          )}
          aria-hidden="true"
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <FloatingPortal>
          <ul
            ref={(node) => {
              refs.setFloating(node)
              if (node) listRef.current = node
            }}
            {...getFloatingProps()}
            style={floatingStyles}
            className="z-50 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500">No results found</li>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = option.value === value
                const isHighlighted = index === highlightedIndex

                return (
                  <li
                    key={option.value}
                    onClick={() => !option.disabled && handleSelect(option.value)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={clsx(
                      "flex cursor-pointer items-center px-3 py-2 text-sm",
                      option.disabled && "cursor-not-allowed opacity-50",
                      isHighlighted && !option.disabled && "bg-blue-50",
                      isSelected && "font-medium"
                    )}
                  >
                    <span className="flex-1">{option.label}</span>
                    {isSelected && (
                      <Check className="h-4 w-4 text-blue-600" aria-hidden="true" />
                    )}
                  </li>
                )
              })
            )}
          </ul>
        </FloatingPortal>
      )}
    </>
  )
}
