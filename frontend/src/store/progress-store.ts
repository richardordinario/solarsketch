import { create } from 'zustand'

import { getChallengeRecords, getProgress, isStorageAvailable, recordAttempt, resetProgress, updateLessonProgress } from '@/storage/repository'
import type { Attempt, ChallengeRecords, Progress } from '@/storage/schema'
import { t } from '@/i18n'

import { reportWriteError } from './storage-toast'

interface ProgressState {
  progress: Progress
  challenges: ChallengeRecords
  completeLesson: (lessonId: string, checkScore: number) => void
  markPracticeDone: (lessonId: string) => void
  /** Records an attempt stamped with the current time. */
  addAttempt: (challengeId: string, attempt: Omit<Attempt, 'at'>) => void
  /** Load from storage (called at boot). */
  reload: () => Promise<void>
  reset: () => Promise<void>
}

/**
 * Background write. The in-memory state stays correct for this session if it fails; the failure is
 * reported once (storage full gets export / My Projects actions). Without storage at all, the
 * banner already says nothing is saved, so stay quiet.
 */
const background = (p: Promise<unknown>) =>
  void p.catch((e) => {
    if (isStorageAvailable()) reportWriteError(e, t('Your progress could not be saved in this browser.'), 'progress-save-failed')
  })

/** Reactive mirror of lesson progress and challenge attempts in browser storage. */
export const useProgressStore = create<ProgressState>()((set) => ({
  progress: { lessons: {} },
  challenges: {},
  completeLesson: (lessonId, checkScore) => {
    const now = new Date().toISOString()
    set((s) => {
      const prev = s.progress.lessons[lessonId] ?? {}
      const entry = { ...prev, checkScore: Math.max(checkScore, prev.checkScore ?? 0), completedAt: prev.completedAt ?? now }
      background(updateLessonProgress(lessonId, entry))
      return { progress: { lessons: { ...s.progress.lessons, [lessonId]: entry } } }
    })
  },
  markPracticeDone: (lessonId) => {
    const now = new Date().toISOString()
    set((s) => {
      const entry = { ...s.progress.lessons[lessonId], practiceDoneAt: s.progress.lessons[lessonId]?.practiceDoneAt ?? now }
      background(updateLessonProgress(lessonId, entry))
      return { progress: { lessons: { ...s.progress.lessons, [lessonId]: entry } } }
    })
  },
  addAttempt: (challengeId, input) => {
    const attempt = { ...input, at: new Date().toISOString() }
    background(recordAttempt(challengeId, attempt))
    set((s) => {
      const rec = s.challenges[challengeId] ?? { attempts: [] }
      return { challenges: { ...s.challenges, [challengeId]: { attempts: rec.attempts.concat([attempt]).slice(-50) } } }
    })
  },
  reload: async () => {
    const [progress, challenges] = await Promise.all([getProgress(), getChallengeRecords()])
    set({ progress, challenges })
  },
  reset: async () => {
    await resetProgress().catch(() => undefined)
    set({ progress: { lessons: {} }, challenges: {} })
  },
}))

export const isLessonComplete = (p: Progress, lessonId: string) => !!p.lessons[lessonId]?.completedAt

export function bestScore(records: ChallengeRecords, id: string) {
  const a = records[id]?.attempts ?? []
  return a.length ? Math.max(...a.map((x) => x.score)) : null
}
