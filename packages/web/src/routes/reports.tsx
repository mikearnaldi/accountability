import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/reports")({
  component: Reports
})

function Reports() {
  return (
    <div>
      <h1>Reports</h1>
      <p>Generate and view financial reports.</p>
      <section>
        <h2>Available Reports</h2>
        <ul>
          <li>Trial Balance</li>
          <li>Balance Sheet</li>
          <li>Income Statement</li>
          <li>Cash Flow Statement</li>
          <li>Statement of Changes in Equity</li>
        </ul>
      </section>
    </div>
  )
}
