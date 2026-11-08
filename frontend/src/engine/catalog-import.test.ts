import { afterEach, describe, expect, it } from 'vitest'

import { CatalogImportError, catalogTemplate, parseCatalog } from './catalog-import'
import { profileById, profilesFor, setUserProfiles } from './profiles'

const file = (profiles: unknown[], extra: object = {}) => JSON.stringify({ format: 'solarsketch-catalog', version: 1, name: 'Shop list', profiles, ...extra })
const pv = { type: 'pv', brand: 'Acme', model: 'AC-500', specs: { ratedPower: 500, voc: 45.1, vmp: 37.8, isc: 13.9 }, datasheet: { url: 'https://acme.example/ac500.pdf', revision: 'Rev. B' } }

afterEach(() => setUserProfiles([]))

describe('catalog import', () => {
  it('turns a valid file into unreviewed datasheet profiles', () => {
    const c = parseCatalog(file([pv]), new Date('2027-01-05T00:00:00Z'))
    expect(c.profiles).toHaveLength(1)
    expect(c.profiles[0]).toMatchObject({ type: 'pv', brand: 'Acme', example: false, reviewed: false, specs: pv.specs, source: { revision: 'Rev. B', retrieved: '2027-01-05' } })
    expect(c.profiles[0].id.startsWith('user:')).toBe(true)
  })

  it('the downloadable template is itself a valid catalog', () => {
    expect(parseCatalog(catalogTemplate()).profiles.length).toBeGreaterThan(3)
  })

  it.each([
    ['not JSON', '{', /not valid JSON/],
    ['wrong format', JSON.stringify({ format: 'x', version: 1, name: 'a', profiles: [pv] }), /not a valid SolarSketch catalog/],
    ['unknown type', file([{ ...pv, type: 'reactor' }]), /not a valid SolarSketch catalog/],
    ['missing spec', file([{ ...pv, specs: { ratedPower: 500, voc: 45, vmp: 37 } }]), /missing specification "isc"/],
    ['extra spec', file([{ ...pv, specs: { ...pv.specs, colour: 1 } }]), /"colour" is not a/],
    ['negative value', file([{ ...pv, specs: { ...pv.specs, voc: -1 } }]), /cannot be negative/],
    ['no datasheet link', file([{ ...pv, datasheet: { url: 'nope', revision: 'A' } }]), /not a valid SolarSketch catalog/],
  ])('rejects %s', (_l, text, msg) => {
    expect(() => parseCatalog(text)).toThrow(CatalogImportError)
    expect(() => parseCatalog(text)).toThrow(msg)
  })

  it('imported profiles join the built-in ones until removed', () => {
    const c = parseCatalog(file([pv]))
    const before = profilesFor('pv').length
    setUserProfiles(c.profiles)
    expect(profilesFor('pv').length).toBe(before + 1)
    expect(profileById(c.profiles[0].id)?.model).toBe('AC-500')
    setUserProfiles([])
    expect(profileById(c.profiles[0].id)).toBeUndefined()
  })
})
