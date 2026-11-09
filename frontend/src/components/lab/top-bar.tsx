import { BoxesIcon, ChartNoAxesColumnIcon, FolderOpenIcon, GraduationCapIcon, TrophyIcon, UserIcon, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'
import { href, useRoute, type Route } from '@/lib/router'
import { useLabStore } from '@/store/lab-store'
import { initials } from '@/content/profile'
import { useProfileStore } from '@/store/profile-store'

import { SunMark } from '@/components/app/sun-mark'
import { MoonIcon, SaveIcon, SettingsIcon, SunIcon } from './icons'
import { t } from '@/i18n'

/** Main navigation, shown as icons with hover labels (Component Library last, at the right); Settings is the gear button. */
const NAV: { label: string; route: Route; Icon: LucideIcon }[] = [
  { label: 'Learn', route: { page: 'learn' }, Icon: GraduationCapIcon },
  { label: 'My Projects', route: { page: 'projects' }, Icon: FolderOpenIcon },
  { label: 'Challenges', route: { page: 'challenges' }, Icon: TrophyIcon },
  { label: 'Progress', route: { page: 'progress' }, Icon: ChartNoAxesColumnIcon },
  { label: 'Component Library', route: { page: 'components' }, Icon: BoxesIcon },
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

/** The user's initials (from Settings → Name), or a person icon when no name is set. Opens Settings. */
function ProfileBadge() {
  const name = useProfileStore((s) => s.profile?.name ?? '')
  const ini = initials(name)
  const label = name.trim() ? t('Hi, {name}', { name: name.trim() }) : t('Your profile')
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            href={href({ page: 'settings' })}
            aria-label={label}
            className="flex size-[30px] items-center justify-center bg-secondary text-xs font-strong text-secondary-foreground no-underline hover:text-secondary-foreground"
          />
        }
      >
        {ini || <UserIcon className="size-4" aria-hidden />}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

/** App bar for every page except the Virtual Lab, which has its own LabHeader. */
export function TopBar() {
  const route = useRoute()

  return (
    <header className="flex h-full min-w-0 items-stretch edge-b">
      <a href={href({ page: 'landing' })} aria-label={t('SolarSketch home')} className="flex w-[248px] flex-none items-center gap-2.5 edge-r px-4 text-foreground no-underline">
        <Brand />
      </a>

      <nav aria-label={t('Main')} className="flex h-[46px] min-w-0 flex-1 basis-0 items-stretch overflow-hidden px-1.5">
        {NAV.map(({ label, route: r, Icon }) => {
          const current = r.page === route.page
          return (
            <Tooltip key={label}>
              <TooltipTrigger
                render={
                  <a
                    href={href(r)}
                    aria-label={t(label)}
                    aria-current={current ? 'page' : undefined}
                    className={cn(
                      'flex h-[46px] w-9 items-center justify-center no-underline hover:bg-muted hover:text-foreground',
                      current ? 'text-foreground shadow-[inset_0_calc(var(--nav-underline)*-1)_0_var(--primary)]' : 'text-muted-foreground',
                    )}
                  />
                }
              >
                <Icon className="size-4" strokeWidth={current ? 2.25 : 2} aria-hidden />
              </TooltipTrigger>
              <TooltipContent side="bottom">{t(label)}</TooltipContent>
            </Tooltip>
          )
        })}
      </nav>

      {/* Smaller icons on the app bar (the lab header keeps its 18px toolbar icons). */}
      <div className="flex min-w-0 items-center gap-3 edge-l px-4 [&_svg]:size-4">
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
        <ProfileBadge />
      </div>
    </header>
  )
}
