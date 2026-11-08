/**
 * Lightweight i18n. English source strings are the keys; a missing translation falls back to
 * English, so untranslated text never breaks the UI. Interpolate with {name} placeholders.
 *
 * Scope: UI chrome is translated. Lesson text, rule explanations and engine messages stay in
 * English until a qualified reviewer checks technical translations.
 */
import { useCallback } from 'react'
import { create } from 'zustand'

import { getSettings, updateSettings } from '@/storage/repository'

import { fil } from './fil'

export type Lang = 'en' | 'fil'
export const LANGUAGES: { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'fil', label: 'Filipino' },
]

const DICTS: Record<Lang, Record<string, string>> = { en: {}, fil }

export function translate(lang: Lang, s: string, vars?: Record<string, string | number>) {
  const out = DICTS[lang][s] ?? s
  return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : out
}

interface LangState {
  lang: Lang
  setLang: (lang: Lang) => void
}

export const useLangStore = create<LangState>()((set) => ({
  lang: getSettings().lang,
  setLang: (lang) => {
    updateSettings({ lang })
    document.documentElement.lang = lang
    set({ lang })
  },
}))

/** Translate function bound to the current language; components re-render on change. */
export function useT() {
  const lang = useLangStore((s) => s.lang)
  return useCallback((s: string, vars?: Record<string, string | number>) => translate(lang, s, vars), [lang])
}

/** For non-React code (toasts, logs created in event handlers). */
export const t = (s: string, vars?: Record<string, string | number>) => translate(useLangStore.getState().lang, s, vars)
