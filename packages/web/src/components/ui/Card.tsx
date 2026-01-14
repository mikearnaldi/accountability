/**
 * Card Component
 *
 * A polished card component with header, body, and footer sections.
 * Features:
 * - Clean shadow and border styling
 * - Optional hover effect for interactive cards
 * - Composable header, body, and footer
 * - Consistent padding and spacing
 */

import * as React from "react"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly children: React.ReactNode
  readonly className?: string
  readonly interactive?: boolean
  readonly padding?: "none" | "sm" | "md" | "lg"
}

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8"
}

export function Card({
  children,
  className = "",
  interactive = false,
  padding = "none",
  ...props
}: CardProps) {
  const baseClasses = [
    "bg-white rounded-xl",
    "border border-gray-200",
    "shadow-sm"
  ].join(" ")

  const interactiveClasses = interactive
    ? "transition-all duration-200 hover:shadow-md hover:border-gray-300 cursor-pointer"
    : ""

  return (
    <div className={`${baseClasses} ${interactiveClasses} ${paddingClasses[padding]} ${className}`} {...props}>
      {children}
    </div>
  )
}

interface CardHeaderProps {
  readonly children: React.ReactNode
  readonly className?: string
  readonly action?: React.ReactNode
}

export function CardHeader({ children, className = "", action }: CardHeaderProps) {
  return (
    <div className={`px-6 py-4 border-b border-gray-100 ${className}`}>
      {action ? (
        <div className="flex items-center justify-between">
          <div>{children}</div>
          <div>{action}</div>
        </div>
      ) : (
        children
      )}
    </div>
  )
}

interface CardTitleProps {
  readonly children: React.ReactNode
  readonly className?: string
  readonly description?: React.ReactNode
}

export function CardTitle({ children, className = "", description }: CardTitleProps) {
  return (
    <div className={className}>
      <h3 className="text-lg font-semibold text-gray-900">{children}</h3>
      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
    </div>
  )
}

interface CardBodyProps {
  readonly children: React.ReactNode
  readonly className?: string
}

export function CardBody({ children, className = "" }: CardBodyProps) {
  return <div className={`px-6 py-4 ${className}`}>{children}</div>
}

interface CardFooterProps {
  readonly children: React.ReactNode
  readonly className?: string
}

export function CardFooter({ children, className = "" }: CardFooterProps) {
  return (
    <div className={`px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl ${className}`}>
      {children}
    </div>
  )
}
