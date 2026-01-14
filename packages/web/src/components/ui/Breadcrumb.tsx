/**
 * Breadcrumb Component
 *
 * A polished breadcrumb navigation component.
 * Features:
 * - Automatic chevron separators
 * - Current page indicator (last item)
 * - Link styling with hover states
 */

import { Link } from "@tanstack/react-router"

interface BreadcrumbItem {
  readonly label: string
  readonly to?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly params?: any
}

interface BreadcrumbProps {
  readonly items: ReadonlyArray<BreadcrumbItem>
  readonly className?: string
}

function ChevronIcon() {
  return (
    <svg
      className="h-4 w-4 flex-shrink-0 text-gray-400"
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  return (
    <nav
      className={`flex items-center text-sm ${className}`}
      aria-label="Breadcrumb"
      data-testid="breadcrumb"
    >
      <ol className="flex items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <li key={index} className="flex items-center gap-1">
              {index > 0 && <ChevronIcon />}
              {isLast || !item.to ? (
                <span
                  className={`
                    ${isLast ? "font-medium text-gray-900" : "text-gray-500"}
                  `}
                  aria-current={isLast ? "page" : undefined}
                  data-testid={isLast ? "breadcrumb-current" : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.to}
                  params={item.params}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
