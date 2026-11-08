import { describe, expect, it } from 'vitest'

import { canonicalUrl, href, parseHash } from './router'

describe('parseHash', () => {
  it('opens My Projects at the site root', () => {
    for (const h of ['', '#', '#/']) expect(parseHash(h)).toEqual({ page: 'projects' })
  })

  it('keeps the lab for #/lab and unknown hashes', () => {
    expect(parseHash('#/lab')).toEqual({ page: 'lab' })
    expect(parseHash('#/nope')).toEqual({ page: 'lab' })
  })
})

describe('canonicalUrl', () => {
  it('sends the bare root to My Projects', () => {
    expect(canonicalUrl('/', '', '', '/')).toBe('/#/projects')
    expect(canonicalUrl('/', '', '#/', '/')).toBe('/#/projects')
    expect(canonicalUrl('/index.html', '', '', '/')).toBe('/#/projects')
  })

  it('leaves a canonical address alone', () => {
    expect(canonicalUrl('/', '', '#/components', '/')).toBeNull()
    expect(canonicalUrl('/', '?x=1', '#/lab', '/')).toBeNull()
  })

  it('turns a path into the hash route', () => {
    expect(canonicalUrl('/challenges', '', '', '/')).toBe('/#/challenges')
    expect(canonicalUrl('/learn/solar-basics/', '', '', '/')).toBe('/#/learn/solar-basics')
  })

  it('drops a stray path but keeps an existing hash', () => {
    expect(canonicalUrl('/challenges', '', '#/components', '/')).toBe('/#/components')
    expect(canonicalUrl('/challenges', '?x=1', '#/components', '/')).toBe('/?x=1#/components')
  })

  it('respects a sub-path base', () => {
    expect(canonicalUrl('/solarlab/', '', '#/lab', '/solarlab/')).toBeNull()
    expect(canonicalUrl('/solarlab', '', '', '/solarlab/')).toBe('/solarlab/#/projects')
    expect(canonicalUrl('/solarlab/projects', '', '', '/solarlab/')).toBe('/solarlab/#/projects')
    expect(canonicalUrl('/elsewhere', '', '', '/solarlab/')).toBeNull()
  })

  it('round-trips with the router', () => {
    expect(parseHash('#' + canonicalUrl('/challenges', '', '', '/')!.split('#')[1])).toEqual(parseHash(href({ page: 'challenges' })))
  })
})
