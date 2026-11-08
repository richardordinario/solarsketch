/**
 * Manufacturer catalog import (PRD P2). Users or instructors load equipment profiles they took
 * from real datasheets as a JSON file; nothing is fetched from manufacturers. Imported values are
 * validated against the component catalog and are marked unreviewed.
 */
import { z } from 'zod'

import { CATALOG, LATE_SPECS, SIGNED_SPECS } from './catalog'
import { withLateSpecs, type EquipmentProfile } from './profiles'
import type { ComponentType } from './types'

export const CATALOG_FORMAT = 'solarsketch-catalog'
export const CATALOG_FILE_VERSION = 1
export const MAX_CATALOG_BYTES = 1_000_000
const MAX_PROFILES = 500

const types = Object.keys(CATALOG) as [ComponentType, ...ComponentType[]]

const datasheetRef = z.object({ url: z.string().url().max(500), revision: z.string().trim().min(1).max(80) })

const deviceFields = {
  type: z.enum(types),
  brand: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(100),
  specs: z.record(z.string(), z.number().refine(Number.isFinite, 'must be a finite number')),
  notes: z.string().max(300).optional(),
}

/** Every catalog spec for the type, no unknown keys, no negatives except signed coefficients. */
function checkSpecs(p: { type: ComponentType; brand: string; model: string; specs: Record<string, number> }, ctx: z.RefinementCtx) {
  const keys = CATALOG[p.type].specs.map((s) => s[0])
  const label = `${p.brand} ${p.model}`
  // Keys added in rule set 1.4.0 may be omitted (older catalog files); see withLateSpecs.
  for (const k of keys) if (!(k in p.specs) && !LATE_SPECS[k]) ctx.addIssue({ code: 'custom', message: `${label}: missing specification "${k}" (${CATALOG[p.type].specs.find((s) => s[0] === k)![1]}).` })
  for (const k of Object.keys(p.specs)) if (!keys.includes(k)) ctx.addIssue({ code: 'custom', message: `${label}: "${k}" is not a ${CATALOG[p.type].name} specification.` })
  for (const [k, v] of Object.entries(p.specs)) if (v < 0 && !SIGNED_SPECS.includes(k)) ctx.addIssue({ code: 'custom', message: `${label}: "${k}" cannot be negative.` })
}

const profileInput = z.object({ ...deviceFields, datasheet: datasheetRef }).superRefine(checkSpecs)

/** Largest stored device photo (data URL length). The form resizes photos to well under this. */
export const MAX_PHOTO_CHARS = 400_000
const photoUrl = z
  .string()
  .max(MAX_PHOTO_CHARS, 'The photo is too large.')
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/, 'The photo must be a JPEG, PNG or WebP image.')

/** A device entered in the Add component form: the datasheet link and photo are optional. */
const deviceInput = z.object({ ...deviceFields, datasheet: datasheetRef.optional(), photo: photoUrl.optional() }).superRefine(checkSpecs)
export type DeviceInput = z.input<typeof deviceInput>

const catalogFile = z.object({
  format: z.literal(CATALOG_FORMAT),
  version: z.literal(CATALOG_FILE_VERSION),
  name: z.string().trim().min(1).max(80),
  profiles: z.array(profileInput).min(1).max(MAX_PROFILES),
})

export interface UserCatalog {
  id: string
  name: string
  importedAt: string
  profiles: EquipmentProfile[]
}

export class CatalogImportError extends Error {}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Validate untrusted catalog JSON and turn it into profiles. Throws CatalogImportError. */
export function parseCatalog(text: string, now = new Date()): UserCatalog {
  if (text.length > MAX_CATALOG_BYTES) throw new CatalogImportError('This catalog file is too large (limit 1 MB).')
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new CatalogImportError('This file is not valid JSON.')
  }
  const r = catalogFile.safeParse(raw)
  if (!r.success) {
    const first = r.error.issues[0]
    const where = first.path.length ? ` (at ${first.path.join('.')})` : ''
    throw new CatalogImportError(first.code === 'custom' ? first.message : `This is not a valid SolarSketch catalog: ${first.message}${where}.`)
  }
  const id = `${slug(r.data.name) || 'catalog'}-${now.getTime().toString(36)}`
  const seen = new Set<string>()
  const profiles = r.data.profiles.map((p) => {
    let pid = `user:${id}:${p.type}-${slug(p.brand)}-${slug(p.model)}`
    while (seen.has(pid)) pid += '-x'
    seen.add(pid)
    return toProfile(pid, p, now)
  })
  return { id, name: r.data.name, importedAt: now.toISOString(), profiles }
}

function toProfile(id: string, p: z.output<typeof deviceInput>, now: Date): EquipmentProfile {
  // Catalog files cannot carry photos; only the Add component form sets one.
  const ds = p.datasheet
  return withLateSpecs({
    id,
    type: p.type,
    brand: p.brand,
    model: p.model,
    specs: p.specs,
    ver: 1,
    datasheet: ds ? `${p.brand} datasheet, ${ds.revision}` : 'Entered by the user (no datasheet link)',
    ...(ds ? { source: { url: ds.url, revision: ds.revision, retrieved: now.toISOString().slice(0, 10) } } : {}),
    example: false,
    reviewed: false,
    ...(p.notes ? { notes: p.notes } : {}),
    ...(p.photo ? { photo: p.photo } : {}),
  })
}

/** The catalog that holds devices added through the Add component form. */
export const MY_DEVICES_ID = 'my-devices'
export const MY_DEVICES_NAME = 'My devices'

/** Validate one device from the Add component form. Throws CatalogImportError with the first problem. */
export function parseDevice(input: unknown, now = new Date()): EquipmentProfile {
  const r = deviceInput.safeParse(input)
  if (!r.success) {
    const first = r.error.issues[0]
    const where = first.path.length ? `${first.path.join('.')}: ` : ''
    throw new CatalogImportError(first.code === 'custom' ? first.message : `${where}${first.message}`)
  }
  const p = r.data
  return toProfile(`user:${MY_DEVICES_ID}:${p.type}-${slug(p.brand)}-${slug(p.model)}-${now.getTime().toString(36)}`, p, now)
}

/** A starter file showing the format, with one entry per equipment type and placeholder values. */
export function catalogTemplate() {
  const pick: ComponentType[] = ['pv', 'pvbif', 'mppt', 'bat', 'batagm', 'inv', 'hyb', 'gti']
  return JSON.stringify(
    {
      format: CATALOG_FORMAT,
      version: CATALOG_FILE_VERSION,
      name: 'My equipment catalog',
      profiles: pick.map((type) => ({
        type,
        brand: 'Brand name',
        model: `${CATALOG[type].name} model`,
        specs: Object.fromEntries(CATALOG[type].specs.map(([k, , , v]) => [k, v])),
        datasheet: { url: 'https://example.com/datasheet.pdf', revision: 'Rev. A' },
        notes: `Replace every value with the ${CATALOG[type].name.toLowerCase()} datasheet value. Units: ${CATALOG[type].specs.map(([k, , u]) => `${k} ${u}`).join(', ')}.`,
      })),
    },
    null,
    2,
  )
}
