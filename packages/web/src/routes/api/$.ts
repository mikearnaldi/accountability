import { createFileRoute } from "@tanstack/react-router"
// Import types for server route handler augmentation
import type {} from "@tanstack/react-start"
import { handler } from "~/api/handler"

// Catch-all API route that forwards all /api/* requests to the Effect HttpApi handler
// The $ in the filename creates a splat route matching /api/[...path]
export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => handler(request),
      POST: ({ request }: { request: Request }) => handler(request),
      PUT: ({ request }: { request: Request }) => handler(request),
      DELETE: ({ request }: { request: Request }) => handler(request),
      PATCH: ({ request }: { request: Request }) => handler(request)
    }
  }
})
