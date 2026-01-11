import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/companies")({
  component: Companies
})

function Companies() {
  return (
    <div>
      <h1>Companies</h1>
      <p>Manage your companies and their settings.</p>
      <section>
        <h2>Company List</h2>
        <p>No companies yet. Create your first company to get started.</p>
      </section>
    </div>
  )
}
