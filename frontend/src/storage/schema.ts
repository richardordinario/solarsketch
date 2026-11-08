import { z } from 'zod'

import { AMPACITY, CATALOG } from '@/engine/catalog'
import type { ComponentType } from '@/engine/types'

/**
 * Bump when the stored shape changes, and add a step to `MIGRATIONS` in migrations.ts.
 * v2: node `flip: boolean` replaced by `rot` (0/90/180/270, absent = 0).
 */
export const STORAGE_SCHEMA_VERSION = 2

export const MAX_NODES = 400
export const MAX_WIRES = 1200
export const MAX_NAME = 120

const componentTypes = Object.keys(CATALOG) as [ComponentType, ...ComponentType[]]
const finite = z.number().refine(Number.isFinite, 'must be a finite number')
const coord = finite.refine((v) => Math.abs(v) <= 1e6, 'is out of range')
const id = z.string().min(1).max(80)

const nodeSchema = z
  .object({
    id,
    type: z.enum(componentTypes),
    x: coord,
    y: coord,
    rot: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
    specs: z.record(z.string(), finite),
    ver: z.number().int().positive(),
    profile: z.string().max(80).optional(),
  })
  .superRefine((n, ctx) => {
    const allowed = CATALOG[n.type].specs.map((s) => s[0])
    for (const key of Object.keys(n.specs)) {
      if (!allowed.includes(key)) ctx.addIssue({ code: 'custom', message: `Unknown specification "${key}" on ${CATALOG[n.type].name}.` })
    }
    for (const key of allowed) {
      if (!(key in n.specs)) ctx.addIssue({ code: 'custom', message: `Missing specification "${key}" on ${CATALOG[n.type].name}.` })
    }
  })

const termRef = z.object({ n: id, t: z.string().min(1).max(20) })

const wireSchema = z.object({
  id,
  a: termRef,
  b: termRef,
  color: z.enum(['auto', 'red', 'black', 'brown', 'blue', 'gy']),
  gauge: z.string().refine((g) => g in AMPACITY, 'is not a supported conductor size'),
  length: z.number().min(0.1).max(1000).optional(),
  bend: z.number().min(-20000).max(20000).optional(),
})

const taskRef = z.object({ kind: z.enum(['practice', 'challenge']), id: z.string().min(1).max(80) })

export const projectSchema = z
  .object({
    schemaVersion: z.literal(STORAGE_SCHEMA_VERSION),
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(MAX_NAME),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    ruleSetVersion: z.string().max(20),
    catalogVersion: z.string().max(20),
    nodes: z.array(nodeSchema).max(MAX_NODES),
    wires: z.array(wireSchema).max(MAX_WIRES),
    settings: z.object({
      clearSky: z.number().min(0).max(100),
      speed: z.number().int().min(0).max(2),
    }),
    task: taskRef.optional(),
    faults: z
      .array(
        z.object({
          id: z.string().min(1).max(80),
          kind: z.enum(['shading', 'module-open', 'breaker-trip', 'bms-cutoff', 'ground-fault', 'inverter-overtemp', 'grid-outage', 'gen-fail', 'fuse-blown', 'ac-breaker-trip']),
          target: z.string().min(1).max(80),
          startAt: z.number().min(0).max(1e7).optional(),
          shade: z.number().min(0).max(1).optional(),
          hidden: z.boolean().optional(),
        }),
      )
      .max(50)
      .optional(),
    lessonRefs: z.array(z.string().max(80)).max(50).optional(),
  })
  .superRefine((doc, ctx) => {
    for (const f of doc.faults ?? []) {
      if (!doc.nodes.some((n) => n.id === f.target)) ctx.addIssue({ code: 'custom', message: `Fault ${f.id} targets a component that does not exist.` })
    }
    const byId = new Map(doc.nodes.map((n) => [n.id, n]))
    if (byId.size !== doc.nodes.length) ctx.addIssue({ code: 'custom', message: 'Two components share the same id.' })
    const wireIds = new Set(doc.wires.map((w) => w.id))
    if (wireIds.size !== doc.wires.length) ctx.addIssue({ code: 'custom', message: 'Two wires share the same id.' })
    for (const w of doc.wires) {
      for (const end of [w.a, w.b]) {
        const node = byId.get(end.n)
        if (!node) {
          ctx.addIssue({ code: 'custom', message: `Wire ${w.id} connects to a component that does not exist.` })
          continue
        }
        const def = CATALOG[node.type]
        if (!def.L.concat(def.R).some((t) => t[0] === end.t)) ctx.addIssue({ code: 'custom', message: `Wire ${w.id} uses terminal "${end.t}", which ${def.name} does not have.` })
      }
    }
  })

export type ProjectDocument = z.infer<typeof projectSchema>
export type TaskRef = z.infer<typeof taskRef>

export interface ProjectSummary {
  id: string
  name: string
  updatedAt: string
  components: number
  wires: number
  task?: TaskRef
}

export const settingsSchema = z.object({
  theme: z.enum(['light', 'dark']).optional(),
  showGrid: z.boolean().default(true),
  snapToGrid: z.boolean().default(true),
  wireStyle: z.enum(['orthogonal', 'curved']).default('orthogonal'),
  showFlow: z.boolean().default(true),
  libraryOpen: z.boolean().default(true),
  inspectorOpen: z.boolean().default(true),
  stepsOpen: z.boolean().default(true),
  lang: z.enum(['en', 'fil']).default('en'),
  /** Simulated minutes per tick at ×1 speed (PRD §14: configurable time step). */
  simStep: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10), z.literal(15)]).default(2),
})
export type Settings = z.infer<typeof settingsSchema>

export const metaSchema = z.object({
  schemaVersion: z.number().int(),
  lastProjectId: z.string().optional(),
  storageNoticeShown: z.boolean().default(false),
})
export type Meta = z.infer<typeof metaSchema>

/** Answers from first-run onboarding. Stored on this device only, never sent anywhere. */
export const EXPERTISE = ['new', 'beginner', 'intermediate', 'professional'] as const
export const PURPOSES = ['work', 'study', 'home', 'hobby'] as const
export const GOALS = ['off-grid', 'grid-tied', 'hybrid', 'small-dc', 'troubleshooting', 'basics'] as const
export const MAX_PROFILE_NAME = 40

export const profileSchema = z.object({
  name: z.string().trim().max(MAX_PROFILE_NAME).default(''),
  expertise: z.enum(EXPERTISE).optional(),
  purpose: z.enum(PURPOSES).optional(),
  goals: z.array(z.enum(GOALS)).default([]),
  /** Set when the user finished or skipped onboarding; it is not shown again. */
  onboardedAt: z.string(),
  /** The user accepted the on-device storage and educational-use notice. */
  noticeAcceptedAt: z.string(),
  /** Version of the Privacy Policy and Terms of Service the user agreed to (content/legal.ts). */
  legalVersion: z.string().optional(),
})
export type Profile = z.infer<typeof profileSchema>
export type Expertise = (typeof EXPERTISE)[number]
export type Purpose = (typeof PURPOSES)[number]
export type Goal = (typeof GOALS)[number]

export const progressSchema = z.object({
  lessons: z
    .record(
      z.string(),
      z.object({
        completedAt: z.string().optional(),
        checkScore: z.number().min(0).max(1).optional(),
        practiceDoneAt: z.string().optional(),
      }),
    )
    .default({}),
})
export type Progress = z.infer<typeof progressSchema>

export const attemptSchema = z.object({
  at: z.string(),
  passed: z.boolean(),
  score: z.number().min(0).max(100),
  met: z.number().int().min(0),
  total: z.number().int().min(0),
})
export type Attempt = z.infer<typeof attemptSchema>

export const challengesSchema = z.record(z.string(), z.object({ attempts: z.array(attemptSchema).default([]) }))
export type ChallengeRecords = z.infer<typeof challengesSchema>
