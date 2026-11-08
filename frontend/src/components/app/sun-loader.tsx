import { useLoaderStore } from '@/store/loader-store'

import { SunMark } from './sun-mark'
import { t } from '@/i18n'

/** Full-screen loader with the animated sun mark, shown while a project opens. */
export function SunLoader() {
  const label = useLoaderStore((s) => s.label)
  if (label === null) return null
  return (
    <div role="status" aria-live="polite" className="sun-loader-in fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background">
      <SunMark animated className="size-16" />
      <div className="text-[13px] font-strong">{label}</div>
      <div className="text-[11px] text-muted-foreground">{t('SolarSketch Virtual Lab')}</div>
    </div>
  )
}
