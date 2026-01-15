/**
 * Table component
 *
 * Reusable data table with sorting, selection, and responsive features.
 * Features:
 * - Composable structure (Table, TableHeader, TableBody, TableRow, TableCell)
 * - Sticky header option
 * - Zebra striping option
 * - Responsive horizontal scroll
 * - Data-testid attributes for E2E testing
 */

import { clsx } from "clsx"
import type { ReactNode } from "react"

import { Tooltip } from "./Tooltip.tsx"

// =============================================================================
// Table Component
// =============================================================================

interface TableProps {
  /** Table content */
  readonly children: ReactNode
  /** Enable zebra striping */
  readonly striped?: boolean
  /** Enable hover effect on rows */
  readonly hoverable?: boolean
  /** Make header sticky */
  readonly stickyHeader?: boolean
  /** Additional class names */
  readonly className?: string
  /** Test ID for E2E testing */
  readonly "data-testid"?: string
}

export function Table({
  children,
  striped = false,
  hoverable = true,
  stickyHeader = false,
  className,
  "data-testid": testId
}: TableProps) {
  return (
    <div className="overflow-x-auto" data-testid={testId}>
      <table
        className={clsx(
          "min-w-full divide-y divide-gray-200",
          striped && "[&_tbody_tr:nth-child(even)]:bg-gray-50",
          hoverable && "[&_tbody_tr]:hover:bg-gray-50",
          stickyHeader && "[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10",
          className
        )}
      >
        {children}
      </table>
    </div>
  )
}

// =============================================================================
// TableHeader Component
// =============================================================================

interface TableHeaderProps {
  /** Header content */
  readonly children: ReactNode
  /** Additional class names */
  readonly className?: string
  /** Test ID for E2E testing */
  readonly "data-testid"?: string
}

export function TableHeader({ children, className, "data-testid": testId }: TableHeaderProps) {
  return (
    <thead className={clsx("bg-gray-50", className)} data-testid={testId}>
      {children}
    </thead>
  )
}

// =============================================================================
// TableBody Component
// =============================================================================

interface TableBodyProps {
  /** Body content */
  readonly children: ReactNode
  /** Additional class names */
  readonly className?: string
  /** Test ID for E2E testing */
  readonly "data-testid"?: string
}

export function TableBody({ children, className, "data-testid": testId }: TableBodyProps) {
  return (
    <tbody
      className={clsx("divide-y divide-gray-200 bg-white", className)}
      data-testid={testId}
    >
      {children}
    </tbody>
  )
}

// =============================================================================
// TableRow Component
// =============================================================================

interface TableRowProps {
  /** Row content */
  readonly children: ReactNode
  /** Whether the row is selected */
  readonly selected?: boolean
  /** Additional class names */
  readonly className?: string
  /** Test ID for E2E testing */
  readonly "data-testid"?: string
}

export function TableRow({ children, selected = false, className, "data-testid": testId }: TableRowProps) {
  return (
    <tr className={clsx(selected && "bg-blue-50", className)} data-testid={testId}>
      {children}
    </tr>
  )
}

// =============================================================================
// TableHeaderCell Component
// =============================================================================

interface TableHeaderCellProps {
  /** Cell content */
  readonly children?: ReactNode
  /** Tooltip text explaining the column (shown on hover) */
  readonly tooltip?: string
  /** Sortable indicator */
  readonly sortable?: boolean
  /** Current sort direction */
  readonly sortDirection?: "asc" | "desc" | null
  /** On sort click handler */
  readonly onSort?: () => void
  /** Additional class names */
  readonly className?: string
  /** Test ID for E2E testing */
  readonly "data-testid"?: string
}

export function TableHeaderCell({
  children,
  tooltip,
  sortable = false,
  sortDirection,
  onSort,
  className,
  "data-testid": testId
}: TableHeaderCellProps) {
  const handleClick = sortable && onSort ? onSort : undefined
  const handleKeyDown = sortable && onSort ? (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onSort()
    }
  } : undefined

  const content = (
    <div className="flex items-center gap-1">
      {children}
      {sortable && (
        <span className="text-gray-400">
          {sortDirection === "asc" ? "↑" : sortDirection === "desc" ? "↓" : "↕"}
        </span>
      )}
    </div>
  )

  return (
    <th
      className={clsx(
        "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
        sortable && "cursor-pointer hover:bg-gray-100 select-none",
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={sortable ? 0 : undefined}
      role={sortable ? "button" : undefined}
      aria-sort={sortDirection === "asc" ? "ascending" : sortDirection === "desc" ? "descending" : undefined}
      data-testid={testId}
    >
      {tooltip ? (
        <Tooltip content={tooltip} position="bottom">
          {content}
        </Tooltip>
      ) : (
        content
      )}
    </th>
  )
}

// =============================================================================
// TableCell Component
// =============================================================================

interface TableCellProps {
  /** Cell content */
  readonly children?: ReactNode
  /** Align content */
  readonly align?: "left" | "center" | "right"
  /** Additional class names */
  readonly className?: string
  /** Test ID for E2E testing */
  readonly "data-testid"?: string
}

export function TableCell({
  children,
  align = "left",
  className,
  "data-testid": testId
}: TableCellProps) {
  return (
    <td
      className={clsx(
        "px-4 py-3 text-sm text-gray-900",
        align === "center" && "text-center",
        align === "right" && "text-right",
        className
      )}
      data-testid={testId}
    >
      {children}
    </td>
  )
}
