/**
 * CreateOrganizationModal Component
 *
 * A polished modal form for creating a new organization with:
 * - Professional styling using UI components
 * - Name input (required)
 * - Reporting currency selector
 * - Form validation
 * - Loading/error states
 */

import * as React from "react"
import { useState, useCallback, useEffect, useRef } from "react"
import { useAtom } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import { createOrganizationMutation } from "../atoms/organizations.ts"
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "./ui/Modal.tsx"
import { Button } from "./ui/Button.tsx"
import { Input } from "./ui/Input.tsx"
import { Select } from "./ui/Select.tsx"
import { Alert } from "./ui/Alert.tsx"

// =============================================================================
// Constants
// =============================================================================

const COMMON_CURRENCIES = [
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "JPY", label: "JPY - Japanese Yen" },
  { value: "CAD", label: "CAD - Canadian Dollar" },
  { value: "AUD", label: "AUD - Australian Dollar" },
  { value: "CHF", label: "CHF - Swiss Franc" },
  { value: "CNY", label: "CNY - Chinese Yuan" }
] as const

// =============================================================================
// Helper Functions
// =============================================================================

function hasTag(error: unknown): error is { _tag: string } {
  if (typeof error !== "object" || error === null) return false
  if (!("_tag" in error)) return false
  const tagValue = Reflect.get(error, "_tag")
  return typeof tagValue === "string"
}

function hasMessage(error: unknown): error is { message: string } {
  if (typeof error !== "object" || error === null) return false
  if (!("message" in error)) return false
  const messageValue = Reflect.get(error, "message")
  return typeof messageValue === "string"
}

function getErrorMessage(error: unknown): string {
  if (hasMessage(error)) return error.message
  if (hasTag(error)) return error._tag
  return "An unexpected error occurred"
}

// =============================================================================
// Component
// =============================================================================

interface CreateOrganizationModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly onSuccess?: (organizationId: string) => void
}

export function CreateOrganizationModal({
  isOpen,
  onClose,
  onSuccess
}: CreateOrganizationModalProps) {
  // Form state
  const [name, setName] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [validationError, setValidationError] = useState<string | null>(null)

  // Mutation
  const [createResult, createOrganization] = useAtom(createOrganizationMutation, { mode: "promise" })
  const isLoading = Result.isWaiting(createResult)

  // Focus management
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Focus name input when modal opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        nameInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setName("")
      setCurrency("USD")
      setValidationError(null)
    }
  }, [isOpen])

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setValidationError(null)

      const trimmedName = name.trim()
      if (!trimmedName) {
        setValidationError("Organization name is required")
        return
      }
      if (trimmedName.length < 2) {
        setValidationError("Organization name must be at least 2 characters")
        return
      }
      if (trimmedName.length > 100) {
        setValidationError("Organization name must be less than 100 characters")
        return
      }

      try {
        const organization = await createOrganization({
          name: trimmedName,
          reportingCurrency: currency
        })
        onSuccess?.(organization.id)
        onClose()
      } catch (error: unknown) {
        const tag = hasTag(error) ? error._tag : undefined
        if (tag === "ConflictError") {
          setValidationError("An organization with this name already exists")
        } else {
          setValidationError(getErrorMessage(error))
        }
      }
    },
    [name, currency, createOrganization, onSuccess, onClose]
  )

  const handleClose = useCallback(() => {
    if (!isLoading) {
      onClose()
    }
  }, [isLoading, onClose])

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="md"
      closeOnEscape={!isLoading}
      closeOnBackdrop={!isLoading}
    >
      <form onSubmit={handleSubmit} data-testid="create-organization-modal">
        <ModalHeader onClose={handleClose}>
          <ModalTitle description="Organizations group companies together for consolidated reporting.">
            Create Organization
          </ModalTitle>
        </ModalHeader>

        <ModalBody className="space-y-4">
          {validationError && (
            <Alert variant="error" data-testid="create-organization-error">
              {validationError}
            </Alert>
          )}

          <Input
            ref={nameInputRef}
            label="Organization Name"
            id="organization-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Organization"
            disabled={isLoading}
            data-testid="organization-name-input"
          />

          <Select
            label="Reporting Currency"
            id="reporting-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={COMMON_CURRENCIES}
            disabled={isLoading}
            helperText="This currency will be used for consolidated reports."
            data-testid="organization-currency-select"
          />
        </ModalBody>

        <ModalFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isLoading}
            data-testid="create-organization-cancel"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isLoading}
            data-testid="create-organization-submit"
          >
            Create Organization
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
