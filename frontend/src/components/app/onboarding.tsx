import { CheckIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { btnGhost, btnOutline, btnPrimary, dialogSurface } from '@/components/app/styles'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { LEGAL_DOCS, LEGAL_EFFECTIVE, LEGAL_VERSION } from '@/content/legal'
import { LESSONS } from '@/content/lessons'
import { EXPERTISE_OPTIONS, GOAL_OPTIONS, PURPOSE_OPTIONS, recommend } from '@/content/profile'
import { TEMPLATES } from '@/engine/sample-project'
import { cn } from '@/lib/utils'
import { href, navigateUnguarded, parseHash } from '@/lib/router'
import { isStorageAvailable } from '@/storage/repository'
import { MAX_PROFILE_NAME, type Expertise, type Goal, type Profile, type Purpose } from '@/storage/schema'
import { useLabStore } from '@/store/lab-store'
import { useProfileStore } from '@/store/profile-store'
import { newFromTemplate } from '@/store/project-actions'
import { LANGUAGES, useLangStore, useT } from '@/i18n'
import { LegalBody } from '@/pages/legal'

const STEPS = ['welcome', 'name', 'expertise', 'purpose', 'done'] as const
type Step = (typeof STEPS)[number]

/** A selectable card. The check mark shows the state without relying on colour. */
function Choice({ on, multi, label, hint, onClick }: { on: boolean; multi?: boolean; label: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={on}
      onClick={onClick}
      className={cn('flex w-full cursor-pointer items-start gap-2.5 edge px-3 py-2 text-left', on ? 'bg-secondary text-active-fg [border-color:var(--primary)]' : 'bg-transparent text-foreground hover:bg-muted')}
    >
      <span className={cn('mt-0.5 flex size-4 flex-none items-center justify-center edge', on && 'border-primary bg-primary text-white', !multi && 'rounded-full')} aria-hidden>
        {on && <CheckIcon className="size-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block font-strong">{label}</span>
        <span className="block text-[12px] text-pretty opacity-75">{hint}</span>
      </span>
    </button>
  )
}

function Heading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-4">
      <DialogTitle className="m-0 text-[20px] leading-tight font-strong tracking-[-0.01em]">{title}</DialogTitle>
      {children && <DialogDescription className="mt-1.5 text-[13px] text-pretty text-muted-foreground">{children}</DialogDescription>}
    </div>
  )
}

const nowIso = () => new Date().toISOString()

/** Buttons that expand the Privacy Policy or Terms of Service inline, in a scrollable box. */
function LegalReader() {
  const T = useT()
  const lang = useLangStore((s) => s.lang)
  const [reading, setReading] = useState<'privacy' | 'terms' | null>(null)
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {(['privacy', 'terms'] as const).map((id) => (
          <Button key={id} variant="outline" aria-expanded={reading === id} aria-controls="legal-reader" className={cn(btnOutline, reading === id && 'bg-secondary text-active-fg')} onClick={() => setReading(reading === id ? null : id)}>
            {reading === id ? T('Hide the {title}', { title: T(LEGAL_DOCS[id].title) }) : T('Read the {title}', { title: T(LEGAL_DOCS[id].title) })}
          </Button>
        ))}
      </div>
      {reading && (
        <div id="legal-reader" tabIndex={0} role="region" aria-label={T(LEGAL_DOCS[reading].title)} className="mt-2 max-h-[260px] overflow-auto edge bg-field px-3 py-2.5 text-left outline-none focus-visible:[border-color:var(--primary)]">
          <div className="mb-2 text-[12px] font-semibold text-pretty">{LEGAL_DOCS[reading].summary}</div>
          {lang !== 'en' && <div className="mb-2 text-[11px] text-muted-foreground">{T('This document is available in English only.')}</div>}
          <LegalBody doc={LEGAL_DOCS[reading]} compact />
        </div>
      )}
    </>
  )
}

/** Leaves the lab without its exit prompt: the open project is saved first. */
async function go(to: string) {
  if (parseHash(window.location.hash).page === 'lab') await useLabStore.getState().persist()
  navigateUnguarded(to)
}

/**
 * First-run onboarding: privacy and educational-use notice, name, expertise, purpose and goals,
 * then a suggested starting point. Shown until the user finishes or skips it (Settings can run it again).
 */
export function Onboarding() {
  const profile = useProfileStore((s) => s.profile)
  if (!profile) return <OnboardingDialog />
  if (profile.legalVersion !== LEGAL_VERSION) return <LegalUpdateDialog />
  return null
}

/** Shown to people who finished setup before the current Privacy Policy and Terms of Service. */
function LegalUpdateDialog() {
  const T = useT()
  const profile = useProfileStore((s) => s.profile)!
  const save = useProfileStore((s) => s.save)
  const [accepted, setAccepted] = useState(false)
  const updated = profile.legalVersion !== undefined
  return (
    <Dialog open onOpenChange={() => undefined} disablePointerDismissal>
      <DialogContent showCloseButton={false} className={cn(dialogSurface, 'max-h-[calc(100dvh-2rem)] gap-0 overflow-auto sm:max-w-[600px]')}>
        <Heading title={updated ? T('We updated the Privacy Policy and Terms of Service') : T('Please review the Privacy Policy and Terms of Service')}>
          {T('Version {v} · effective {date}', { v: LEGAL_VERSION, date: LEGAL_EFFECTIVE })}. {T('Nothing about where your data is stored has changed: it stays in this browser on this device.')}
        </Heading>
        <section className="mb-4">
          <LegalReader />
        </section>
        <label className="flex cursor-pointer items-start gap-2 font-semibold">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 size-4 accent-(--primary)" />
          <span>{T('I have read and agree to the Terms of Service and the Privacy Policy.')}</span>
        </label>
        <div className="-mx-5 mt-5 -mb-5 flex items-center justify-end border-t border-rule p-4">
          <Button className={btnPrimary} disabled={!accepted} onClick={() => save({ ...profile, noticeAcceptedAt: nowIso(), legalVersion: LEGAL_VERSION })}>
            {T('I agree, continue')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function OnboardingDialog() {
  const T = useT()
  const lang = useLangStore((s) => s.lang)
  const setLang = useLangStore((s) => s.setLang)
  const save = useProfileStore((s) => s.save)
  const [step, setStep] = useState<Step>('welcome')
  const [accepted, setAccepted] = useState(false)
  const [acceptedAt, setAcceptedAt] = useState('')
  const [name, setName] = useState('')
  const [expertise, setExpertise] = useState<Expertise | undefined>()
  const [purpose, setPurpose] = useState<Purpose | undefined>()
  const [goals, setGoals] = useState<Goal[]>([])

  const i = STEPS.indexOf(step)
  const next = () => setStep(STEPS[Math.min(i + 1, STEPS.length - 1)])
  const back = () => setStep(STEPS[Math.max(i - 1, 0)])
  const nick = name.trim()
  const rec = recommend({ expertise, goals })
  const lesson = rec.lessonId ? LESSONS.find((l) => l.id === rec.lessonId) : null
  const template = rec.templateId ? TEMPLATES.find((x) => x.id === rec.templateId) : null

  const finish = (then?: () => void) => {
    const now = nowIso()
    const p: Profile = { name: nick.slice(0, MAX_PROFILE_NAME), expertise, purpose, goals, onboardedAt: now, noticeAcceptedAt: acceptedAt || now, legalVersion: LEGAL_VERSION }
    save(p)
    then?.()
  }

  const toggleGoal = (g: Goal) => setGoals((gs) => (gs.includes(g) ? gs.filter((x) => x !== g) : gs.concat([g])))

  let body: ReactNode
  if (step === 'welcome')
    body = (
      <>
        <Heading title={T('Welcome to SolarSketch')}>{T('A virtual lab for learning solar PV installation. A few quick questions help us suggest where to start. It takes about a minute.')}</Heading>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="font-strong">{T('Language')}</span>
          <div role="radiogroup" aria-label={T('Language')} className="flex h-[30px] edge">
            {LANGUAGES.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={lang === o.value}
                onClick={() => setLang(o.value)}
                className={cn('cursor-pointer border-0 px-3 font-semibold', lang === o.value ? 'bg-secondary text-active-fg' : 'bg-transparent text-dim hover:bg-muted')}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <section className="mb-3 [border:var(--note-border)] bg-note px-3 py-2.5 text-[12px] text-pretty text-note-fg">
          <div className="mb-1 font-strong">{T('Your data stays on this device')}</div>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-4">
            <li>{T('Your answers, projects and progress are saved only in this browser on this device. Nothing is uploaded to a cloud or a server, and there is no account.')}</li>
            <li>{T('Clearing this browser’s site data, or using a private window, deletes them. Export projects from My Projects to keep a copy or move them to another device.')}</li>
            <li>{T('You can change or delete your answers anytime in Settings.')}</li>
          </ul>
        </section>
        {!isStorageAvailable() && (
          <div className="mb-3 [border:var(--fix-border)] bg-(--fix-bg) px-3 py-2 text-[12px] font-semibold">{T('Browser storage is unavailable, so nothing is saved between sessions.')}</div>
        )}
        <section className="mb-4 edge px-3 py-2.5 text-[12px] text-pretty text-muted-foreground">
          <div className="mb-1 font-strong text-foreground">{T('For learning only')}</div>
          {T('SolarSketch is an educational simulation. A passing result does not certify an installation as safe, PEC-compliant or professionally approved. Have real installations designed and inspected by qualified professionals.')}
        </section>
        <section className="mb-4">
          <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-strong">{T('Privacy Policy and Terms of Service')}</span>
            <span className="text-[11px] text-muted-foreground">{T('Version {v} · effective {date}', { v: LEGAL_VERSION, date: LEGAL_EFFECTIVE })}</span>
          </div>
          <LegalReader />
        </section>
        <label className="flex cursor-pointer items-start gap-2 font-semibold">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 size-4 accent-(--primary)" />
          <span>{T('I have read and agree to the Terms of Service and the Privacy Policy. I understand that my data is stored only on this device and that SolarSketch is for learning only.')}</span>
        </label>
      </>
    )
  else if (step === 'name')
    body = (
      <>
        <Heading title={T('What should we call you?')}>{T('A first name or nickname. It is only used to greet you in the app, and you can leave it empty.')}</Heading>
        <input
          autoFocus
          value={name}
          maxLength={MAX_PROFILE_NAME}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && next()}
          placeholder={T('e.g. Juan')}
          aria-label={T('Your name')}
          autoComplete="given-name"
          className="h-9 w-full edge bg-field px-2.5 text-[14px] font-semibold outline-none focus-visible:[border-color:var(--primary)]"
        />
      </>
    )
  else if (step === 'expertise')
    body = (
      <>
        <Heading title={nick ? T('Hi {name}! How much do you know about electrical work?', { name: nick }) : T('How much do you know about electrical work?')}>
          {T('This sets where your lessons start. You can still open any lesson.')}
        </Heading>
        <div role="radiogroup" aria-label={T('Expertise')} className="flex flex-col gap-2">
          {EXPERTISE_OPTIONS.map((o) => (
            <Choice key={o.value} on={expertise === o.value} label={T(o.label)} hint={T(o.hint)} onClick={() => setExpertise(o.value)} />
          ))}
        </div>
      </>
    )
  else if (step === 'purpose')
    body = (
      <>
        <Heading title={T('What are you learning solar for?')} />
        <div role="radiogroup" aria-label={T('Purpose')} className="mb-5 grid gap-2 sm:grid-cols-2">
          {PURPOSE_OPTIONS.map((o) => (
            <Choice key={o.value} on={purpose === o.value} label={T(o.label)} hint={T(o.hint)} onClick={() => setPurpose(o.value)} />
          ))}
        </div>
        <div className="mb-2 font-strong" id="goals-label">
          {T('What do you want to set up? Choose any that apply.')}
        </div>
        <div role="group" aria-labelledby="goals-label" className="grid gap-2 sm:grid-cols-2">
          {GOAL_OPTIONS.map((o) => (
            <Choice key={o.value} multi on={goals.includes(o.value)} label={T(o.label)} hint={T(o.hint)} onClick={() => toggleGoal(o.value)} />
          ))}
        </div>
      </>
    )
  else
    body = (
      <>
        <Heading title={nick ? T('You are all set, {name}!', { name: nick }) : T('You are all set!')}>{T('Here is a suggested place to start. You can change your answers later in Settings.')}</Heading>
        <div className="flex flex-col gap-2">
          {lesson ? (
            <Button className={cn(btnPrimary, 'h-auto justify-start py-2 text-left whitespace-normal')} onClick={() => finish(() => void go(href({ page: 'learn', lessonId: lesson.id })))}>
              {T('Start lesson: {title}', { title: lesson.title })}
            </Button>
          ) : (
            <Button className={cn(btnPrimary, 'h-auto justify-start py-2 text-left whitespace-normal')} onClick={() => finish(() => void go(href({ page: 'challenges' })))}>
              {T('Try the troubleshooting challenges')}
            </Button>
          )}
          {template && (
            <Button variant="outline" className={cn(btnOutline, 'h-auto justify-start py-2 text-left whitespace-normal')} onClick={() => finish(() => void newFromTemplate(template.id))}>
              {T('Open the template “{name}” in the Virtual Lab', { name: template.name })}
            </Button>
          )}
          <Button
            variant="outline"
            className={cn(btnOutline, 'h-auto justify-start py-2 text-left whitespace-normal')}
            onClick={() => finish(() => parseHash(window.location.hash).page !== 'lab' && void go(href({ page: 'lab' })))}
          >
            {T('Explore the Virtual Lab on my own')}
          </Button>
        </div>
        {purpose === 'work' && (
          <p className="mt-4 mb-0 text-[12px] text-pretty text-muted-foreground">
            {T('For real jobs, follow the Philippine Electrical Code, the manufacturers’ instructions and your licensed supervising engineer or electrician. SolarSketch helps you practise, not certify.')}
          </p>
        )}
      </>
    )

  return (
    <Dialog open onOpenChange={() => undefined} disablePointerDismissal>
      <DialogContent showCloseButton={false} className={cn(dialogSurface, 'max-h-[calc(100dvh-2rem)] gap-0 overflow-auto sm:max-w-[600px]')}>
        <div className="mb-3 flex items-center gap-1.5" aria-label={T('Step {n} of {total}', { n: i + 1, total: STEPS.length })}>
          {STEPS.map((s, k) => (
            <span key={s} className={cn('h-1 flex-1', k <= i ? 'bg-primary' : 'bg-muted')} aria-hidden />
          ))}
        </div>
        <div className="mb-3 text-[11px] font-semibold tracking-[.05em] text-muted-foreground uppercase">{T('Step {n} of {total}', { n: i + 1, total: STEPS.length })}</div>
        {body}
        {step !== 'done' && (
          <div className="-mx-5 mt-5 -mb-5 flex items-center gap-2 border-t border-rule p-4">
            {i > 0 && (
              <Button variant="ghost" className={btnGhost} onClick={back}>
                {T('Back')}
              </Button>
            )}
            <div className="flex-1" />
            {i > 0 && (
              <Button variant="ghost" className={btnGhost} onClick={() => finish()}>
                {T('Skip setup')}
              </Button>
            )}
            <Button
              className={btnPrimary}
              disabled={step === 'welcome' && !accepted}
              onClick={() => {
                if (step === 'welcome') setAcceptedAt(nowIso())
                next()
              }}
            >
              {step === 'welcome' ? T('I agree, continue') : T('Continue')}
            </Button>
          </div>
        )}
        {step === 'done' && (
          <div className="-mx-5 mt-5 -mb-5 flex items-center border-t border-rule p-4">
            <Button variant="ghost" className={btnGhost} onClick={back}>
              {T('Back')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
