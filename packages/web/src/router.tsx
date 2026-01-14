import { createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen.ts"
import type { RouterContext } from "./types/router.ts"

const createInitialContext = (): RouterContext => ({
  user: null
})

export function getRouter() {
  const router = createRouter({
    routeTree,
    context: createInitialContext(),
    defaultPreload: "intent",
    scrollRestoration: true
  })
  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
