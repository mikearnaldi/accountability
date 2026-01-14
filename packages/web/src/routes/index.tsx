import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  component: HomePage
})

function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="mb-4 text-4xl font-bold text-gray-900">
        Accountability
      </h1>
      <p className="mb-8 text-lg text-gray-600">
        Multi-company, multi-currency accounting
      </p>
      <p className="text-sm text-gray-400">
        UI rebuild in progress...
      </p>
    </div>
  )
}
