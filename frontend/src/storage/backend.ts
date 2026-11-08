/**
 * Storage backends. IndexedDB is primary; localStorage is the fallback when IndexedDB cannot be
 * opened (some private modes). Only repository.ts uses this module.
 */
import { openDB, type IDBPDatabase } from 'idb'

export const LS_PREFIX = 'solarsketch:'

export interface Backend {
  kind: 'indexeddb' | 'localstorage'
  getProject(id: string): Promise<unknown>
  putProject(id: string, doc: unknown): Promise<void>
  deleteProject(id: string): Promise<void>
  allProjects(): Promise<{ id: string; raw: unknown }[]>
  getKV(key: string): Promise<unknown>
  setKV(key: string, value: unknown): Promise<void>
  deleteKV(key: string): Promise<void>
  /** Removes all projects and key-values (not localStorage settings). */
  clear(): Promise<void>
  /** Bytes used and available, if the browser reports them. */
  usage(): Promise<{ used: number; quota: number | null }>
}

export class QuotaError extends Error {}

function isQuota(e: unknown) {
  return e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22)
}

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (isQuota(e) || (e instanceof Error && e.name === 'QuotaExceededError')) throw new QuotaError()
    throw e
  }
}

// ---------------------------------------------------------------------------
// IndexedDB

const DB_NAME = 'solarsketch'
const DB_VERSION = 1

export async function openIndexedDb(timeoutMs = 3000): Promise<Backend> {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is not available')
  const open = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects')
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
    },
  })
  // Some browsers hang instead of failing when IndexedDB is blocked.
  const db: IDBPDatabase = await Promise.race([open, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('IndexedDB open timed out')), timeoutMs))])

  return {
    kind: 'indexeddb',
    getProject: (id) => db.get('projects', id),
    putProject: (id, doc) => guard(async () => void (await db.put('projects', doc, id))),
    deleteProject: (id) => db.delete('projects', id),
    async allProjects() {
      const tx = db.transaction('projects')
      const [keys, values] = await Promise.all([tx.store.getAllKeys(), tx.store.getAll()])
      await tx.done
      return keys.map((k, i) => ({ id: String(k), raw: values[i] }))
    },
    getKV: (key) => db.get('kv', key),
    setKV: (key, value) => guard(async () => void (await db.put('kv', value, key))),
    deleteKV: (key) => db.delete('kv', key),
    async clear() {
      const tx = db.transaction(['projects', 'kv'], 'readwrite')
      await Promise.all([tx.objectStore('projects').clear(), tx.objectStore('kv').clear(), tx.done])
    },
    async usage() {
      const est = await navigator.storage?.estimate?.().catch(() => undefined)
      return { used: est?.usage ?? 0, quota: est?.quota ?? null }
    },
  }
}

// ---------------------------------------------------------------------------
// localStorage

export function localStorageAvailable() {
  try {
    const k = `${LS_PREFIX}probe`
    localStorage.setItem(k, '1')
    localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

const lsProject = (id: string) => `${LS_PREFIX}project:${id}`
const lsIndex = `${LS_PREFIX}projects:index`
const lsKV = (key: string) => `${LS_PREFIX}${key}`

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? undefined : JSON.parse(raw)
  } catch {
    return undefined
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    if (isQuota(e)) throw new QuotaError()
    throw e
  }
}

function readIndex(): string[] {
  const raw = readJson(lsIndex)
  // v1 stored summaries; accept both summaries and plain ids.
  return Array.isArray(raw) ? raw.map((x) => (typeof x === 'string' ? x : x?.id)).filter((x): x is string => typeof x === 'string') : []
}

/** Keys that are not settings and therefore belong to the data backend. */
export function legacyLocalData() {
  return { projectIds: readIndex(), project: (id: string) => readJson(lsProject(id)), kv: (key: string) => readJson(lsKV(key)) }
}

export function removeLegacyLocalData(kvKeys: string[]) {
  readIndex().forEach((id) => localStorage.removeItem(lsProject(id)))
  localStorage.removeItem(lsIndex)
  kvKeys.forEach((k) => localStorage.removeItem(lsKV(k)))
}

export function localStorageBackend(): Backend {
  return {
    kind: 'localstorage',
    getProject: async (id) => readJson(lsProject(id)),
    async putProject(id, doc) {
      writeJson(lsProject(id), doc)
      const ids = readIndex()
      if (!ids.includes(id)) writeJson(lsIndex, ids.concat([id]))
    },
    async deleteProject(id) {
      localStorage.removeItem(lsProject(id))
      writeJson(
        lsIndex,
        readIndex().filter((x) => x !== id),
      )
    },
    allProjects: async () => readIndex().map((id) => ({ id, raw: readJson(lsProject(id)) })),
    getKV: async (key) => readJson(lsKV(key)),
    setKV: async (key, value) => writeJson(lsKV(key), value),
    deleteKV: async (key) => localStorage.removeItem(lsKV(key)),
    async clear() {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k?.startsWith(LS_PREFIX) && k !== `${LS_PREFIX}settings`) keys.push(k)
      }
      keys.forEach((k) => localStorage.removeItem(k))
    },
    async usage() {
      let used = 0
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k?.startsWith(LS_PREFIX)) used += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2
      }
      return { used, quota: 5 * 1024 * 1024 }
    },
  }
}
