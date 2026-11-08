import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { sampleProject } from '@/engine/sample-project'

import { localStorageBackend } from './backend'
import {
  ImportError,
  StorageFullError,
  createProjectDocument,
  deleteProfile,
  deleteProject,
  duplicateProject,
  getChallengeRecords,
  getMeta,
  getProfile,
  getProgress,
  initStorage,
  listProjects,
  loadProject,
  parseImport,
  recordAttempt,
  renameProject,
  resetAllData,
  resetStorageForTests,
  saveProfile,
  saveProject,
  serializeProject,
  setLastProjectId,
  storageKind,
} from './repository'

const sample = () => createProjectDocument({ name: 'Test house', ...sampleProject() })

async function freshIndexedDb() {
  globalThis.indexedDB = new IDBFactory()
  resetStorageForTests()
  await initStorage()
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe.each([
  ['indexeddb', freshIndexedDb],
  [
    'localstorage',
    async () => {
      resetStorageForTests(localStorageBackend())
    },
  ],
] as const)('projects on %s', (kind, setup) => {
  beforeEach(setup)

  it('uses the expected backend', () => expect(storageKind()).toBe(kind))

  it('saves, lists and loads a project unchanged', async () => {
    const doc = sample()
    await saveProject(doc)
    expect(await loadProject(doc.id)).toEqual(doc)
    expect((await listProjects()).projects).toMatchObject([{ id: doc.id, name: 'Test house', components: 10, wires: doc.wires.length }])
  })

  it('duplicates, renames and deletes', async () => {
    const doc = sample()
    await saveProject(doc)
    const copy = (await duplicateProject(doc.id))!
    expect(copy.id).not.toBe(doc.id)
    expect(copy.name).toBe('Test house (copy)')
    await renameProject(doc.id, '  Renamed  ')
    expect((await loadProject(doc.id))?.name).toBe('Renamed')
    await setLastProjectId(doc.id)
    await deleteProject(doc.id)
    expect(await loadProject(doc.id)).toBeNull()
    expect((await getMeta()).lastProjectId).toBeUndefined()
    expect((await listProjects()).projects.map((p) => p.id)).toEqual([copy.id])
  })

  it('stores progress and challenge attempts', async () => {
    await recordAttempt('c1', { at: 'x', passed: false, score: 20, met: 1, total: 4 })
    await recordAttempt('c1', { at: 'y', passed: true, score: 95, met: 4, total: 4 })
    expect((await getChallengeRecords()).c1.attempts.map((a) => a.score)).toEqual([20, 95])
    expect(await getProgress()).toEqual({ lessons: {} })
  })

  it('wipes data but keeps unrelated keys on reset', async () => {
    await saveProject(sample())
    localStorage.setItem('other-app', 'keep')
    await resetAllData()
    expect((await listProjects()).projects).toEqual([])
    expect(localStorage.getItem('other-app')).toBe('keep')
  })

  it('fills specification keys added to the catalog after saving', async () => {
    const doc = sample()
    await saveProject(doc)
    const raw = JSON.parse(serializeProject(doc))
    delete raw.nodes[0].specs.voc
    expect(parseImport(JSON.stringify(raw)).nodes[0].specs.voc).toBe(49.5)
  })
})

describe('localStorage fallback', () => {
  it('throws StorageFullError when the quota is exceeded', async () => {
    resetStorageForTests(localStorageBackend())
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    await expect(saveProject(sample())).rejects.toThrow(StorageFullError)
  })

  it('reports corrupted documents instead of throwing', async () => {
    resetStorageForTests(localStorageBackend())
    const doc = sample()
    await saveProject(doc)
    localStorage.setItem(`solarsketch:project:${doc.id}`, '{not json')
    expect(await listProjects()).toEqual({ projects: [], corrupted: [doc.id] })
  })
})

describe('migration from localStorage to IndexedDB', () => {
  it('moves v1 localStorage data into IndexedDB and removes it', async () => {
    const doc = sample()
    resetStorageForTests(localStorageBackend())
    await saveProject(doc)
    await recordAttempt('c1', { at: 'x', passed: true, score: 80, met: 4, total: 4 })
    localStorage.setItem('solarsketch:settings', JSON.stringify({ theme: 'dark' }))

    await freshIndexedDb()
    expect(storageKind()).toBe('indexeddb')
    expect(await loadProject(doc.id)).toEqual(doc)
    expect((await getChallengeRecords()).c1.attempts).toHaveLength(1)
    expect(localStorage.getItem(`solarsketch:project:${doc.id}`)).toBeNull()
    expect(localStorage.getItem('solarsketch:settings')).not.toBeNull()
  })
})

describe('import', () => {
  it('round-trips an export with a new id', () => {
    const doc = sample()
    const imported = parseImport(serializeProject(doc))
    expect(imported.id).not.toBe(doc.id)
    expect({ ...imported, id: doc.id, createdAt: doc.createdAt, updatedAt: doc.updatedAt }).toEqual(doc)
  })

  it.each([
    ['not json', '{', /not valid JSON/],
    ['not a project', '{"hello":1}', /not a SolarSketch project/],
    ['newer version', JSON.stringify({ schemaVersion: 99 }), /newer version/],
  ])('rejects %s', (_label, text, msg) => {
    expect(() => parseImport(text)).toThrow(ImportError)
    expect(() => parseImport(text)).toThrow(msg)
  })

  it('rejects wires that reference missing terminals', () => {
    const doc = sample()
    doc.wires[0] = { ...doc.wires[0], a: { n: doc.wires[0].a.n, t: 'zz' } }
    expect(() => parseImport(JSON.stringify(doc))).toThrow(/does not have/)
  })

  it('rejects unknown component types and non-finite specs', () => {
    const bad = JSON.parse(serializeProject(sample()))
    bad.nodes[0].type = 'reactor'
    expect(() => parseImport(JSON.stringify(bad))).toThrow(ImportError)
    const bad2 = JSON.parse(serializeProject(sample()))
    bad2.nodes[0].specs.voc = 'lots'
    expect(() => parseImport(JSON.stringify(bad2))).toThrow(ImportError)
  })
})

describe('schema migrations', () => {
  /** A stored v1 document: nodes carry `flip` instead of `rot`. */
  const v1Doc = () => {
    const doc = sample() as unknown as { schemaVersion: number; nodes: Record<string, unknown>[] }
    doc.schemaVersion = 1
    doc.nodes = doc.nodes.map((n, i) => {
      const { rot: _rot, ...rest } = n
      void _rot
      return { ...rest, flip: i === 0 }
    })
    return doc
  }

  beforeEach(freshIndexedDb)

  it('has a step for every version below the current one', async () => {
    const { MIGRATIONS } = await import('./migrations')
    const { STORAGE_SCHEMA_VERSION } = await import('./schema')
    for (let v = 1; v < STORAGE_SCHEMA_VERSION; v++) expect(MIGRATIONS[v], `migration from v${v}`).toBeTypeOf('function')
  })

  it('upgrades v1 flip to a 180° rotation instead of reporting the project as corrupted', async () => {
    const { migrateProject } = await import('./migrations')
    const { STORAGE_SCHEMA_VERSION } = await import('./schema')
    const out = migrateProject(v1Doc()) as { schemaVersion: number; nodes: Record<string, unknown>[] }
    expect(out.schemaVersion).toBe(STORAGE_SCHEMA_VERSION)
    expect(out.nodes[0].rot).toBe(180)
    expect('flip' in out.nodes[0]).toBe(false)
    expect('rot' in out.nodes[1]).toBe(false)
  })

  it('loads and lists a v1 document stored by an older version', async () => {
    const raw = v1Doc() as unknown as { id: string }
    const { openIndexedDb } = await import('./backend')
    const db = await openIndexedDb()
    await db.putProject(raw.id, raw)
    const listing = await listProjects()
    expect(listing.corrupted).toEqual([])
    expect(listing.projects.map((p) => p.id)).toContain(raw.id)
    const doc = await loadProject(raw.id)
    expect(doc?.nodes[0].rot).toBe(180)
  })

  it('imports a v1 file', () => {
    const doc = parseImport(JSON.stringify(v1Doc()))
    expect(doc.nodes[0].rot).toBe(180)
  })

  it('rejects a file from a newer version', () => {
    const raw = { ...sample(), schemaVersion: 999 }
    expect(() => parseImport(JSON.stringify(raw))).toThrow(ImportError)
  })
})

describe('onboarding profile', () => {
  const profile = { name: 'Juan', expertise: 'beginner' as const, purpose: 'hobby' as const, goals: ['off-grid' as const], onboardedAt: '2026-11-09T00:00:00.000Z', noticeAcceptedAt: '2026-11-09T00:00:00.000Z' }

  it('is null before onboarding, round-trips, and is deleted', async () => {
    await freshIndexedDb()
    expect(await getProfile()).toBeNull()
    await saveProfile(profile)
    expect(await getProfile()).toEqual(profile)
    await deleteProfile()
    expect(await getProfile()).toBeNull()
  })

  it('is cleared with all data', async () => {
    await freshIndexedDb()
    await saveProfile(profile)
    await resetAllData()
    expect(await getProfile()).toBeNull()
  })
})
