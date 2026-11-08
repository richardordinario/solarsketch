import { InfoIcon, OctagonAlertIcon, TriangleAlertIcon } from 'lucide-react'

import type { Severity } from '@/engine/types'
import { cn } from '@/lib/utils'

const ICONS = { critical: OctagonAlertIcon, warning: TriangleAlertIcon, info: InfoIcon }

/** Severity icon: a different shape per level, so findings don't rely on colour alone. Inherits the text colour. */
export function SevIcon({ sev, className }: { sev: Severity; className?: string }) {
  const Glyph = ICONS[sev]
  return <Glyph aria-hidden className={cn('inline-block size-3.5 flex-none align-[-2px]', className)} strokeWidth={2} />
}
