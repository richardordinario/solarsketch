import { useState } from 'react'

import { Chip, Page, PageSection, RowList } from '@/components/app/page'
import { btnOutline, btnPrimary, dialogSurface } from '@/components/app/styles'
import { SectionLabel } from '@/components/lab/shared'
import { LessonMediaBlock } from '@/components/learn/lesson-media'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LESSONS, LEVEL_TITLES, PASS_MARK, lessonById, type Lesson } from '@/content/lessons'
import { taskById } from '@/content/tasks'
import { href } from '@/lib/router'
import { cn } from '@/lib/utils'
import { isLessonComplete, useProgressStore } from '@/store/progress-store'
import { startTask } from '@/store/project-actions'
import { t } from '@/i18n'

function LessonList() {
  const progress = useProgressStore((s) => s.progress)
  const done = LESSONS.filter((l) => isLessonComplete(progress, l.id)).length
  const levels = [...new Set(LESSONS.map((l) => l.level))]

  return (
    <Page
      title={t('Lessons')}
      description={t('Five levels, from solar fundamentals to advanced systems. Each lesson has illustrations, interactive diagrams, a knowledge check and hands-on practice in the Virtual Lab. Progress is saved in this browser.')}
      actions={<span className="text-[13px] font-semibold text-muted-foreground tabular-nums">{t('{a} of {b} completed', { a: done, b: LESSONS.length })}</span>}
    >
      {levels.map((level) => (
        <PageSection
          key={level}
          title={t(LEVEL_TITLES[level])}
          aside={t('{a} of {b} completed', { a: LESSONS.filter((l) => l.level === level && isLessonComplete(progress, l.id)).length, b: LESSONS.filter((l) => l.level === level).length })}
        >
          <RowList>
            {LESSONS.filter((l) => l.level === level).map((l) => {
              const entry = progress.lessons[l.id]
              const n = LESSONS.indexOf(l) + 1
              return (
                <a
                  key={l.id}
                  href={href({ page: 'learn', lessonId: l.id })}
                  className="flex items-start gap-4 px-4 py-3 text-foreground no-underline hover:bg-muted hover:text-foreground"
                >
                  <span className="w-6 flex-none pt-0.5 text-[12px] font-strong text-muted-foreground tabular-nums">{String(n).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-strong">{l.title}</span>
                    <span className="block text-pretty text-muted-foreground">{l.summary}</span>
                  </span>
                  <span className="flex flex-none flex-col items-end gap-1">
                    {entry?.completedAt ? <Chip tone="done">{t('Completed')}</Chip> : <Chip>{t('{n} min', { n: l.minutes })}</Chip>}
                    {entry?.practiceDoneAt && <span className="text-[11px] text-muted-foreground">{t('Practice done')}</span>}
                  </span>
                </a>
              )
            })}
          </RowList>
        </PageSection>
      ))}
    </Page>
  )
}

/** The lesson quiz, shown in a dialog. Each opening starts with fresh answers. */
function KnowledgeCheckDialog({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => lesson.check.map(() => null))
  const [submitted, setSubmitted] = useState(false)
  const completeLesson = useProgressStore((s) => s.completeLesson)
  const completed = useProgressStore((s) => isLessonComplete(s.progress, lesson.id))

  const correct = answers.filter((a, i) => a === lesson.check[i].answer).length
  const ratio = correct / lesson.check.length
  const passed = ratio >= PASS_MARK - 1e-9

  const needed = Math.ceil(PASS_MARK * lesson.check.length)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(dialogSurface, 'flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-2xl')}>
        <DialogHeader className="edge-b px-5 pt-5 pb-3">
          <SectionLabel>{t('Knowledge check')}</SectionLabel>
          <DialogTitle className="text-base font-strong">{lesson.title}</DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground">
            {t('{a} of {b} correct completes the lesson', {
              a: needed,
              b: lesson.check.length,
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto">
          {lesson.check.map((q, qi) => (
            <fieldset key={qi} className="m-0 border-0 border-b border-rule px-5 py-4 last:border-b-0">
              <legend className="float-left mb-2 w-full p-0 text-[14px] font-strong text-pretty">
                {qi + 1}. {q.question}
              </legend>
              <div className="clear-both flex flex-col">
                {q.options.map((o, oi) => {
                  const chosen = answers[qi] === oi
                  const isRight = oi === q.answer
                  return (
                    <label
                      key={oi}
                      className={cn(
                        'flex cursor-pointer items-start gap-2.5 px-2 py-1.5 hover:bg-muted',
                        submitted && chosen && (isRight ? 'bg-muted' : 'bg-row-active'),
                        submitted && 'cursor-default hover:bg-transparent',
                      )}
                    >
                      <input
                        type="radio"
                        name={`q${qi}`}
                        className="mt-0.5 accent-(--primary)"
                        disabled={submitted}
                        checked={chosen}
                        onChange={() => setAnswers((a) => a.map((x, i) => (i === qi ? oi : x)))}
                      />
                      <span className="flex-1 text-pretty">{o}</span>
                      {submitted && isRight && <span className="text-[11px] font-strong text-(--term-pe)">{t('✓ Correct answer')}</span>}
                      {submitted && chosen && !isRight && <span className="text-[11px] font-strong text-critical">{t('× Your answer')}</span>}
                    </label>
                  )
                })}
              </div>
              {submitted && <p className="mt-2 mb-0 text-[12px] text-pretty text-muted-foreground">{q.explanation}</p>}
            </fieldset>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-rule bg-note px-5 py-3">
          {submitted ? (
            <>
              <span className="font-strong tabular-nums">
                {t('{a} of {b} correct.', {
                  a: correct,
                  b: lesson.check.length,
                })}
              </span>
              <span className="text-muted-foreground">
                {passed
                  ? t('Lesson completed.')
                  : t('You need {n} correct to complete the lesson.', {
                      n: needed,
                    })}
              </span>
              <Button
                variant="outline"
                className={cn(btnOutline, 'ml-auto')}
                onClick={() => {
                  setAnswers(lesson.check.map(() => null))
                  setSubmitted(false)
                }}
              >
                {t('Try again')}
              </Button>
              <Button className={btnPrimary} onClick={onClose}>
                {t('Close')}
              </Button>
            </>
          ) : (
            <>
              <span className="text-muted-foreground">
                {t(completed ? 'You have completed this lesson. You can retake the check at any time.' : 'Answer every question, then check your answers.')}
              </span>
              <Button
                className={cn(btnPrimary, 'ml-auto')}
                disabled={answers.some((a) => a === null)}
                onClick={() => {
                  setSubmitted(true)
                  if (passed) completeLesson(lesson.id, ratio)
                }}
              >
                {t('Check answers')}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** The knowledge-check section on the lesson page: status plus a button that opens the quiz dialog. */
function KnowledgeCheck({ lesson }: { lesson: Lesson }) {
  const [open, setOpen] = useState(false)
  const completed = useProgressStore((s) => isLessonComplete(s.progress, lesson.id))
  return (
    <RowList>
      <div className="flex flex-wrap items-center gap-4 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-strong">
            {t(lesson.check.length === 1 ? '{n} question' : '{n} questions', {
              n: lesson.check.length,
            })}
          </div>
          <div className="text-pretty text-muted-foreground">
            {t(completed ? 'You have completed this lesson. You can retake the check at any time.' : 'Answer the short quiz to complete the lesson.')}
          </div>
        </div>
        {completed && <Chip tone="done">{t('Completed')}</Chip>}
        <Button className={btnPrimary} onClick={() => setOpen(true)}>
          {t(completed ? 'Retake quiz' : 'Take the quiz')}
        </Button>
      </div>
      {open && <KnowledgeCheckDialog lesson={lesson} onClose={() => setOpen(false)} />}
    </RowList>
  )
}

function LessonView({ lesson }: { lesson: Lesson }) {
  const progress = useProgressStore((s) => s.progress)
  const idx = LESSONS.indexOf(lesson)
  const next = LESSONS[idx + 1]
  const practiceDone = !!progress.lessons[lesson.id]?.practiceDoneAt

  return (
    <Page
      eyebrow={`${t(LEVEL_TITLES[lesson.level])} · ${t('Lesson {a} of {b}', { a: idx + 1, b: LESSONS.length })}`}
      title={lesson.title}
      description={lesson.summary}
      actions={
        <a href={href({ page: 'learn' })} className="text-[13px] font-semibold">
          {t('All lessons')}
        </a>
      }
    >
      <article className="text-[15px] leading-[1.6]">
        {lesson.sections.map((s) => (
          <section key={s.heading} className="mb-7">
            <h2 className="mt-0 mb-2 text-[18px] font-strong tracking-[-0.01em]">{s.heading}</h2>
            {s.paragraphs.map((p, i) => (
              <p key={i} className="mt-0 mb-3 max-w-[68ch] text-pretty">
                {p}
              </p>
            ))}
            {s.bullets && (
              <ul className="mt-0 mb-3 max-w-[68ch] space-y-1.5 pl-5">
                {s.bullets.map((b, i) => (
                  <li key={i} className="text-pretty">
                    {b}
                  </li>
                ))}
              </ul>
            )}
            {s.example && <div className="mb-4 max-w-[68ch] edge bg-field px-3 py-2.5 text-[14px] font-semibold tabular-nums">{s.example}</div>}
            {s.media?.map((m, i) => (
              <LessonMediaBlock key={i} media={m} />
            ))}
          </section>
        ))}
      </article>

      <PageSection
        title={t('Knowledge check')}
        aside={t('{a} of {b} correct completes the lesson', {
          a: Math.ceil(PASS_MARK * lesson.check.length),
          b: lesson.check.length,
        })}
      >
        <KnowledgeCheck key={lesson.id} lesson={lesson} />
      </PageSection>

      {lesson.practice.length > 0 && (
        <PageSection title={t('Practice in the Virtual Lab')} aside={t(practiceDone ? 'Practice done' : 'Opens as a new project')}>
          <RowList>
            {lesson.practice.map((id) => {
              const task = taskById(id)!
              const missing = task.prerequisites.filter((p) => !isLessonComplete(progress, p))
              return (
                <div key={id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-strong">{task.title}</div>
                    <div className="text-pretty text-muted-foreground">{task.goal}</div>
                    {missing.length > 0 && (
                      <div className="mt-1 text-[12px] text-muted-foreground">
                        {t('Complete these lessons first:')}{' '}
                        {missing.map((p, i) => (
                          <span key={p}>
                            {i > 0 && ', '}
                            <a href={href({ page: 'learn', lessonId: p })}>{lessonById(p)?.title}</a>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {missing.length > 0 && <Chip tone="locked">{t('Locked')}</Chip>}
                  <Button className={btnPrimary} disabled={missing.length > 0} onClick={() => startTask(task)}>
                    {t('Start practice')}
                  </Button>
                </div>
              )
            })}
          </RowList>
        </PageSection>
      )}

      <div className="flex justify-between gap-3 edge-t pt-4">
        {idx > 0 ? <a href={href({ page: 'learn', lessonId: LESSONS[idx - 1].id })}>← {LESSONS[idx - 1].title}</a> : <span />}
        {next ? <a href={href({ page: 'learn', lessonId: next.id })}>{next.title} →</a> : <a href={href({ page: 'challenges' })}>{t('Try the challenges →')}</a>}
      </div>
    </Page>
  )
}

export function LearnPage({ lessonId }: { lessonId?: string }) {
  const lesson = lessonId ? lessonById(lessonId) : undefined
  if (lessonId && !lesson)
    return (
      <Page title={t('Lesson not found')}>
        <SectionLabel>
          <a href={href({ page: 'learn' })}>{t('Back to lessons')}</a>
        </SectionLabel>
      </Page>
    )
  return lesson ? <LessonView lesson={lesson} /> : <LessonList />
}
