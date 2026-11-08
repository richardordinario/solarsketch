import { describe, expect, it } from 'vitest'

import { TEMPLATES } from '@/engine/sample-project'

import { LESSONS } from './lessons'
import { initials, recommend } from './profile'

describe('onboarding recommendation', () => {
  it('starts each expertise level at an existing lesson, or the challenges', () => {
    expect(recommend({ expertise: 'new', goals: [] }).lessonId).toBe('electricity-basics')
    expect(recommend({ expertise: 'beginner', goals: [] }).lessonId).toBe('solar-basics')
    expect(recommend({ expertise: undefined, goals: [] }).lessonId).toBe('solar-basics')
    expect(recommend({ expertise: 'intermediate', goals: [] }).lessonId).toBe('system-types')
    expect(recommend({ expertise: 'intermediate', goals: ['troubleshooting'] }).lessonId).toBeNull()
    expect(recommend({ expertise: 'professional', goals: [] }).lessonId).toBeNull()
    for (const e of ['new', 'beginner', 'intermediate'] as const) {
      const id = recommend({ expertise: e, goals: [] }).lessonId
      expect(LESSONS.some((l) => l.id === id)).toBe(true)
    }
  })

  it('suggests the template for the first goal that has one', () => {
    expect(recommend({ expertise: 'beginner', goals: ['basics', 'grid-tied', 'off-grid'] }).templateId).toBe('grid-tied')
    expect(recommend({ expertise: 'beginner', goals: ['basics'] }).templateId).toBeNull()
    for (const g of ['off-grid', 'grid-tied', 'hybrid', 'small-dc'] as const) {
      const id = recommend({ expertise: 'beginner', goals: [g] }).templateId
      expect(TEMPLATES.some((x) => x.id === id)).toBe(true)
    }
  })
})

describe('profile initials', () => {
  it('uses the first and last word, uppercased', () => {
    expect(initials('Juan dela Cruz')).toBe('JC')
    expect(initials('  ana  ')).toBe('A')
    expect(initials('ñino reyes')).toBe('ÑR')
    expect(initials('')).toBe('')
    expect(initials('   ')).toBe('')
  })
})
