import { useEffect, useState } from 'react'

import { DRAWER_MS } from '@/components/lab/drawers'

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Whether a drawer should render its open content. It turns on at once when the drawer opens and
 * stays on for the closing transition, so the content slides out instead of vanishing first.
 */
export function useDrawerContent(open: boolean) {
  const [closing, setClosing] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)
  // Start the closing phase during render when `open` drops (React's "adjust state on prop change").
  if (open !== wasOpen) {
    setWasOpen(open)
    setClosing(!open && !reducedMotion())
  }
  useEffect(() => {
    if (!closing) return
    const id = setTimeout(() => setClosing(false), DRAWER_MS)
    return () => clearTimeout(id)
  }, [closing])
  return open || closing
}
