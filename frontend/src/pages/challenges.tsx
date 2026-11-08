import { Chip, Notice, Page, PageSection, RowList } from '@/components/app/page'
import { btnPrimary } from '@/components/app/styles'
import { Button } from '@/components/ui/button'
import { componentHref } from '@/components/learn/registry'
import { lessonById } from '@/content/lessons'
import { CHALLENGES, SCORE_PARTS, taskById, type Task } from '@/content/tasks'
import { CATALOG } from '@/engine/catalog'
import { href } from '@/lib/router'
import { bestScore, isLessonComplete, useProgressStore } from '@/store/progress-store'
import { startTask } from '@/store/project-actions'
import { t } from '@/i18n'

function missingPrereqs(task: Task, completed: (id: string) => boolean) {
  return task.prerequisites.filter((id) => !completed(id))
}

function ChallengeList() {
  const progress = useProgressStore((s) => s.progress)
  const records = useProgressStore((s) => s.challenges)
  const completed = (id: string) => isLessonComplete(progress, id)

  return (
    <Page
      title={t('Challenges')}
      description={t('Build, configure, fix and troubleshoot systems in the Virtual Lab, then press Check solution. Scores consider correctness, completion and understanding.')}
    >
      <RowList>
        {CHALLENGES.map((c, i) => {
          const missing = missingPrereqs(c, completed)
          const best = bestScore(records, c.id)
          const attempts = records[c.id]?.attempts.length ?? 0
          const passed = records[c.id]?.attempts.some((a) => a.passed)
          return (
            <a key={c.id} href={href({ page: 'challenges', challengeId: c.id })} className="flex items-start gap-4 px-4 py-3 text-foreground no-underline hover:bg-muted hover:text-foreground">
              <span className="w-6 flex-none pt-0.5 text-[12px] font-strong text-muted-foreground tabular-nums">{String(i + 1).padStart(2, '0')}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-strong">{c.title}</span>
                <span className="block text-pretty text-muted-foreground">{c.goal}</span>
                {missing.length > 0 && <span className="mt-1 block text-[12px] text-muted-foreground">{t('Requires:')} {missing.map((id) => lessonById(id)?.title).join(', ')}</span>}
              </span>
              <span className="flex flex-none flex-col items-end gap-1">
                {missing.length ? <Chip tone="locked">{t('Locked')}</Chip> : passed ? <Chip tone="done">{t('Passed')}</Chip> : <Chip>{t('Open')}</Chip>}
                {best !== null && (
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {t(attempts > 1 ? 'Best {b} · {n} attempts' : 'Best {b} · {n} attempt', { b: best, n: attempts })}
                  </span>
                )}
              </span>
            </a>
          )
        })}
      </RowList>
    </Page>
  )
}

function ChallengeView({ task }: { task: Task }) {
  const progress = useProgressStore((s) => s.progress)
  const records = useProgressStore((s) => s.challenges)
  const missing = missingPrereqs(task, (id) => isLessonComplete(progress, id))
  const attempts = records[task.id]?.attempts ?? []

  return (
    <Page
      eyebrow={t('Challenge')}
      title={task.title}
      description={task.goal}
      actions={
        <>
          <a href={href({ page: 'challenges' })} className="text-[13px] font-semibold">
            {t('All challenges')}
          </a>
          <Button className={btnPrimary} disabled={missing.length > 0} onClick={() => startTask(task)}>
            {t(attempts.length ? 'Start again' : 'Start challenge')}
          </Button>
        </>
      }
    >
      {missing.length > 0 && (
        <Notice tone="warning">
          {t('Complete these lessons first:')}{' '}
          {missing.map((id, i) => (
            <span key={id}>
              {i > 0 && ', '}
              <a href={href({ page: 'learn', lessonId: id })}>{lessonById(id)?.title}</a>
            </span>
          ))}
          .
        </Notice>
      )}

      {task.expectedOutcome && (
        <PageSection title={t('Expected outcome')}>
          <p className="m-0 max-w-[68ch] text-[14px] text-pretty">{task.expectedOutcome}</p>
        </PageSection>
      )}

      <PageSection title={t('Instructions')}>
        <ol className="m-0 space-y-1 pl-5 text-[14px] text-pretty">
          {task.instructions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </PageSection>

      <PageSection title={t('Validation criteria')} aside={t('Checked by the simulation engine')}>
        <RowList>
          {task.criteria.map((c) => (
            <div key={c.id} className="px-4 py-2">
              {c.label}
              {c.deferred && <span className="text-muted-foreground"> {t('(multi-day simulation)')}</span>}
            </div>
          ))}
        </RowList>
      </PageSection>

      <PageSection title={t('Scoring')}>
        <ul className="m-0 max-w-[68ch] space-y-1 pl-5 text-pretty text-muted-foreground">
          <li>{t('Correctness: up to {n} points, in proportion to the criteria met, on every check.', { n: SCORE_PARTS.correctness })}</li>
          <li>{t('Understanding: {n} points for answering the diagnosis question correctly. You answer it on every check, so it counts even before the system is fully solved.', { n: SCORE_PARTS.understanding })}</li>
          <li>{t('Completion: {n} points when every criterion is met, minus 5 for each earlier unsuccessful check.', { n: SCORE_PARTS.completion })}</li>
        </ul>
        <p className="mt-2 mb-0 max-w-[68ch] text-[12px] text-pretty text-muted-foreground">{t('Scores are a learning aid kept in this browser, not a proctored assessment.')}</p>
      </PageSection>

      {task.allowed && (
        <PageSection title={t('Allowed components')} aside={t('The component library is limited to these while the challenge is open.')}>
          <div className="flex flex-wrap gap-1.5">
            {task.allowed
              .filter((type) => CATALOG[type])
              .map((type) => (
                <a key={type} href={componentHref(type)} className="edge px-2 py-0.5 text-[12px] font-semibold text-foreground no-underline hover:bg-muted hover:text-foreground">
                  {CATALOG[type].name}
                </a>
              ))}
          </div>
        </PageSection>
      )}

      <PageSection title={t('Attempt history')} aside={attempts.length ? t(attempts.length > 1 ? '{n} attempts' : '{n} attempt', { n: attempts.length }) : undefined}>
        {attempts.length ? (
          <RowList>
            {attempts
              .slice()
              .reverse()
              .map((a, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_120px_130px] items-center gap-3 px-4 py-2 tabular-nums">
                  <span className="text-muted-foreground">{new Date(a.at).toLocaleString()}</span>
                  <span>{t('{a} of {b} criteria', { a: a.met, b: a.total })}</span>
                  <span className="text-right font-strong" style={{ color: a.passed ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                    {a.passed ? a.score : `${a.score} · ${t('not passed')}`}
                  </span>
                </div>
              ))}
          </RowList>
        ) : (
          <p className="m-0 text-muted-foreground">{t('No attempts yet.')}</p>
        )}
      </PageSection>
    </Page>
  )
}

export function ChallengesPage({ challengeId }: { challengeId?: string }) {
  const task = challengeId ? taskById(challengeId) : undefined
  if (challengeId && (!task || task.kind !== 'challenge')) return <ChallengeList />
  return task ? <ChallengeView task={task} /> : <ChallengeList />
}
