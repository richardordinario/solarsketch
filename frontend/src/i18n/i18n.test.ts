import { describe, expect, it } from 'vitest'

import { fil } from './fil'
import { translate } from './index'

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('i18n', () => {
  it('keeps every placeholder in Filipino translations', () => {
    for (const [en, tl] of Object.entries(fil)) expect(vars(tl), en).toEqual(vars(en))
  })

  it('interpolates and falls back to English', () => {
    expect(translate('fil', '{n} selected', { n: 3 })).toBe('3 napili')
    expect(translate('fil', 'Untranslated {x}', { x: 1 })).toBe('Untranslated 1')
    expect(translate('en', '{n} selected', { n: 3 })).toBe('3 selected')
  })
})
