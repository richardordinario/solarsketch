import { useSyncExternalStore } from 'react'

/**
 * Minimal hash router: `#/learn/solar-basics` -> ['learn', 'solar-basics']. No server config needed on a static host.
 * An empty or unknown hash opens the Virtual Lab.
 */
export type Route =
  | { page: 'lab' }
  | { page: 'learn'; lessonId?: string }
  | { page: 'components'; type?: string }
  | { page: 'projects' }
  | { page: 'challenges'; challengeId?: string }
  | { page: 'progress' }
  | { page: 'settings' }
  | { page: 'privacy' }
  | { page: 'terms' }

export function parseHash(hash: string): Route {
  const [page, id] = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  switch (page) {
    case 'learn':
      return { page: 'learn', lessonId: id || undefined }
    case 'challenges':
      return { page: 'challenges', challengeId: id || undefined }
    case 'components':
      return { page: 'components', type: id || undefined }
    case 'projects':
    case 'progress':
    case 'settings':
    case 'privacy':
    case 'terms':
      return { page }
    // The app opens on the Virtual Lab (PRD §2.1, §13): an empty or unknown hash is the lab.
    default:
      return { page: 'lab' }
  }
}

export function href(route: Route) {
  switch (route.page) {
    case 'lab':
      return '#/lab'
    case 'learn':
      return route.lessonId ? `#/learn/${encodeURIComponent(route.lessonId)}` : '#/learn'
    case 'challenges':
      return route.challengeId ? `#/challenges/${encodeURIComponent(route.challengeId)}` : '#/challenges'
    case 'components':
      return route.type ? `#/components/${encodeURIComponent(route.type)}` : '#/components'
    default:
      return `#/${route.page}`
  }
}

export function navigate(route: Route) {
  window.location.hash = href(route)
}

/**
 * A page can block hash navigation away from it, e.g. to confirm leaving the Virtual Lab.
 * The guard returns true to allow `to` (a hash like `#/projects`); on false the old hash is restored.
 */
type LeaveGuard = (to: string) => boolean
let leaveGuard: LeaveGuard | null = null
let bypassGuard = false

export function setLeaveGuard(guard: LeaveGuard) {
  leaveGuard = guard
  return () => {
    if (leaveGuard === guard) leaveGuard = null
  }
}

/** Navigate without asking the leave guard, after the user has confirmed. */
export function navigateUnguarded(to: string) {
  if (window.location.hash === to) return
  bypassGuard = true
  window.location.hash = to
}

function guardHashChange(e: HashChangeEvent) {
  if (bypassGuard) {
    bypassGuard = false
    return
  }
  if (!leaveGuard || leaveGuard(new URL(e.newURL).hash || '#/')) return
  history.pushState(null, '', new URL(e.oldURL).hash || href({ page: 'lab' }))
}
// Registered at import time, before any useRoute subscriber, so a blocked change never renders.
window.addEventListener('hashchange', guardHashChange)
// Dev hot reload re-runs this module; drop the old listener so guards don't stack.
import.meta.hot?.dispose(() => window.removeEventListener('hashchange', guardHashChange))

function subscribe(fn: () => void) {
  window.addEventListener('hashchange', fn)
  return () => window.removeEventListener('hashchange', fn)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parseHash(hash)
}
