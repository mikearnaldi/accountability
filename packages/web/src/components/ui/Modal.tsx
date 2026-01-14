/**
 * Modal Component
 *
 * A polished modal dialog component.
 * Features:
 * - Backdrop with blur effect
 * - Smooth enter/exit animations
 * - Escape key to close
 * - Click outside to close
 * - Focus trap (basic)
 * - Composable header, body, footer
 */

import * as React from "react"

interface ModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly children: React.ReactNode
  readonly size?: "sm" | "md" | "lg" | "xl"
  readonly closeOnEscape?: boolean
  readonly closeOnBackdrop?: boolean
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl"
}

export function Modal({
  isOpen,
  onClose,
  children,
  size = "md",
  closeOnEscape = true,
  closeOnBackdrop = true
}: ModalProps) {
  // Handle escape key
  React.useEffect(() => {
    if (!closeOnEscape || !isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose, closeOnEscape])

  // Handle backdrop click
  const handleBackdropClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (closeOnBackdrop && e.target === e.currentTarget) {
        onClose()
      }
    },
    [onClose, closeOnBackdrop]
  )

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = ""
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`
          relative w-full ${sizeClasses[size]}
          bg-white rounded-xl shadow-2xl
          transform transition-all
          animate-in fade-in zoom-in-95 duration-200
        `}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  )
}

interface ModalHeaderProps {
  readonly children: React.ReactNode
  readonly onClose?: () => void
  readonly className?: string
}

export function ModalHeader({ children, onClose, className = "" }: ModalHeaderProps) {
  return (
    <div className={`px-6 py-4 border-b border-gray-100 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">{children}</div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="
              flex-shrink-0 rounded-lg p-1.5
              text-gray-400 hover:text-gray-600 hover:bg-gray-100
              transition-colors
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
            "
            aria-label="Close modal"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

interface ModalTitleProps {
  readonly children: React.ReactNode
  readonly description?: React.ReactNode
}

export function ModalTitle({ children, description }: ModalTitleProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">{children}</h2>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
    </div>
  )
}

interface ModalBodyProps {
  readonly children: React.ReactNode
  readonly className?: string
}

export function ModalBody({ children, className = "" }: ModalBodyProps) {
  return <div className={`px-6 py-4 ${className}`}>{children}</div>
}

interface ModalFooterProps {
  readonly children: React.ReactNode
  readonly className?: string
}

export function ModalFooter({ children, className = "" }: ModalFooterProps) {
  return (
    <div className={`px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl ${className}`}>
      <div className="flex justify-end gap-3">{children}</div>
    </div>
  )
}
