/**
 * Tooltip component
 *
 * Simple CSS-based tooltip that appears on hover.
 * Features:
 * - Pure CSS implementation (no JS state management)
 * - Configurable position (top, bottom, left, right)
 * - Accessible with aria-label
 * - Works with any child element
 */

import { clsx } from "clsx"
import type { ReactNode } from "react"

interface TooltipProps {
  /** Content to show in tooltip */
  readonly content: string
  /** Element that triggers the tooltip */
  readonly children: ReactNode
  /** Position of tooltip relative to trigger */
  readonly position?: "top" | "bottom" | "left" | "right"
  /** Additional class names for the wrapper */
  readonly className?: string
  /** Test ID for E2E testing */
  readonly "data-testid"?: string
}

export function Tooltip({
  content,
  children,
  position = "top",
  className,
  "data-testid": testId
}: TooltipProps) {
  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2"
  }

  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-gray-900 border-x-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 border-x-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-gray-900 border-y-transparent border-r-transparent",
    right: "right-full top-1/2 -translate-y-1/2 border-r-gray-900 border-y-transparent border-l-transparent"
  }

  return (
    <span
      className={clsx("relative inline-flex group", className)}
      data-testid={testId}
    >
      {children}
      <span
        className={clsx(
          "absolute z-50 px-2 py-1 text-xs font-normal normal-case tracking-normal text-white bg-gray-900 rounded shadow-lg",
          "opacity-0 invisible group-hover:opacity-100 group-hover:visible",
          "transition-opacity duration-150 whitespace-nowrap",
          "pointer-events-none",
          positionClasses[position]
        )}
        role="tooltip"
      >
        {content}
        <span
          className={clsx(
            "absolute border-4",
            arrowClasses[position]
          )}
        />
      </span>
    </span>
  )
}
