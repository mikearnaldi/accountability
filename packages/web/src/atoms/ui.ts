/**
 * UI State Atoms
 *
 * Manages global UI state using Effect Atom.
 */

import * as Atom from "@effect-atom/atom/Atom"

/**
 * Controls whether the sidebar is expanded (true) or collapsed to icons only (false).
 * Defaults to expanded on desktop, will respond to responsive breakpoints.
 */
export const sidebarOpenAtom = Atom.make(true)
