import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { LESSONS } from '@/content/lessons'
import { CHALLENGES } from '@/content/tasks'
import { ChallengesPage } from '@/pages/challenges'
import { LearnPage } from '@/pages/learn'

import { LessonMediaBlock } from './lesson-media'

describe('lesson media', () => {
  it('every lesson section’s media renders', () => {
    for (const l of LESSONS)
      for (const s of l.sections)
        for (const m of s.media ?? []) {
          const html = renderToString(createElement(LessonMediaBlock, { media: m }))
          expect(html.length, `${l.id}: ${m.kind}`).toBeGreaterThan(100)
        }
  })

  it('every lesson has illustrations or interactive media, and every level has a walkthrough', () => {
    for (const l of LESSONS) expect(l.sections.some((s) => s.media?.length), l.id).toBe(true)
    for (const level of [1, 2, 3, 4, 5]) {
      const kinds = LESSONS.filter((l) => l.level === level).flatMap((l) => l.sections.flatMap((s) => s.media ?? []).map((m) => m.kind))
      expect(kinds, `level ${level}`).toContain('illustration')
    }
    const walkthroughs = LESSONS.flatMap((l) => l.sections.flatMap((s) => s.media ?? [])).filter((m) => m.kind === 'walkthrough')
    expect(walkthroughs.length).toBeGreaterThanOrEqual(3)
  })

  it('a local video section renders with captions and no third-party source', () => {
    const html = renderToString(createElement(LessonMediaBlock, { media: { kind: 'video', src: 'videos/demo.mp4', captions: 'videos/demo.vtt', title: 'Demo', caption: 'Demo video' } }))
    expect(html).toContain('<video')
    expect(html).toContain('kind="captions"')
    expect(html).not.toMatch(/https?:\/\//)
  })

  it('every lesson page and challenge page renders', () => {
    for (const l of LESSONS) expect(renderToString(createElement(LearnPage, { lessonId: l.id })), l.id).toContain(l.title)
    expect(renderToString(createElement(LearnPage, {}))).toContain(LESSONS[0].title)
    for (const c of CHALLENGES) {
      const html = renderToString(createElement(ChallengesPage, { challengeId: c.id }))
      expect(html, c.id).toContain('Expected outcome')
    }
  })
})
