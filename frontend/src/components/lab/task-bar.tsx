import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { btnGhost, btnOutline, btnPrimary, dialogSurface } from '@/components/app/styles'
import { useDrawerContent } from '@/hooks/use-drawer-content'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { lessonById } from '@/content/lessons'
import { evaluate, score, taskById, type Evaluation, type Task } from '@/content/tasks'
import { cn } from '@/lib/utils'
import { href, navigate } from '@/lib/router'
import { useLabStore } from '@/store/lab-store'
import { useProgressStore } from '@/store/progress-store'

import { CollapsedRail, PanelToggle, SectionLabel } from './shared'
import { DRAWER_W } from './drawers'
import { t } from '@/i18n'

interface Result {
  ev: Evaluation
  score: number
  diagnosisCorrect: boolean | null
}

function DiagnosisDialog({ task, passed, onSubmit, onCancel }: { task: Task; passed: boolean; onSubmit: (correct: boolean) => void; onCancel: () => void }) {
  const [choice, setChoice] = useState<number | null>(null)
  const d = task.diagnosis!
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className={dialogSurface}>
        <DialogHeader>
          <SectionLabel>{t(passed ? 'All criteria met · one more question' : 'Not every criterion is met yet · one question')}</SectionLabel>
          <DialogTitle className="text-base font-strong">{d.question}</DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground">
            {t(task.kind === 'practice' ? 'Answer correctly to complete the practice.' : 'Your answer counts toward the understanding part of the score, even if the check did not pass.')}
          </DialogDescription>
        </DialogHeader>
        <div role="radiogroup" className="flex flex-col">
          {d.options.map((o, i) => (
            <label key={i} className={cn('flex cursor-pointer items-start gap-2.5 border-b border-rule px-1 py-2 hover:bg-muted', choice === i && 'bg-muted')}>
              <input type="radio" name="diagnosis" className="mt-0.5 accent-(--primary)" checked={choice === i} onChange={() => setChoice(i)} />
              <span className="text-pretty">{o}</span>
            </label>
          ))}
        </div>
        <DialogFooter className="-mx-5 -mb-5 rounded-none border-t border-rule bg-transparent p-4">
          <Button variant="ghost" className={btnGhost} onClick={onCancel}>
            {t('Cancel')}
          </Button>
          <Button className={btnPrimary} disabled={choice === null} onClick={() => onSubmit(choice === d.answer)}>
            {t('Submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResultDialog({ task, result, onClose }: { task: Task; result: Result; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={dialogSurface}>
        <DialogHeader>
          <SectionLabel>{t('Challenge complete')}</SectionLabel>
          <DialogTitle className="text-base font-strong">{task.title}</DialogTitle>
        </DialogHeader>
        <div className="flex items-baseline gap-2 tabular-nums">
          <span className="text-4xl font-strong tracking-[-0.02em] text-primary">{result.score}</span>
          <span className="font-semibold text-muted-foreground">/ 100</span>
        </div>
        <div className="flex flex-col gap-1 text-[12px] text-muted-foreground">
          <div>{t('Correctness: up to 60 points, for {a} of {b} criteria met.', { a: result.ev.met, b: result.ev.total })}</div>
          {result.diagnosisCorrect !== null && <div>{t(result.diagnosisCorrect ? 'Understanding: 20 points, correct diagnosis.' : 'Understanding: 0 points, the diagnosis was not correct.')}</div>}
          <div>{t('Completion: 20 points for meeting every criterion, minus 5 for each earlier unsuccessful check.')}</div>
        </div>
        <DialogFooter className="-mx-5 -mb-5 rounded-none border-t border-rule bg-transparent p-4">
          <Button variant="outline" className={btnOutline} onClick={onClose}>
            {t('Keep exploring')}
          </Button>
          <Button className={btnPrimary} onClick={() => navigate({ page: 'challenges' })}>
            {t('Back to challenges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TaskBar() {
  const taskRef = useLabStore((s) => s.task)
  const nodes = useLabStore((s) => s.nodes)
  const wires = useLabStore((s) => s.wires)
  const faults = useLabStore((s) => s.faults)
  const clearTask = useLabStore((s) => s.clearTask)
  const records = useProgressStore((s) => s.challenges)
  const { addAttempt, markPracticeDone } = useProgressStore.getState()
  const stepsOpen = useLabStore((s) => s.stepsOpen)
  const toggleSteps = useLabStore((s) => s.toggleSteps)
  const [pending, setPending] = useState<Evaluation | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const task = taskRef ? taskById(taskRef.id) : undefined
  const live = useMemo(() => (task ? evaluate(task, nodes, wires, { full: false, faults }) : null), [task, nodes, wires, faults])
  if (!task || !live) return null

  const lesson = task.lessonId ? lessonById(task.lessonId) : undefined
  const failures = (records[task.id]?.attempts ?? []).filter((a) => !a.passed).length

  const finishChallenge = (ev: Evaluation, diagnosisCorrect: boolean | null) => {
    const s = score(ev, diagnosisCorrect, failures)
    addAttempt(task.id, { passed: ev.passed, score: s, met: ev.met, total: ev.total })
    if (ev.passed) setResult({ ev, score: s, diagnosisCorrect })
  }

  const check = () => {
    const ev = evaluate(task, nodes, wires, { full: true, faults })
    if (!ev.passed) {
      if (!stepsOpen) toggleSteps()
      const missing = ev.results.filter((r) => !r.met).map((r) => r.label)
      toast.warning(t('{a} of {b} criteria met. Still to do: {list}.', { a: ev.met, b: ev.total, list: missing.join('; ') }), { duration: 8000 })
      // Understanding counts on every check (PRD §8.3), so a challenge asks its diagnosis question even when it fails.
      if (task.kind === 'challenge') {
        if (task.diagnosis) setPending(ev)
        else finishChallenge(ev, null)
      }
      return
    }
    if (task.kind === 'practice' && task.diagnosis) {
      setPending(ev)
      return
    }
    if (task.kind === 'practice') {
      if (task.lessonId) markPracticeDone(task.lessonId)
      toast.success(t('Practice complete. Every criterion is met.'), {
        action: lesson ? { label: t('Back to lesson'), onClick: () => navigate({ page: 'learn', lessonId: lesson.id }) } : undefined,
      })
      return
    }
    if (task.diagnosis) setPending(ev)
    else finishChallenge(ev, null)
  }

  const backHref = task.kind === 'challenge' ? href({ page: 'challenges', challengeId: task.id }) : lesson ? href({ page: 'learn', lessonId: lesson.id }) : href({ page: 'learn' })

  return (
    <section aria-label={t(task.kind === 'challenge' ? 'Challenge' : 'Practice')} className="edge-b bg-background">
      <div className="flex min-w-0 items-center gap-3 px-3 py-1.5">
        <span className={cn('flex-none px-1.5 py-0.5 text-[10px] font-strong tracking-[.08em] uppercase', task.kind === 'challenge' ? 'bg-primary text-white' : 'bg-secondary text-secondary-foreground')}>
          {t(task.kind === 'challenge' ? 'Challenge' : 'Practice')}
        </span>
        <div className="min-w-0 flex-1 truncate">
          <a href={backHref} className="font-strong text-foreground no-underline hover:underline">
            {task.title}
          </a>
          <span className="text-muted-foreground"> — {task.goal}</span>
        </div>
        <span className="flex-none text-[12px] font-semibold text-muted-foreground tabular-nums">
          {t('{a} / {b} criteria', { a: live.met, b: live.total })}
        </span>
        {!stepsOpen && (
          <Button variant="ghost" className={btnGhost} onClick={toggleSteps}>
            {t('Show steps')}
          </Button>
        )}
        <Button className={btnPrimary} onClick={check}>
          {t(task.kind === 'challenge' ? 'Check solution' : 'Check')}
        </Button>
        <Button
          variant="outline"
          className={btnOutline}
          onClick={() => {
            clearTask()
            toast.info(t('Task closed. The project is kept in My Projects.'))
          }}
        >
          {t('Exit task')}
        </Button>
      </div>
      {pending && (
        <DiagnosisDialog
          task={task}
          passed={pending.passed}
          onCancel={() => {
            // A failed challenge check is still an attempt, recorded without the understanding points.
            if (task.kind === 'challenge' && !pending.passed) finishChallenge(pending, null)
            setPending(null)
          }}
          onSubmit={(correct) => {
            if (task.kind === 'practice') {
              if (correct) {
                if (task.lessonId) markPracticeDone(task.lessonId)
                toast.success(t('Practice complete. Every criterion is met and your answer is correct.'), {
                  action: lesson ? { label: t('Back to lesson'), onClick: () => navigate({ page: 'learn', lessonId: lesson.id }) } : undefined,
                })
              } else toast.warning(t('That answer is not correct. Look at the system again, then press Check to answer once more.'), { duration: 8000 })
            } else finishChallenge(pending, correct)
            setPending(null)
          }}
        />
      )}
      {result && <ResultDialog task={task} result={result} onClose={() => setResult(null)} />}
    </section>
  )
}

/** The open task's steps and live criteria, in their own right drawer beside Details. */
export function StepsPanel() {
  const taskRef = useLabStore((s) => s.task)
  const nodes = useLabStore((s) => s.nodes)
  const wires = useLabStore((s) => s.wires)
  const faults = useLabStore((s) => s.faults)
  const open = useLabStore((s) => s.stepsOpen)
  const toggle = useLabStore((s) => s.toggleSteps)
  const shown = useDrawerContent(open)

  const task = taskRef ? taskById(taskRef.id) : undefined
  const live = useMemo(() => (task && shown ? evaluate(task, nodes, wires, { full: false, faults }) : null), [task, shown, nodes, wires, faults])
  if (!task) return null
  if (!shown || !live) return <CollapsedRail side="right" label={t('Steps')} onExpand={toggle} />

  const deferredIds = new Set(task.criteria.filter((c) => c.deferred).map((c) => c.id))

  return (
    <aside aria-label={t('Steps')} className="relative z-[1] flex min-h-0 flex-none flex-col edge-l bg-background text-[12px]" style={{ width: DRAWER_W.steps }}>
      <div className="flex flex-none items-center edge-b pl-1.5">
        <PanelToggle side="right" open label={t('Steps')} onClick={toggle} />
        <SectionLabel className="ml-1">{t('Steps')}</SectionLabel>
        <span className="mr-3 ml-auto text-[11px] font-semibold text-muted-foreground tabular-nums">{t('{a} / {b} criteria', { a: live.met, b: live.total })}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="px-3 py-2">
          <SectionLabel className="mb-1">{t(task.kind === 'challenge' ? 'Challenge' : 'Practice')}</SectionLabel>
          <ol className="m-0 list-decimal space-y-0.5 pl-5 text-pretty">
            {task.instructions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
        <div className="border-t border-rule px-3 py-2">
          <SectionLabel className="mb-1">{t('Criteria')}</SectionLabel>
          <ul className="m-0 list-none space-y-0.5 p-0">
            {live.results.map((r) => {
              const deferred = deferredIds.has(r.id)
              return (
                <li key={r.id} className="flex items-start gap-2">
                  <span aria-hidden className="w-3 flex-none font-strong" style={{ color: deferred ? 'var(--subtle)' : r.met ? 'var(--term-pe)' : 'var(--muted-foreground)' }}>
                    {deferred ? '–' : r.met ? '✓' : '○'}
                  </span>
                  <span className={cn('text-pretty', r.met && !deferred && 'text-muted-foreground line-through decoration-1')}>
                    {r.label}
                    {deferred && <span className="text-muted-foreground"> ({t('tested when you press Check')})</span>}
                    <span className="sr-only">{` — ${t(deferred ? 'tested on check' : r.met ? 'met' : 'not met')}`}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </aside>
  )
}
