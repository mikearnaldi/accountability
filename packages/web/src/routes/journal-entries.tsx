import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/journal-entries")({
  component: JournalEntries
})

function JournalEntries() {
  return (
    <div>
      <h1>Journal Entries</h1>
      <p>Record and manage your accounting transactions.</p>
      <section>
        <h2>Recent Entries</h2>
        <p>No journal entries yet. Create your first entry to get started.</p>
      </section>
    </div>
  )
}
