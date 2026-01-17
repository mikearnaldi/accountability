/**
 * LinkJournalEntryModal component
 *
 * Modal dialog for linking a journal entry to an intercompany transaction.
 */

import { useState, useEffect, useMemo } from "react"
import { api } from "@/api/client"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { X, FileText, Link as LinkIcon, Search } from "lucide-react"

interface JournalEntry {
  readonly id: string
  readonly entryNumber: string | null
  readonly transactionDate: { year: number; month: number; day: number }
  readonly description: string
  readonly status: string
}

interface LinkJournalEntryModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly onSubmit: (journalEntryId: string) => Promise<void>
  readonly organizationId: string
  readonly companyId: string
  readonly companyName: string
  readonly side: "from" | "to"
  readonly isSubmitting: boolean
}

export function LinkJournalEntryModal({
  isOpen,
  onClose,
  onSubmit,
  organizationId,
  companyId,
  companyName,
  side,
  isSubmitting
}: LinkJournalEntryModalProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [journalEntries, setJournalEntries] = useState<readonly JournalEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)

  // Fetch journal entries when modal opens
  useEffect(() => {
    if (!isOpen) return

    const fetchJournalEntries = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const { data, error: apiError } = await api.GET("/api/v1/journal-entries", {
          params: { query: { organizationId, companyId, limit: "50" } }
        })

        if (apiError) {
          setError("Failed to load journal entries")
          setIsLoading(false)
          return
        }

        setJournalEntries(data?.entries ?? [])
      } catch {
        setError("Failed to load journal entries")
      } finally {
        setIsLoading(false)
      }
    }

    fetchJournalEntries()
  }, [isOpen, organizationId, companyId])

  // Filter entries by search query
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return journalEntries

    const query = searchQuery.toLowerCase()
    return journalEntries.filter(
      (entry) =>
        (entry.entryNumber && entry.entryNumber.toLowerCase().includes(query)) ||
        entry.description.toLowerCase().includes(query)
    )
  }, [journalEntries, searchQuery])

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!selectedEntryId) {
      setError("Please select a journal entry")
      return
    }

    setError(null)

    try {
      await onSubmit(selectedEntryId)
      onClose()
    } catch {
      setError("Failed to link journal entry. Please try again.")
    }
  }

  const formatDate = (localDate: { year: number; month: number; day: number }) => {
    const date = new Date(localDate.year, localDate.month - 1, localDate.day)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    })
  }


  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      data-testid="link-journal-entry-modal"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl rounded-lg bg-white shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Link Journal Entry
            </h2>
            <p className="text-sm text-gray-500">
              {side === "from" ? "From" : "To"} side: {companyName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
            data-testid="close-modal-button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by entry number or description..."
              className="pl-10"
              data-testid="search-input"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : error && journalEntries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-red-600">{error}</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-300 mx-auto" />
              <p className="mt-4 text-gray-500">
                {searchQuery
                  ? "No journal entries match your search"
                  : "No journal entries found for this company"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEntries.map((entry) => (
                <label
                  key={entry.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    selectedEntryId === entry.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="journalEntry"
                    value={entry.id}
                    checked={selectedEntryId === entry.id}
                    onChange={() => setSelectedEntryId(entry.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="font-medium text-gray-900">{entry.entryNumber ?? "(Draft)"}</span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        entry.status === "Posted"
                          ? "bg-blue-100 text-blue-800"
                          : entry.status === "Approved"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                      }`}>
                        {entry.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span>{formatDate(entry.transactionDate)}</span>
                    </div>
                    {entry.description && (
                      <p className="mt-1 text-sm text-gray-600 truncate">
                        {entry.description}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && journalEntries.length > 0 && (
          <div className="px-6">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedEntryId}
            icon={<LinkIcon className="h-4 w-4" />}
          >
            {isSubmitting ? "Linking..." : "Link Entry"}
          </Button>
        </div>
      </div>
    </div>
  )
}
