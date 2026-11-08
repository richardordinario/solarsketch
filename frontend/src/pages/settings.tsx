import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Notice, Page, PageSection, RowList } from '@/components/app/page'
import { btnGhost, btnOutline, btnPrimary, dialogSurface } from '@/components/app/styles'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LEGAL_DOCS, LEGAL_EFFECTIVE, LEGAL_VERSION } from '@/content/legal'
import { EXPERTISE_OPTIONS, GOAL_OPTIONS, PURPOSE_OPTIONS } from '@/content/profile'
import { CATALOG_VERSION, RULESET_VERSION } from '@/engine/catalog'
import { useTheme } from '@/hooks/use-theme'
import { href } from '@/lib/router'
import { cn } from '@/lib/utils'
import { isStorageAvailable, resetAllData, storageKind, storageUsage } from '@/storage/repository'
import { SIM_STEPS, useLabStore } from '@/store/lab-store'
import { newSampleDocument } from '@/store/persistence'
import { useProfileStore } from '@/store/profile-store'
import { useProgressStore } from '@/store/progress-store'
import { MAX_PROFILE_NAME } from '@/storage/schema'
import { LANGUAGES, t, useLangStore } from '@/i18n'

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(1)} GB`
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="font-strong">{label}</div>
        {hint && <div className="text-[12px] text-pretty text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex h-[30px] edge">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn('cursor-pointer border-0 px-3 font-semibold', on ? 'bg-secondary text-active-fg' : 'bg-transparent text-dim hover:bg-muted')}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function ProfileSelect<T extends string>({ label, value, items, onChange }: { label: string; value: T | undefined; items: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <Select items={items} value={value ?? null} onValueChange={(v) => v != null && onChange(v as T)}>
      <SelectTrigger aria-label={label} className="h-[30px] w-[220px] rounded-none border-(length:--bw) border-border bg-field px-2 text-[13px] font-semibold focus-visible:ring-0 dark:bg-field dark:hover:bg-muted">
        <SelectValue placeholder={t('Not set')} />
      </SelectTrigger>
      <SelectContent className="ring-border">
        {items.map((it) => (
          <SelectItem key={it.value} value={it.value} className="text-[13px]">
            {it.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** The onboarding answers, editable here. Stored on this device only. */
function ProfileSection() {
  const profile = useProfileStore((s) => s.profile)
  const update = useProfileStore((s) => s.update)
  const clear = useProfileStore((s) => s.clear)
  const [name, setName] = useState(profile?.name ?? '')
  if (!profile) return null
  const commitName = () => name.trim() !== profile.name && update({ name: name.trim() })
  return (
    <PageSection title={t('Your profile')} aside={t('Saved on this device only')}>
      <RowList>
        <Row label={t('Name')} hint={t('Used only to greet you in the app.')}>
          <input
            value={name}
            maxLength={MAX_PROFILE_NAME}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder={t('e.g. Juan')}
            aria-label={t('Name')}
            className="h-[30px] w-[220px] edge bg-field px-2 text-[13px] font-semibold outline-none focus-visible:[border-color:var(--primary)]"
          />
        </Row>
        <Row label={t('Expertise')}>
          <ProfileSelect label={t('Expertise')} value={profile.expertise} items={EXPERTISE_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))} onChange={(expertise) => update({ expertise })} />
        </Row>
        <Row label={t('Purpose')}>
          <ProfileSelect label={t('Purpose')} value={profile.purpose} items={PURPOSE_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))} onChange={(purpose) => update({ purpose })} />
        </Row>
        <div className="px-4 py-3">
          <div className="mb-2 font-strong" id="profile-goals">
            {t('What you want to set up')}
          </div>
          <div role="group" aria-labelledby="profile-goals" className="flex flex-wrap gap-1.5">
            {GOAL_OPTIONS.map((o) => {
              const on = profile.goals.includes(o.value)
              return (
                <button
                  key={o.value}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => update({ goals: on ? profile.goals.filter((g) => g !== o.value) : profile.goals.concat([o.value]) })}
                  className={cn('cursor-pointer edge px-2.5 py-1 font-semibold', on ? 'bg-secondary text-active-fg [border-color:var(--primary)]' : 'bg-transparent text-dim hover:bg-muted')}
                >
                  {on ? '✓ ' : ''}
                  {t(o.label)}
                </button>
              )
            })}
          </div>
        </div>
        <Row label={t('Run setup again')} hint={t('Shows the welcome questions again and suggests a new starting point.')}>
          <Button variant="outline" className={btnOutline} onClick={() => void clear()}>
            {t('Run setup again')}
          </Button>
        </Row>
      </RowList>
    </PageSection>
  )
}

type Confirm = 'progress' | 'all' | null

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const lang = useLangStore((s) => s.lang)
  const setLang = useLangStore((s) => s.setLang)
  const settings = useLabStore((s) => s.settings)
  const setSettings = useLabStore((s) => s.setSettings)
  const resetProgress = useProgressStore((s) => s.reset)
  const [confirm, setConfirm] = useState<Confirm>(null)
  // Recompute usage whenever the project autosaves.
  const savedAt = useLabStore((s) => s.savedAt)
  const [usage, setUsage] = useState<{ used: number; quota: number | null } | null>(null)
  useEffect(() => {
    let cancelled = false
    storageUsage().then((u) => !cancelled && setUsage(u))
    return () => {
      cancelled = true
    }
  }, [savedAt])

  const available = isStorageAvailable()
  const used = usage?.used ?? 0
  const quota = usage?.quota ?? null
  const pct = quota ? Math.min(100, (used / quota) * 100) : 0
  const kind = storageKind()
  const onOff = [
    { value: 'on', label: t('On') },
    { value: 'off', label: t('Off') },
  ] as const

  return (
    <Page title={t('Settings')} description={t('Preferences and data are stored in this browser only.')}>
      <ProfileSection />

      <PageSection title={t('Appearance')}>
        <RowList>
          <Row label={t('Theme')} hint={t('Applies to every page.')}>
            <Segmented
              label={t('Theme')}
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'light', label: t('Light') },
                { value: 'dark', label: t('Dark') },
              ]}
            />
          </Row>
          <Row label={t('Language')} hint={t('Interface language. Lesson text, safety rule explanations and validation messages stay in English until a reviewer checks the technical translation.')}>
            <Segmented label={t('Language')} value={lang} onChange={setLang} options={LANGUAGES} />
          </Row>
        </RowList>
      </PageSection>

      <PageSection title={t('Virtual Lab canvas')}>
        <RowList>
          <Row label={t('Show grid')}>
            <Segmented label={t('Show grid')} value={settings.showGrid ? 'on' : 'off'} onChange={(v) => setSettings({ showGrid: v === 'on' })} options={[...onOff]} />
          </Row>
          <Row label={t('Snap to grid')} hint={t('Components move in 10-unit steps.')}>
            <Segmented label={t('Snap to grid')} value={settings.snapToGrid ? 'on' : 'off'} onChange={(v) => setSettings({ snapToGrid: v === 'on' })} options={[...onOff]} />
          </Row>
          <Row label={t('Current flow animation')} hint={t('While the simulation runs, moving dots show the direction of current in each wire. Faster dots mean more current.')}>
            <Segmented label={t('Current flow animation')} value={settings.showFlow ? 'on' : 'off'} onChange={(v) => setSettings({ showFlow: v === 'on' })} options={[...onOff]} />
          </Row>
          <Row label={t('Simulation time step')} hint={t('Simulated minutes per step at ×1 speed. ×4 and ×12 multiply it. Smaller steps give smoother curves; larger steps cover a day faster.')}>
            <Segmented
              label={t('Simulation time step')}
              value={String(settings.simStep)}
              onChange={(v) => setSettings({ simStep: Number(v) as (typeof SIM_STEPS)[number] })}
              options={SIM_STEPS.map((m) => ({ value: String(m), label: t('{m} min', { m }) }))}
            />
          </Row>
          <Row label={t('Wire style')}>
            <Segmented
              label={t('Wire style')}
              value={settings.wireStyle}
              onChange={(v) => setSettings({ wireStyle: v })}
              options={[
                { value: 'orthogonal', label: t('Orthogonal') },
                { value: 'curved', label: t('Curved') },
              ]}
            />
          </Row>
        </RowList>
      </PageSection>

      <PageSection title={t('Data in this browser')}>
        {!available && <Notice tone="warning">{t('Browser storage is unavailable, so nothing is saved between sessions.')}</Notice>}
        <RowList>
          <Row
            label={t('Storage used')}
            hint={
              kind === 'indexeddb'
                ? t('Projects are stored in IndexedDB. The browser decides the quota and may clear data when the device is low on space.')
                : t('Projects are stored in localStorage (about 5 MB per site). Export old projects and delete them if this fills up.')
            }
          >
            <div className="flex w-[220px] flex-col gap-1">
              <div className="h-2 edge bg-field">
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-right text-[12px] text-muted-foreground tabular-nums">
                {formatBytes(used)}
                {quota ? ` ${t('of')} ${formatBytes(quota)}` : ''}
              </div>
            </div>
          </Row>
          <Row label={t('Reset learning progress')} hint={t('Clears lesson completion and challenge attempts. Projects are kept.')}>
            <Button variant="outline" className={btnOutline} disabled={!available} onClick={() => setConfirm('progress')}>
              {t('Reset progress')}
            </Button>
          </Row>
          <Row label={t('Delete all data')} hint={t('Deletes every project, all progress, your profile and all settings in this browser.')}>
            <Button variant="outline" className={btnOutline} disabled={!available} onClick={() => setConfirm('all')}>
              {t('Delete everything')}
            </Button>
          </Row>
        </RowList>
      </PageSection>

      <PageSection title={t('About')}>
        <RowList>
          {(['privacy', 'terms'] as const).map((id) => (
            <Row key={id} label={t(LEGAL_DOCS[id].title)} hint={t('Version {v} · effective {date}', { v: LEGAL_VERSION, date: LEGAL_EFFECTIVE })}>
              <a href={href({ page: id })} className="font-semibold text-foreground underline underline-offset-2">
                {t('Read')}
              </a>
            </Row>
          ))}
          <Row label={t('Versions')}>
            <span className="text-muted-foreground tabular-nums">
              Rules v{RULESET_VERSION} · Catalog {CATALOG_VERSION}
            </span>
          </Row>
          <div className="px-4 py-3 text-[12px] text-pretty text-muted-foreground">
            {t('SolarSketch is an educational simulation. A passing result does not certify an installation as safe, PEC-compliant or professionally approved. Have real installations designed and inspected by qualified professionals.')}
          </div>
        </RowList>
      </PageSection>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent className={dialogSurface}>
          <AlertDialogHeader className="place-items-start text-left">
            <AlertDialogTitle className="text-base font-strong">{t(confirm === 'all' ? 'Delete all SolarSketch data?' : 'Reset learning progress?')}</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-muted-foreground">
              {t(confirm === 'all' ? 'Every project, all progress and all settings in this browser will be deleted. Export any projects you want to keep first.' : 'Lesson completion and challenge attempts will be cleared.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="-mx-5 -mb-5 rounded-none border-t border-rule bg-transparent p-4">
            <AlertDialogCancel className={btnGhost}>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={btnPrimary}
              onClick={async () => {
                const which = confirm
                setConfirm(null)
                if (which === 'all') {
                  // Prevent autosave from writing the open project back.
                  useLabStore.setState({ saved: true })
                  await resetAllData()
                  await resetProgress()
                  // The profile went with the rest of the data, so onboarding shows again.
                  await useProfileStore.getState().clear()
                  useLabStore.getState().loadDocument(newSampleDocument())
                  await useLabStore.getState().persist()
                  toast.success(t('All data deleted. The sample project was reopened.'))
                } else {
                  await resetProgress()
                  toast.success(t('Learning progress reset.'))
                }
              }}
            >
              {t(confirm === 'all' ? 'Delete everything' : 'Reset progress')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  )
}
