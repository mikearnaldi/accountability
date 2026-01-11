import { createFileRoute } from "@tanstack/react-router"
import { handler } from "~/api/handler"

// Catch-all API route that forwards all /api/* requests to the Effect HttpApi handler
// The $ in the filename creates a splat route matching /api/[...path]
export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      POST: ({ request }) => handler(request),
      PUT: ({ request }) => handler(request),
      DELETE: ({ request }) => handler(request),
      PATCH: ({ request }) => handler(request)
    }
  }
})
