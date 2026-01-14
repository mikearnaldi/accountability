/**
 * Skeleton Component
 *
 * Loading placeholder components that match content layout.
 * Features:
 * - Pulse animation
 * - Various shapes: text, circle, rectangle
 * - Composable for complex layouts
 */

import * as React from "react"

interface SkeletonProps {
  readonly className?: string
  readonly variant?: "text" | "circular" | "rectangular"
  readonly width?: string | number
  readonly height?: string | number
  readonly animation?: "pulse" | "wave" | "none"
}

export function Skeleton({
  className = "",
  variant = "text",
  width,
  height,
  animation = "pulse"
}: SkeletonProps) {
  const baseClasses = "bg-gray-200"

  const animationClasses = {
    pulse: "animate-pulse",
    wave: "animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]",
    none: ""
  }

  const variantClasses = {
    text: "rounded",
    circular: "rounded-full",
    rectangular: "rounded-lg"
  }

  const style: React.CSSProperties = {
    width: width ?? (variant === "text" ? "100%" : undefined),
    height: height ?? (variant === "text" ? "1em" : undefined)
  }

  return (
    <div
      className={`${baseClasses} ${animationClasses[animation]} ${variantClasses[variant]} ${className}`}
      style={style}
      aria-hidden="true"
    />
  )
}

// Preset skeleton components for common patterns

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          height={16}
          width={i === lines - 1 ? "75%" : "100%"}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-6 ${className}`}>
      <div className="flex items-start gap-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" height={20} />
          <Skeleton variant="text" width="40%" height={16} />
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-100">
        <Skeleton variant="text" width="50%" height={14} />
      </div>
    </div>
  )
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  className = ""
}: {
  rows?: number
  columns?: number
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white overflow-hidden ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} variant="text" width={100} height={14} />
          ))}
        </div>
      </div>
      {/* Rows */}
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="px-6 py-4">
            <div className="flex gap-4">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton
                  key={colIndex}
                  variant="text"
                  width={colIndex === 0 ? 80 : 120}
                  height={16}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonAvatar({
  size = "md"
}: {
  size?: "sm" | "md" | "lg"
}) {
  const sizes = {
    sm: 32,
    md: 40,
    lg: 48
  }

  return <Skeleton variant="circular" width={sizes[size]} height={sizes[size]} />
}
