import { useSyncExternalStore } from 'react'

/**
 * Minimal hash router: `#/learn/solar-basics` -> ['learn', 'solar-basics']. No server config needed on a static host.
 * The site root (empty hash) opens the landing page; an unknown hash opens the Virtual Lab.
 */
export type Route =
  | { page: 'landing' }
  | { page: 'lab' }
  | { page: 'learn'; lessonId?: string }
  | { page: 'components'; type?: string }
  | { page: 'projects' }
  | { page: 'challenges'; challengeId?: string }
  | { page: 'progress' }
  | { page: 'settings' }
  | { page: 'privacy' }
  | { page: 'terms' }

/** Where the site root (no hash, `#` or `#/`) goes. */
export const HOME: Route = { page: 'landing' }

export function parseHash(hash: string): Route {
  if (/^#?\/?$/.test(hash)) return HOME
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
    // An unknown hash (e.g. an old link) opens the Virtual Lab with the last project.
    default:
      return { page: 'lab' }
  }
}

export function href(route: Route) {
  switch (route.page) {
    case 'landing':
      return '#/'
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

/**
 * Turn a path-style address into the hash route on the app's base path. Static hosts and the dev
 * server serve the app for any path, so `/challenges` (typed, or an old bookmark) would otherwise
 * stay in the address bar and every hash link would be appended to it (`/challenges#/components`).
 * `/challenges` becomes `#/challenges`; a path with a hash keeps the hash; the bare site root gets
 * the home route (`#/`, the landing page). Returns the new URL, or null when the address is already canonical.
 */
export function canonicalUrl(pathname: string, search: string, hash: string, base: string): string | null {
  const root = base.endsWith('/') ? base : base + '/'
  if (!pathname.startsWith(root) && pathname + '/' !== root) return null
  const rest = pathname === root + 'index.html' ? '' : pathname.slice(root.length).replace(/\/+$/, '')
  const target = /^#?\/?$/.test(hash) ? (rest ? '#/' + rest : href(HOME)) : hash
  const url = root + search + target
  return url === pathname + search + hash ? null : url
}

/** Rewrite the address bar to the canonical URL (no reload, no history entry). Call before the first render. */
export function normalizeLocation() {
  const url = canonicalUrl(window.location.pathname, window.location.search, window.location.hash, import.meta.env.BASE_URL)
  if (url) history.replaceState(null, '', url)
}

/** Absolute URL of a route on this app, e.g. to open it in a new tab. */
export const routeUrl = (route: Route) => import.meta.env.BASE_URL + href(route)

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
