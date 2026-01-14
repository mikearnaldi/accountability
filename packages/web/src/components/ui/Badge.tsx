/**
 * Badge Component
 *
 * A polished badge/tag component for status indicators.
 * Features:
 * - Multiple color variants
 * - Optional dot indicator
 * - Size variants
 */

import * as React from "react"

type BadgeVariant = "gray" | "blue" | "green" | "yellow" | "red" | "indigo" | "purple"
type BadgeSize = "sm" | "md"

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  readonly children: React.ReactNode
  readonly variant?: BadgeVariant
  readonly size?: BadgeSize
  readonly dot?: boolean
  readonly className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  gray: "bg-gray-100 text-gray-700 ring-gray-500/10",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/10",
  green: "bg-green-50 text-green-700 ring-green-600/10",
  yellow: "bg-yellow-50 text-yellow-700 ring-yellow-600/10",
  red: "bg-red-50 text-red-700 ring-red-600/10",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/10",
  purple: "bg-purple-50 text-purple-700 ring-purple-600/10"
}

const dotColors: Record<BadgeVariant, string> = {
  gray: "bg-gray-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
  indigo: "bg-indigo-500",
  purple: "bg-purple-500"
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs"
}

export function Badge({
  children,
  variant = "gray",
  size = "md",
  dot = false,
  className = "",
  ...props
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        font-medium rounded-full
        ring-1 ring-inset
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      {...props}
    >
      {dot && (
        <span className={`h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} />
      )}
      {children}
    </span>
  )
}
