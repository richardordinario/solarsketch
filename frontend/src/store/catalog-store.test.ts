import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { CatalogImportError, MY_DEVICES_ID, parseCatalog, parseDevice } from '@/engine/catalog-import'
import { hasDevicePhoto } from '@/engine/device-images'
import { deviceProfiles, makeDeviceNode, setUserProfiles } from '@/engine/profiles'
import { getUserCatalogs, initStorage, resetStorageForTests } from '@/storage/repository'
import { validate } from '@/engine/validation'

import { useCatalogStore } from './catalog-store'

const fan = { type: 'fan', brand: 'Hanabishi', model: 'Test Fan 16', specs: { p: 55, on: 9, off: 17, surge: 2, priority: 2 } }

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory()
  localStorage.clear()
  resetStorageForTests()
  await initStorage()
  useCatalogStore.setState({ catalogs: [] })
})
afterEach(() => setUserProfiles([]))

describe('Add component form', () => {
  it('accepts a device without a datasheet link and marks it unreviewed', () => {
    const p = parseDevice(fan)
    expect(p.type).toBe('fan')
    expect(p.reviewed).toBe(false)
    expect(p.example).toBe(false)
    expect(p.source).toBeUndefined()
    expect(p.id.startsWith(`user:${MY_DEVICES_ID}:fan-`)).toBe(true)
  })

  it('keeps a datasheet link when given', () => {
    const p = parseDevice({ ...fan, datasheet: { url: 'https://example.com/fan.pdf', revision: 'Rev. A' } })
    expect(p.source?.url).toBe('https://example.com/fan.pdf')
  })

  it('rejects missing, unknown and negative specs, and empty names', () => {
    expect(() => parseDevice({ ...fan, specs: { p: 55 } })).toThrow(CatalogImportError)
    expect(() => parseDevice({ ...fan, specs: { ...fan.specs, volts: 230 } })).toThrow(/not a Electric Fan specification/)
    expect(() => parseDevice({ ...fan, specs: { ...fan.specs, p: -5 } })).toThrow(/cannot be negative/)
    expect(() => parseDevice({ ...fan, brand: '  ' })).toThrow(CatalogImportError)
    expect(() => parseDevice({ ...fan, type: 'spaceship' })).toThrow(CatalogImportError)
  })

  it('keeps an uploaded photo only as a JPEG/PNG/WebP data URL', async () => {
    const photo = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
    const p = parseDevice({ ...fan, photo })
    expect(p.photo).toBe(photo)
    // Links (third-party requests, blocked by the CSP), SVG (can carry script) and junk are refused.
    expect(() => parseDevice({ ...fan, photo: 'https://example.com/fan.jpg' })).toThrow(/JPEG, PNG or WebP/)
    expect(() => parseDevice({ ...fan, photo: 'data:image/svg+xml;base64,PHN2Zz4=' })).toThrow(CatalogImportError)
    expect(() => parseDevice({ ...fan, photo: 'data:image/png;base64,' + 'A'.repeat(400_001) })).toThrow(/too large/)
    // Stored with the device, it counts as the device's photo.
    const added = await useCatalogStore.getState().addDevice({ ...fan, photo })
    expect(hasDevicePhoto(added.id)).toBe(true)
    // Catalog files cannot carry photos.
    const file = JSON.stringify({ format: 'solarsketch-catalog', version: 1, name: 'x', profiles: [{ ...fan, photo, datasheet: { url: 'https://e.com/a.pdf', revision: 'A' } }] })
    expect(parseCatalog(file).profiles[0].photo).toBeUndefined()
  })

  it('stores devices in one My devices catalog, activates them, and removes them one by one', async () => {
    const a = await useCatalogStore.getState().addDevice(fan)
    const b = await useCatalogStore.getState().addDevice({ ...fan, model: 'Test Fan 18', specs: { ...fan.specs, p: 70 } })
    expect(useCatalogStore.getState().catalogs).toHaveLength(1)
    expect((await getUserCatalogs())[0].profiles.map((p) => p.id)).toEqual([a.id, b.id])
    expect(deviceProfiles().some((p) => p.id === a.id)).toBe(true)

    // A placed device carries its values into the engine.
    const n = makeDeviceNode(a, 0, 0)
    expect(n.specs.p).toBe(55)
    expect(validate([n], []).nodes?.[0].profile).toBe(a.id)

    await useCatalogStore.getState().removeDevice(MY_DEVICES_ID, a.id)
    expect(useCatalogStore.getState().catalogs[0].profiles.map((p) => p.id)).toEqual([b.id])
    await useCatalogStore.getState().removeDevice(MY_DEVICES_ID, b.id)
    expect(useCatalogStore.getState().catalogs).toEqual([])
    expect(await getUserCatalogs()).toEqual([])
  })
})
