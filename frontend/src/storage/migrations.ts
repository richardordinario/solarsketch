/**
 * Versioned upgrades for stored and imported project documents (PRD §11.2: "run migrations on load").
 *
 * `MIGRATIONS[v]` turns a version-v document into a version v+1 document. `migrateProject` runs
 * every step from the document's `schemaVersion` up to STORAGE_SCHEMA_VERSION, so an old project
 * is upgraded rather than reported as corrupted. Steps work on plain JSON (the input is untrusted)
 * and must never throw: anything they don't recognise is left for schema validation to reject.
 *
 * To change the stored shape: bump STORAGE_SCHEMA_VERSION in schema.ts, add the step for the old
 * version here, and add a test in repository.test.ts.
 */
import { CATALOG } from '@/engine/catalog'
import type { ComponentType } from '@/engine/types'

import { STORAGE_SCHEMA_VERSION } from './schema'

type Json = Record<string, unknown>
type Step = (doc: Json) => Json

const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v)

const mapNodes = (doc: Json, fn: (n: Json) => Json): Json => (Array.isArray(doc.nodes) ? { ...doc, nodes: doc.nodes.map((n) => (isObj(n) ? fn(n) : n)) } : doc)

export const MIGRATIONS: Record<number, Step> = {
  // v1 → v2: the 180° `flip` flag became a 90°-step rotation.
  1: (doc) =>
    mapNodes(doc, (n) => {
      const { flip, ...rest } = n
      return flip === true ? { ...rest, rot: 180 } : rest
    }),
}

/**
 * Upgrade a raw document to the current schema version. Documents from a newer version (or with
 * no usable version) are returned as they are, so validation reports them.
 */
export function migrateProject(raw: unknown): unknown {
  if (!isObj(raw)) return raw
  let doc = raw
  let version = doc.schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > STORAGE_SCHEMA_VERSION) return fillSpecs(doc)
  while (version < STORAGE_SCHEMA_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) return doc
    doc = { ...step(doc), schemaVersion: version + 1 }
    version += 1
  }
  return fillSpecs(doc)
}

/**
 * Not tied to a schema version: specification keys added to the catalog after a project was
 * saved get their catalog defaults (bump the type's `ver` when adding one).
 */
function fillSpecs(doc: Json): Json {
  return mapNodes(doc, (node) => {
    const def = typeof node.type === 'string' && node.type in CATALOG ? CATALOG[node.type as ComponentType] : undefined
    if (!def || !isObj(node.specs)) return node
    const specs = { ...node.specs }
    for (const [key, , , value] of def.specs) if (!(key in specs)) specs[key] = value
    return { ...node, specs }
  })
}
