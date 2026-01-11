import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  component: Home
})

function Home() {
  return (
    <div>
      <h1>Welcome to Accountability</h1>
      <p>
        Multi-company, multi-currency accounting application built on US GAAP principles.
      </p>
      <section>
        <h2>Quick Start</h2>
        <ul>
          <li>Manage your companies and chart of accounts</li>
          <li>Record journal entries with multi-currency support</li>
          <li>Generate financial reports (Trial Balance, Balance Sheet, Income Statement)</li>
          <li>Perform consolidation for multi-entity groups</li>
        </ul>
      </section>
    </div>
  )
}
