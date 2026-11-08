import { Chip, Page, PageSection, RowList } from '@/components/app/page'
import { LESSONS } from '@/content/lessons'
import { CHALLENGES } from '@/content/tasks'
import { href } from '@/lib/router'
import { useProfileStore } from '@/store/profile-store'
import { bestScore, isLessonComplete, useProgressStore } from '@/store/progress-store'
import { t } from '@/i18n'

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="truncate text-[10px] font-semibold tracking-[.05em] text-muted-foreground uppercase">{label}</div>
      <div className="text-[26px] font-strong tracking-[-0.02em] tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  )
}

export function ProgressPage() {
  const progress = useProgressStore((s) => s.progress)
  const records = useProgressStore((s) => s.challenges)
  const name = useProfileStore((s) => s.profile?.name)

  const lessonsDone = LESSONS.filter((l) => isLessonComplete(progress, l.id)).length
  const practiceDone = LESSONS.filter((l) => progress.lessons[l.id]?.practiceDoneAt).length
  const passed = CHALLENGES.filter((c) => records[c.id]?.attempts.some((a) => a.passed)).length
  const attempts = CHALLENGES.reduce((a, c) => a + (records[c.id]?.attempts.length ?? 0), 0)
  const bests = CHALLENGES.map((c) => bestScore(records, c.id)).filter((x): x is number => x !== null)
  const avg = bests.length ? Math.round(bests.reduce((a, b) => a + b, 0) / bests.length) : null

  return (
    <Page eyebrow={name ? t('Hi, {name}', { name }) : undefined} title={t('Your progress')} description={t('Lesson completion, practice and challenge scores recorded in this browser.')}>
      <div className="mb-8 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] edge [&>*+*]:border-l [&>*+*]:border-rule">
        <Stat label={t('Lessons completed')} value={`${lessonsDone}/${LESSONS.length}`} sub={t('Knowledge check passed')} />
        <Stat label={t('Practice done')} value={`${practiceDone}/${LESSONS.length}`} sub={t('Lessons with practice complete')} />
        <Stat label={t('Challenges passed')} value={`${passed}/${CHALLENGES.length}`} sub={t(attempts === 1 ? '{n} attempt in total' : '{n} attempts in total', { n: attempts })} />
        <Stat label={t('Average best score')} value={avg === null ? '—' : String(avg)} sub={t('Across attempted challenges')} />
      </div>

      <PageSection title={t('Lessons')}>
        <RowList>
          {LESSONS.map((l) => {
            const e = progress.lessons[l.id]
            return (
              <div key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-4 py-2.5">
                <a href={href({ page: 'learn', lessonId: l.id })} className="truncate font-semibold">
                  {l.title}
                </a>
                <span className="text-[12px] text-muted-foreground tabular-nums">{e?.checkScore != null ? t('Check {p}%', { p: Math.round(e.checkScore * 100) }) : ''}</span>
                <span className="flex gap-1.5">
                  {e?.completedAt ? <Chip tone="done">{t('Completed')}</Chip> : <Chip>{t('Not started')}</Chip>}
                  {e?.practiceDoneAt && <Chip>{t('Practice')}</Chip>}
                </span>
              </div>
            )
          })}
        </RowList>
      </PageSection>

      <PageSection title={t('Challenges')}>
        <RowList>
          {CHALLENGES.map((c) => {
            const best = bestScore(records, c.id)
            const n = records[c.id]?.attempts.length ?? 0
            const ok = records[c.id]?.attempts.some((a) => a.passed)
            return (
              <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-4 py-2.5">
                <a href={href({ page: 'challenges', challengeId: c.id })} className="truncate font-semibold">
                  {c.title}
                </a>
                <span className="text-[12px] text-muted-foreground tabular-nums">{n ? t(n > 1 ? '{n} attempts · best {b}' : '{n} attempt · best {b}', { n, b: best ?? 0 }) : ''}</span>
                {ok ? <Chip tone="done">{t('Passed')}</Chip> : n ? <Chip>{t('In progress')}</Chip> : <Chip>{t('Not started')}</Chip>}
              </div>
            )
          })}
        </RowList>
      </PageSection>
    </Page>
  )
}
