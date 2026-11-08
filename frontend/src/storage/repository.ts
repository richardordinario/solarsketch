/**
 * The only module that touches browser storage. UI and store code call these functions instead.
 * Projects, progress and challenge records live in IndexedDB (localStorage fallback); small
 * settings stay in localStorage so the theme can be applied before first paint. See PRD §11–12.
 */
import { CATALOG_VERSION, RULESET_VERSION } from '@/engine/catalog'
import type { UserCatalog } from '@/engine/catalog-import'
import type { LabNode, Wire } from '@/engine/types'

import { migrateProject } from './migrations'
import { LS_PREFIX, QuotaError, legacyLocalData, localStorageAvailable, localStorageBackend, openIndexedDb, removeLegacyLocalData, type Backend } from './backend'
import {
  STORAGE_SCHEMA_VERSION,
  challengesSchema,
  metaSchema,
  profileSchema,
  progressSchema,
  projectSchema,
  settingsSchema,
  type Attempt,
  type ChallengeRecords,
  type Meta,
  type Profile,
  type Progress,
  type ProjectDocument,
  type ProjectSummary,
  type Settings,
  type TaskRef,
} from './schema'

export const SETTINGS_KEY = `${LS_PREFIX}settings`
export const FILE_EXTENSION = '.solarsketch.json'
/** Imports larger than this are rejected before parsing. */
export const MAX_IMPORT_BYTES = 2_000_000

export class StorageFullError extends Error {
  constructor() {
    super('Browser storage is full. Export and delete old projects to free space.')
    this.name = 'StorageFullError'
  }
}

export class ImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportError'
  }
}

// ---------------------------------------------------------------------------
// Backend selection

let backend: Backend | null = null
let initialized = false

const KV = { meta: 'meta', progress: 'progress', challenges: 'challenges', catalogs: 'catalogs', profile: 'profile' } as const

/**
 * Opens IndexedDB (or falls back to localStorage) and moves any v1 localStorage data into it.
 * Call once before using the other functions.
 */
export async function initStorage(): Promise<Backend['kind'] | null> {
  if (initialized) return backend?.kind ?? null
  initialized = true
  try {
    backend = await openIndexedDb()
    await migrateFromLocalStorage(backend)
  } catch {
    backend = localStorageAvailable() ? localStorageBackend() : null
  }
  return backend?.kind ?? null
}

/** Test hook. */
export function resetStorageForTests(next: Backend | null = null) {
  backend = next
  initialized = next !== null
}

/** False until initStorage() has found a working backend. */
export function isStorageAvailable() {
  return backend !== null
}

export function storageKind() {
  return backend?.kind ?? null
}

async function migrateFromLocalStorage(target: Backend) {
  if (!localStorageAvailable()) return
  const legacy = legacyLocalData()
  const kvKeys = Object.values(KV)
  const hasData = legacy.projectIds.length > 0 || kvKeys.some((k) => legacy.kv(k) !== undefined)
  if (!hasData) return
  for (const id of legacy.projectIds) {
    const raw = legacy.project(id)
    if (raw !== undefined) await target.putProject(id, raw)
  }
  for (const k of kvKeys) {
    const v = legacy.kv(k)
    if (v !== undefined) await target.setKV(k, v)
  }
  removeLegacyLocalData(kvKeys)
}

function requireBackend() {
  if (!backend) throw new Error('Storage is not available')
  return backend
}

/** Serialises writes so autosave and explicit saves never land out of order. */
let writeQueue: Promise<unknown> = Promise.resolve()
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(fn, fn)
  writeQueue = run.catch(() => undefined)
  return run.catch((e) => {
    if (e instanceof QuotaError) throw new StorageFullError()
    throw e
  })
}

// ---------------------------------------------------------------------------
// Cross-tab notifications

export type ExternalChange = { type: 'saved'; id: string; updatedAt: string } | { type: 'deleted'; id: string }

let channel: BroadcastChannel | null = null
function getChannel() {
  if (!channel && typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel('solarsketch')
  return channel
}

/** Fallback for browsers without BroadcastChannel: a localStorage write fires `storage` in other tabs. */
const SIGNAL_KEY = `${LS_PREFIX}signal`

/** Fires when another tab saves or deletes a project. */
export function subscribeToOtherTabs(cb: (e: ExternalChange) => void) {
  const ch = getChannel()
  if (ch) {
    const onMessage = (ev: MessageEvent<ExternalChange>) => cb(ev.data)
    ch.addEventListener('message', onMessage)
    return () => ch.removeEventListener('message', onMessage)
  }
  if (typeof window === 'undefined') return () => {}
  const onStorage = (ev: StorageEvent) => {
    if (ev.key !== SIGNAL_KEY || !ev.newValue) return
    try {
      const msg = JSON.parse(ev.newValue) as { e?: ExternalChange }
      if (msg.e && typeof msg.e.id === 'string' && (msg.e.type === 'saved' || msg.e.type === 'deleted')) cb(msg.e)
    } catch {
      // Not ours or malformed: ignore.
    }
  }
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}

function broadcast(e: ExternalChange) {
  const ch = getChannel()
  if (ch) {
    try {
      ch.postMessage(e)
    } catch {
      // Channel closed: other tabs simply won't be warned.
    }
    return
  }
  try {
    // A changing nonce makes every write an actual change, so the event always fires.
    localStorage.setItem(SIGNAL_KEY, JSON.stringify({ e, nonce: Math.random() }))
  } catch {
    // localStorage unavailable or full: other tabs won't be warned.
  }
}

// ---------------------------------------------------------------------------
// Projects

/** Upgrade stored or imported documents to the current shape (see migrations.ts). */
export const migrate = migrateProject

function parseProject(raw: unknown): ProjectDocument | null {
  const r = projectSchema.safeParse(migrate(raw))
  return r.success ? r.data : null
}

function summarize(doc: ProjectDocument): ProjectSummary {
  return { id: doc.id, name: doc.name, updatedAt: doc.updatedAt, components: doc.nodes.length, wires: doc.wires.length, task: doc.task }
}

export interface ProjectListing {
  projects: ProjectSummary[]
  /** Ids whose stored document fails validation. */
  corrupted: string[]
}

/** Newest first. Corrupted entries are reported, never thrown. */
export async function listProjects(): Promise<ProjectListing> {
  if (!backend) return { projects: [], corrupted: [] }
  const projects: ProjectSummary[] = []
  const corrupted: string[] = []
  for (const { id, raw } of await backend.allProjects()) {
    const doc = parseProject(raw)
    if (doc) projects.push(summarize(doc))
    else corrupted.push(id)
  }
  projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return { projects, corrupted }
}

export async function loadProject(id: string): Promise<ProjectDocument | null> {
  if (!backend) return null
  return parseProject(await backend.getProject(id))
}

/** Validates and writes the document. Throws StorageFullError; the caller keeps its in-memory copy. */
export function saveProject(doc: ProjectDocument) {
  const checked = projectSchema.parse(doc)
  return enqueue(async () => {
    await requireBackend().putProject(checked.id, checked)
    broadcast({ type: 'saved', id: checked.id, updatedAt: checked.updatedAt })
  })
}

export interface NewProjectInput {
  name: string
  nodes: LabNode[]
  wires: Wire[]
  clearSky?: number
  speed?: number
  task?: TaskRef
  faults?: ProjectDocument['faults']
}

/** Builds a valid document in memory. Call saveProject() to persist it. */
export function createProjectDocument(input: NewProjectInput): ProjectDocument {
  const now = new Date().toISOString()
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    id: crypto.randomUUID(),
    name: input.name.trim().slice(0, 120) || 'Untitled project',
    createdAt: now,
    updatedAt: now,
    ruleSetVersion: RULESET_VERSION,
    catalogVersion: CATALOG_VERSION,
    nodes: input.nodes,
    wires: input.wires,
    settings: { clearSky: input.clearSky ?? 85, speed: input.speed ?? 0 },
    ...(input.task ? { task: input.task } : {}),
    ...(input.faults?.length ? { faults: input.faults } : {}),
  }
}

export async function duplicateProject(id: string): Promise<ProjectDocument | null> {
  const src = await loadProject(id)
  if (!src) return null
  const now = new Date().toISOString()
  const copy: ProjectDocument = { ...structuredClone(src), id: crypto.randomUUID(), name: `${src.name} (copy)`.slice(0, 120), createdAt: now, updatedAt: now }
  await saveProject(copy)
  return copy
}

export async function renameProject(id: string, name: string) {
  const doc = await loadProject(id)
  if (!doc) return
  await saveProject({ ...doc, name: name.trim().slice(0, 120) || doc.name, updatedAt: new Date().toISOString() })
}

export async function deleteProject(id: string) {
  await enqueue(() => requireBackend().deleteProject(id))
  broadcast({ type: 'deleted', id })
  const meta = await getMeta()
  if (meta.lastProjectId === id) await setMeta({ ...meta, lastProjectId: undefined })
}

/** Removes stored documents that fail validation. */
export async function removeCorrupted(ids: string[]) {
  for (const id of ids) await enqueue(() => requireBackend().deleteProject(id))
}

// ---------------------------------------------------------------------------
// Export / import

export function projectFileName(doc: ProjectDocument) {
  const base =
    doc.name
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase() || 'project'
  return base + FILE_EXTENSION
}

export function serializeProject(doc: ProjectDocument) {
  return JSON.stringify(doc, null, 2)
}

/** Triggers a browser download of a blob. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function downloadProject(doc: ProjectDocument) {
  downloadBlob(new Blob([serializeProject(doc)], { type: 'application/json' }), projectFileName(doc))
}

/**
 * Validates untrusted file contents and returns a fresh document with a new id.
 * Throws ImportError with a readable message.
 */
export function parseImport(text: string): ProjectDocument {
  if (text.length > MAX_IMPORT_BYTES) throw new ImportError('This file is too large to be a SolarSketch project.')
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new ImportError('This file is not valid JSON.')
  }
  if (!raw || typeof raw !== 'object' || !('schemaVersion' in raw)) throw new ImportError('This file is not a SolarSketch project.')
  const version = (raw as { schemaVersion: unknown }).schemaVersion
  if (typeof version === 'number' && version > STORAGE_SCHEMA_VERSION) throw new ImportError('This project was saved by a newer version of SolarSketch. Update the app and try again.')
  const r = projectSchema.safeParse(migrate(raw))
  if (!r.success) {
    const first = r.error.issues[0]
    const field = first.path.join('.')
    const detail = first.code === 'custom' ? first.message : field ? `the “${field}” field is missing or has the wrong value.` : 'its structure is not recognised.'
    throw new ImportError(`This project file is invalid: ${detail}`)
  }
  const now = new Date().toISOString()
  return { ...r.data, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
}

export async function importProjectFile(file: File): Promise<ProjectDocument> {
  if (file.size > MAX_IMPORT_BYTES) throw new ImportError('This file is too large to be a SolarSketch project.')
  const doc = parseImport(await file.text())
  await saveProject(doc)
  return doc
}

// ---------------------------------------------------------------------------
// Meta, progress, challenges (backend key-values)

const DEFAULT_META: Meta = { schemaVersion: STORAGE_SCHEMA_VERSION, storageNoticeShown: false }

export async function getMeta(): Promise<Meta> {
  if (!backend) return DEFAULT_META
  const r = metaSchema.safeParse(await backend.getKV(KV.meta))
  return r.success ? r.data : DEFAULT_META
}

export function setMeta(meta: Meta) {
  return enqueue(() => requireBackend().setKV(KV.meta, { ...meta, schemaVersion: STORAGE_SCHEMA_VERSION }))
}

export async function setLastProjectId(id: string) {
  await setMeta({ ...(await getMeta()), lastProjectId: id })
}

export async function getProgress(): Promise<Progress> {
  if (!backend) return { lessons: {} }
  const r = progressSchema.safeParse((await backend.getKV(KV.progress)) ?? {})
  return r.success ? r.data : { lessons: {} }
}

export async function updateLessonProgress(lessonId: string, patch: Progress['lessons'][string]) {
  const p = await getProgress()
  p.lessons[lessonId] = { ...p.lessons[lessonId], ...patch }
  await enqueue(() => requireBackend().setKV(KV.progress, p))
  return p
}

export async function getChallengeRecords(): Promise<ChallengeRecords> {
  if (!backend) return {}
  const r = challengesSchema.safeParse((await backend.getKV(KV.challenges)) ?? {})
  return r.success ? r.data : {}
}

export async function recordAttempt(challengeId: string, attempt: Attempt) {
  const all = await getChallengeRecords()
  const rec = all[challengeId] ?? { attempts: [] }
  rec.attempts = rec.attempts.concat([attempt]).slice(-50)
  all[challengeId] = rec
  await enqueue(() => requireBackend().setKV(KV.challenges, all))
  return all
}

/** Imported equipment catalogs (validated on import; stored as-is). */
export async function getUserCatalogs(): Promise<UserCatalog[]> {
  if (!backend) return []
  const raw = await backend.getKV(KV.catalogs)
  return Array.isArray(raw) ? (raw.filter((c) => c && typeof c.id === 'string' && Array.isArray(c.profiles)) as UserCatalog[]) : []
}

export function saveUserCatalogs(list: UserCatalog[]) {
  return enqueue(() => requireBackend().setKV(KV.catalogs, list))
}

/** The onboarding profile, or null before onboarding (or when the stored entry is damaged). */
export async function getProfile(): Promise<Profile | null> {
  if (!backend) return null
  const r = profileSchema.safeParse(await backend.getKV(KV.profile))
  return r.success ? r.data : null
}

export function saveProfile(profile: Profile) {
  return enqueue(() => requireBackend().setKV(KV.profile, profileSchema.parse(profile)))
}

export function deleteProfile() {
  return enqueue(() => requireBackend().deleteKV(KV.profile))
}

export async function resetProgress() {
  if (!backend) return
  await enqueue(async () => {
    await requireBackend().deleteKV(KV.progress)
    await requireBackend().deleteKV(KV.challenges)
  })
}

/** Deletes every project, all progress and settings in this browser. */
export async function resetAllData() {
  if (backend) await enqueue(() => requireBackend().clear())
  try {
    localStorage.removeItem(SETTINGS_KEY)
  } catch {
    // localStorage unavailable: nothing stored there.
  }
}

export async function storageUsage() {
  return backend ? backend.usage() : { used: 0, quota: null }
}

// ---------------------------------------------------------------------------
// Settings: synchronous, always in localStorage (read by the pre-paint theme script).

export function getSettings(): Settings {
  let raw: unknown = {}
  try {
    raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')
  } catch {
    raw = {}
  }
  const r = settingsSchema.safeParse(raw ?? {})
  return r.success ? r.data : settingsSchema.parse({})
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch }
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  } catch {
    // Unavailable or full: the setting applies for this session only.
  }
  return next
}
