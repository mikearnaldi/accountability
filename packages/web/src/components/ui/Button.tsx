/**
 * Button Component
 *
 * A polished, reusable button component with variants and sizes.
 * Features:
 * - Multiple variants: primary, secondary, danger, ghost, outline
 * - Multiple sizes: sm, md, lg
 * - Loading state with spinner
 * - Disabled state styling
 * - Focus ring for accessibility
 * - Smooth transitions
 */

import * as React from "react"

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline"
type ButtonSize = "sm" | "md" | "lg"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant
  readonly size?: ButtonSize
  readonly loading?: boolean
  readonly leftIcon?: React.ReactNode
  readonly rightIcon?: React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    "bg-indigo-600 text-white",
    "hover:bg-indigo-700 active:bg-indigo-800",
    "focus-visible:ring-indigo-500",
    "shadow-sm hover:shadow"
  ].join(" "),
  secondary: [
    "bg-white text-gray-700",
    "border border-gray-300",
    "hover:bg-gray-50 active:bg-gray-100",
    "focus-visible:ring-indigo-500",
    "shadow-sm"
  ].join(" "),
  danger: [
    "bg-red-600 text-white",
    "hover:bg-red-700 active:bg-red-800",
    "focus-visible:ring-red-500",
    "shadow-sm hover:shadow"
  ].join(" "),
  ghost: [
    "bg-transparent text-gray-600",
    "hover:bg-gray-100 active:bg-gray-200",
    "focus-visible:ring-gray-500"
  ].join(" "),
  outline: [
    "bg-transparent text-indigo-600",
    "border border-indigo-600",
    "hover:bg-indigo-50 active:bg-indigo-100",
    "focus-visible:ring-indigo-500"
  ].join(" ")
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-5 py-2.5 text-base gap-2"
}

function Spinner({ className }: { readonly className?: string }) {
  return (
    <svg
      className={`animate-spin ${className ?? "h-4 w-4"}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  leftIcon,
  rightIcon,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses = [
    "inline-flex items-center justify-center",
    "font-medium rounded-lg",
    "transition-all duration-200",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
  ].join(" ")

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Spinner className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      ) : leftIcon ? (
        <span className="flex-shrink-0">{leftIcon}</span>
      ) : null}
      {children}
      {!loading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
    </button>
  )
}
