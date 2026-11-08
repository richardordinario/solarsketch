import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'
import { href, useRoute, type Route } from '@/lib/router'
import { useLabStore } from '@/store/lab-store'

import { SunMark } from '@/components/app/sun-mark'
import { MoonIcon, SaveIcon, SettingsIcon, SunIcon } from './icons'
import { t } from '@/i18n'

/** Main navigation in PRD §2.1 order; Settings is the gear button. */
const NAV: { label: string; route: Route }[] = [
  { label: 'Learn', route: { page: 'learn' } },
  { label: 'Component Library', route: { page: 'components' } },
  { label: 'My Projects', route: { page: 'projects' } },
  { label: 'Challenges', route: { page: 'challenges' } },
  { label: 'Progress', route: { page: 'progress' } },
]

/** The SolarSketch sun mark and name. */
export function Brand() {
  return (
    <>
      <SunMark className="size-5" />
      <div className="text-base font-strong tracking-[-0.01em]">SolarSketch</div>
    </>
  )
}

const iconBtn = 'size-[30px] border-(length:--bw) border-border bg-transparent p-0 hover:bg-muted active:translate-y-0 dark:bg-transparent dark:hover:bg-muted'

export function ThemeButton() {
  const { theme, toggle } = useTheme()
  const label = theme === 'dark' ? t('Switch to light theme') : t('Switch to dark theme')
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="outline" aria-label={label} onClick={toggle} className={iconBtn} />}>{theme === 'dark' ? <SunIcon /> : <MoonIcon />}</TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

export function SaveButton() {
  const save = useLabStore((s) => s.save)
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="outline" aria-label={t('Save')} onClick={save} className={iconBtn} />}>
        <SaveIcon />
      </TooltipTrigger>
      <TooltipContent side="bottom">{t('Save (Ctrl+S)')}</TooltipContent>
    </Tooltip>
  )
}

/** App bar for every page except the Virtual Lab, which has its own LabHeader. */
export function TopBar() {
  const route = useRoute()

  return (
    <header className="flex h-full min-w-0 items-stretch edge-b">
      <div className="flex w-[248px] flex-none items-center gap-2.5 edge-r px-4">
        <Brand />
      </div>

      <nav className="flex h-[46px] min-w-0 flex-1 basis-0 flex-wrap items-stretch overflow-hidden whitespace-nowrap">
        {NAV.map(({ label, route: r }) =>
          r.page === route.page ? (
            <a
              key={label}
              href={href(r)}
              aria-current="page"
              className="flex h-[46px] items-center px-2.5 font-strong text-foreground no-underline shadow-[inset_0_calc(var(--nav-underline)*-1)_0_var(--primary)] hover:text-foreground"
            >
              {t(label)}
            </a>
          ) : (
            <a key={label} href={href(r)} className="flex h-[46px] items-center px-2.5 font-semibold text-muted-foreground no-underline hover:text-foreground">
              {t(label)}
            </a>
          ),
        )}
      </nav>

      <div className="flex min-w-0 items-center gap-3 edge-l px-4">
        <ThemeButton />
        <Tooltip>
          <TooltipTrigger
            render={
              <a
                href={href({ page: 'settings' })}
                aria-label={t('Settings')}
                aria-current={route.page === 'settings' ? 'page' : undefined}
                className={cn('flex items-center justify-center text-foreground no-underline hover:text-foreground', iconBtn, route.page === 'settings' && 'bg-muted')}
              />
            }
          >
            <SettingsIcon />
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('Settings')}</TooltipContent>
        </Tooltip>
        <div className="flex size-[30px] items-center justify-center bg-secondary text-xs font-strong text-secondary-foreground">JR</div>
      </div>
    </header>
  )
}
