/**
 * Tooltip component
 *
 * Tooltip that appears on hover with smart positioning to avoid collisions.
 * Features:
 * - Uses Floating UI for smart positioning with collision detection
 * - Automatically repositions to avoid viewport edges and sidebar
 * - Configurable preferred position (top, bottom, left, right)
 * - Accessible with aria-label
 * - Works with any child element
 */

import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  type Placement
} from "@floating-ui/react"
import { clsx } from "clsx"
import { useState, type ReactNode } from "react"

interface TooltipProps {
  /** Content to show in tooltip (string for simple text, ReactNode for complex content) */
  readonly content: ReactNode
  /** Element that triggers the tooltip */
  readonly children: ReactNode
  /** Preferred position of tooltip relative to trigger (may change if collision detected) */
  readonly position?: "top" | "bottom" | "left" | "right"
  /** Additional class names for the wrapper */
  readonly className?: string
  /** Maximum width for the tooltip content (useful for long text) */
  readonly maxWidth?: string
  /** Test ID for E2E testing */
  readonly "data-testid"?: string
}

export function Tooltip({
  content,
  children,
  position = "top",
  className,
  maxWidth,
  "data-testid": testId
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Map simple position to Floating UI placement
  const placementMap: Record<string, Placement> = {
    top: "top",
    bottom: "bottom",
    left: "left",
    right: "right"
  }

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: placementMap[position],
    // Update position on scroll/resize while open
    whileElementsMounted: autoUpdate,
    middleware: [
      // Add space between trigger and tooltip
      offset(8),
      // Flip to opposite side if not enough space
      flip({
        fallbackAxisSideDirection: "start",
        crossAxis: false
      }),
      // Shift along axis to stay in view
      shift({ padding: 8 })
    ]
  })

  // Set up hover, focus, dismiss, and role interactions
  const hover = useHover(context, { move: false })
  const focus = useFocus(context)
  const dismiss = useDismiss(context)
  const role = useRole(context, { role: "tooltip" })

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role
  ])

  return (
    <>
      <span
        ref={refs.setReference}
        {...getReferenceProps()}
        className={clsx("inline-flex", className)}
        data-testid={testId}
      >
        {children}
      </span>
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={{ ...floatingStyles, ...(maxWidth ? { maxWidth } : {}) }}
            {...getFloatingProps()}
            className={clsx(
              "z-[9999] px-2 py-1 text-xs font-normal normal-case tracking-normal",
              "text-white bg-gray-900 rounded shadow-lg",
              "pointer-events-none",
              maxWidth ? "whitespace-normal" : "whitespace-nowrap"
            )}
          >
            {content}
          </div>
        </FloatingPortal>
      )}
    </>
  )
}
