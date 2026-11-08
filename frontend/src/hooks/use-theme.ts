import { useCallback, useSyncExternalStore } from 'react'

import { updateSettings } from '@/storage/repository'

export type Theme = 'light' | 'dark'

function current(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

const listeners = new Set<() => void>()
function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Light/dark theme, saved in `solarsketch:settings`. The initial class is applied by an
 * inline script in index.html (before first paint) from the same key.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, current)
  const setTheme = useCallback((t: Theme) => {
    document.documentElement.classList.toggle('dark', t === 'dark')
    try {
      updateSettings({ theme: t })
    } catch {
      // Storage full or unavailable: the theme still applies for this session.
    }
    listeners.forEach((fn) => fn())
  }, [])
  const toggle = useCallback(() => setTheme(current() === 'dark' ? 'light' : 'dark'), [setTheme])
  return { theme, setTheme, toggle }
}
