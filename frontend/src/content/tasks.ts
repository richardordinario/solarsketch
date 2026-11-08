/**
 * Lesson practice exercises (PRD §8.1) and challenges (PRD §8.2–8.3).
 * Every criterion is evaluated with the deterministic engine; no free-text grading.
 */
import { makeNode } from '@/engine/catalog'
import type { Fault, FaultKind } from '@/engine/faults'
import { gridTiedProject } from '@/engine/sample-project'
import { simulateDays, type RunSummary } from '@/engine/scenario'
import { compute, freshSim } from '@/engine/simulation'
import type { ComponentType, LabNode, Wire } from '@/engine/types'
import { validate, type ValidationResult } from '@/engine/validation'

export interface TaskContext {
  nodes: LabNode[]
  wires: Wire[]
  v: ValidationResult
  /** Remaining injected faults (hidden or not). */
  faults: readonly Fault[]
  /** Three-day headless simulation at 85% sky clearness (with faults), computed on first use. */
  run: () => RunSummary
}

export interface Criterion {
  id: string
  label: string
  test: (ctx: TaskContext) => boolean
  /** Needs the multi-day simulation: skipped in the live checklist, run on Check. */
  deferred?: boolean
}

export interface DiagnosisQuestion {
  question: string
  options: string[]
  answer: number
}

export interface Task {
  id: string
  kind: 'practice' | 'challenge'
  title: string
  /** One-line goal shown in the task bar. */
  goal: string
  instructions: string[]
  criteria: Criterion[]
  starter: () => { nodes: LabNode[]; wires: Wire[]; faults?: Fault[] }
  /** Restricts the component library while the task is open. Every challenge has one. */
  allowed?: ComponentType[]
  /** Lessons that must be completed before the task can be started. */
  prerequisites: string[]
  /** Checks understanding. Challenges: part of the score. Practice: must be answered correctly to finish. */
  diagnosis?: DiagnosisQuestion
  /** What a correct solution looks like (PRD §8.3 "Expected outcome"). Every challenge has one. */
  expectedOutcome?: string
  /** The lesson a practice task belongs to. */
  lessonId?: string
}

// ---------------------------------------------------------------------------
// Builders

type Spec = Record<string, number>
const node = (id: string, type: ComponentType, x: number, y: number, specs?: Spec): LabNode => {
  const n = makeNode(type, x, y, id)
  return specs ? { ...n, specs: { ...n.specs, ...specs } } : n
}
const wire = (id: string, an: string, at: string, bn: string, bt: string, gauge: number, length?: number): Wire => ({
  id,
  a: { n: an, t: at },
  b: { n: bn, t: bt },
  color: 'auto',
  gauge: String(gauge),
  ...(length ? { length } : {}),
})

/** The sample off-grid system with the inverter earthed (no warnings). */
function cleanSystem() {
  const nodes = [
    node('pv1', 'pv', 40, 40),
    node('pv2', 'pv', 40, 200),
    node('cc1', 'mppt', 300, 110),
    node('bat1', 'bat', 570, 40),
    node('dcb1', 'dcb', 570, 220),
    node('inv1', 'inv', 820, 150),
    node('db1', 'acdb', 1080, 150),
    node('ld1', 'led', 1360, 90),
    node('ld2', 'fridge', 1360, 250),
    node('g1', 'gnd', 1080, 380),
  ]
  const wires = [
    wire('w1', 'pv1', 'p', 'cc1', 'pvp', 6),
    wire('w2', 'pv1', 'n', 'pv2', 'p', 6),
    wire('w3', 'pv2', 'n', 'cc1', 'pvn', 6),
    wire('w4', 'cc1', 'bp', 'bat1', 'p', 16),
    wire('w5', 'cc1', 'bn', 'bat1', 'n', 16),
    wire('w6', 'bat1', 'p', 'dcb1', 'i', 25),
    wire('w7', 'dcb1', 'o', 'inv1', 'dp', 25),
    wire('w8', 'bat1', 'n', 'inv1', 'dn', 50),
    wire('w9', 'inv1', 'l', 'db1', 'l', 4),
    wire('w10', 'inv1', 'n', 'db1', 'n', 4),
    wire('w11', 'db1', 'pe', 'g1', 'pe', 6),
    wire('w12', 'db1', 'l1', 'ld1', 'l', 2.5),
    wire('w13', 'db1', 'n1', 'ld1', 'n', 2.5),
    wire('w14', 'db1', 'l2', 'ld2', 'l', 2.5),
    wire('w15', 'db1', 'n2', 'ld2', 'n', 2.5),
    wire('w16', 'inv1', 'pe', 'g1', 'pe', 6),
  ]
  return { nodes, wires }
}

const replaceWires = (wires: Wire[], drop: string[], add: Wire[]) => wires.filter((w) => !drop.includes(w.id)).concat(add)

/** Components of the clean off-grid system, the default library for off-grid tasks. */
const OFF_GRID: ComponentType[] = ['pv', 'mppt', 'bat', 'dcb', 'inv', 'acdb', 'gnd', 'led', 'fridge']

/** A 12.8 V 100 Ah LiFePO4 battery for the battery-bank tasks (edited specs of the catalog battery). */
const SMALL_BAT: Spec = { nomV: 12.8, ah: 100, maxC: 50, maxD: 100 }

// ---------------------------------------------------------------------------
// Shared criteria

const has = (ctx: TaskContext, rule: string) => ctx.v.issues.some((i) => i.rule === rule)
const rulePrefix = (ctx: TaskContext, prefix: string) => ctx.v.issues.some((i) => i.rule.startsWith(prefix))
const linked = (ctx: TaskContext, an: string, at: string, bn: string, bt: string) =>
  ctx.wires.some((w) => (w.a.n === an && w.a.t === at && w.b.n === bn && w.b.t === bt) || (w.a.n === bn && w.a.t === bt && w.b.n === an && w.b.t === at))

const noCritical: Criterion = { id: 'no-critical', label: 'No critical findings', test: (c) => !c.v.issues.some((i) => i.sev === 'critical') }
const noWarnings: Criterion = { id: 'no-warnings', label: 'No critical or warning findings (information notes are fine)', test: (c) => !c.v.issues.some((i) => i.sev !== 'info') }
const stringOf = (modules: number, count = 1): Criterion => ({
  id: `strings-${count}x${modules}`,
  label: count === 1 ? `One complete PV string of ${modules} module${modules > 1 ? 's' : ''} in series` : `${count} complete parallel strings of ${modules} module${modules > 1 ? 's' : ''} each`,
  test: (c) => c.v.sys.strings.length === count && c.v.sys.strings.every((s) => s.length === modules),
})
const loadsSupplied = (ids: string[], label: string): Criterion => ({
  id: 'loads-supplied',
  label,
  test: (c) => ids.every((id) => c.v.sys.supplied.some((l) => l.id === id)),
})
const earthed: Criterion = { id: 'earthed', label: 'Every PE terminal earthed (no GND findings)', test: (c) => !rulePrefix(c, 'GND') }

/** Specs of the listed starter nodes are unchanged and the nodes still exist. */
const specsKept = (id: string, label: string, ref: () => LabNode[], keys: string[]): Criterion => ({
  id,
  label,
  test: (c) =>
    ref().every((r) => {
      const n = c.nodes.find((x) => x.id === r.id)
      return !!n && n.type === r.type && keys.every((k) => n.specs[k] === r.specs[k])
    }),
})

/** Strings of one charge controller, found by validating the project without the other controllers. */
function controllerStrings(ctx: TaskContext, ccId: string) {
  const others = new Set(ctx.nodes.filter((n) => (n.type === 'mppt' || n.type === 'pwm') && n.id !== ccId).map((n) => n.id))
  const v = validate(
    ctx.nodes.filter((n) => !others.has(n.id)),
    ctx.wires.filter((w) => !others.has(w.a.n) && !others.has(w.b.n)),
  )
  return v.sys.cc?.id === ccId ? { strings: v.sys.strings, bank: v.sys.bank } : { strings: [], bank: null }
}

const sameMembers = (a: LabNode[] | undefined, b: LabNode[] | undefined) => !!a && !!b && a.length === b.length && a.every((x) => b.some((y) => y.id === x.id))

// ---------------------------------------------------------------------------
// Lesson practice (PRD §8.1 guided exercises 1–10)

const practice: Task[] = [
  {
    // §8.1 #1
    id: 'practice-pv-terminals',
    kind: 'practice',
    lessonId: 'solar-basics',
    title: 'Identify the PV module terminals',
    goal: 'Connect the module’s PV+ and PV− to the charge controller’s PV input.',
    instructions: [
      'Find the PV+ and PV− terminals on the right edge of the PV module.',
      'Drag from PV+ on the module to PV+ on the controller.',
      'Drag from PV− on the module to PV− on the controller.',
      'Select each wire to read its validation stages in the inspector.',
    ],
    allowed: ['pv', 'mppt'],
    prerequisites: [],
    starter: () => ({ nodes: [node('pv1', 'pv', 40, 80), node('cc1', 'mppt', 360, 80)], wires: [] }),
    criteria: [
      { id: 'pos', label: 'Module PV+ connected to controller PV+', test: (c) => linked(c, 'pv1', 'p', 'cc1', 'pvp') },
      { id: 'neg', label: 'Module PV− connected to controller PV−', test: (c) => linked(c, 'pv1', 'n', 'cc1', 'pvn') },
      noCritical,
    ],
  },
  {
    // §8.1 #2
    id: 'practice-polarity',
    kind: 'practice',
    lessonId: 'dc-polarity',
    title: 'Correct reversed DC polarity',
    goal: 'The PV module is wired to the controller backwards. Fix the polarity.',
    instructions: [
      'Open the Validation tab. Each POL-001 finding marks a reversed connection.',
      'Select a dashed (faulted) wire and press Delete.',
      'Rewire positive to positive and negative to negative.',
    ],
    allowed: ['pv', 'mppt', 'bat'],
    prerequisites: ['solar-basics'],
    starter: () => ({
      nodes: [node('pv1', 'pv', 40, 80), node('cc1', 'mppt', 360, 80), node('bat1', 'bat', 660, 80)],
      wires: [wire('w1', 'pv1', 'p', 'cc1', 'pvn', 6), wire('w2', 'pv1', 'n', 'cc1', 'pvp', 6), wire('w3', 'cc1', 'bp', 'bat1', 'p', 16), wire('w4', 'cc1', 'bn', 'bat1', 'n', 16)],
    }),
    criteria: [{ id: 'no-pol', label: 'No reversed-polarity findings (POL-001)', test: (c) => !has(c, 'POL-001') }, stringOf(1), noCritical],
  },
  {
    // §8.1 #3
    id: 'practice-series',
    kind: 'practice',
    lessonId: 'series-parallel',
    title: 'Wire two modules in series',
    goal: 'Connect both modules in series so their voltages add.',
    instructions: [
      'Connect the first module’s PV+ to the controller PV+.',
      'Connect the first module’s PV− to the second module’s PV+. This is the series link.',
      'Connect the second module’s PV− to the controller PV−.',
      'Check the System summary: the string should read 2S with Voc 99.0 V.',
    ],
    allowed: ['pv', 'mppt', 'bat'],
    prerequisites: ['dc-polarity'],
    starter: () => ({
      nodes: [node('pv1', 'pv', 40, 40), node('pv2', 'pv', 40, 220), node('cc1', 'mppt', 360, 120), node('bat1', 'bat', 660, 120)],
      wires: [wire('w1', 'cc1', 'bp', 'bat1', 'p', 16), wire('w2', 'cc1', 'bn', 'bat1', 'n', 16)],
    }),
    criteria: [stringOf(2), noCritical],
  },
  {
    // §8.1 #4
    id: 'practice-parallel',
    kind: 'practice',
    lessonId: 'series-parallel',
    title: 'Wire two modules in parallel',
    goal: 'This PWM controller accepts at most 50 V. Wire both modules in parallel.',
    instructions: [
      'Two modules in series would give 99 V, almost twice the PWM controller’s 50 V limit.',
      'Connect each module’s PV+ to the controller PV+ (two wires on the same terminal).',
      'Connect each module’s PV− to the controller PV−.',
      'Voltage stays at one module’s Voc while the currents add.',
    ],
    allowed: ['pv', 'pwm', 'bat'],
    prerequisites: ['dc-polarity'],
    starter: () => ({
      nodes: [node('pv1', 'pv', 40, 40), node('pv2', 'pv', 40, 220), node('cc1', 'pwm', 360, 120), node('bat1', 'bat', 660, 120)],
      wires: [wire('w1', 'cc1', 'bp', 'bat1', 'p', 16), wire('w2', 'cc1', 'bn', 'bat1', 'n', 16)],
    }),
    criteria: [stringOf(1, 2), { id: 'no-overvoltage', label: 'PV voltage within the controller limit', test: (c) => !has(c, 'RAT-001') }, noCritical],
  },
  {
    // §8.1 #5
    id: 'practice-battery',
    kind: 'practice',
    lessonId: 'controllers-batteries',
    title: 'Connect the controller to the battery',
    goal: 'Connect the charge controller’s battery output to the battery bank.',
    instructions: [
      'Connect controller BAT+ to battery B+.',
      'Connect controller BAT− to battery B−.',
      'Select the wires and check the conductor size against the expected current.',
    ],
    allowed: ['pv', 'mppt', 'bat'],
    prerequisites: ['dc-polarity'],
    starter: () => ({
      nodes: [node('pv1', 'pv', 40, 40), node('pv2', 'pv', 40, 220), node('cc1', 'mppt', 360, 120), node('bat1', 'bat', 660, 120)],
      wires: [wire('w1', 'pv1', 'p', 'cc1', 'pvp', 6), wire('w2', 'pv1', 'n', 'pv2', 'p', 6), wire('w3', 'pv2', 'n', 'cc1', 'pvn', 6)],
    }),
    criteria: [
      { id: 'bat-connected', label: 'Controller battery terminals connected to the battery', test: (c) => !has(c, 'TOP-002') && !!c.v.sys.bank },
      { id: 'no-undersized', label: 'No undersized battery conductors (RAT-004)', test: (c) => !has(c, 'RAT-004') },
      noCritical,
    ],
  },
  {
    // §8.1 #6
    id: 'practice-battery-bank',
    kind: 'practice',
    lessonId: 'battery-configurations',
    title: 'Build a 2S2P battery bank',
    goal: 'Wire four 12.8 V 100 Ah batteries into a 25.6 V, 200 Ah bank for the 24 V controller.',
    instructions: [
      'Each battery is 12.8 V, 100 Ah. The controller needs a 24 V (25.6 V) bank.',
      'Make two series strings: connect the B− of one battery to the B+ of the next.',
      'Connect the top B+ of both strings to the controller BAT+, and the bottom B− of both strings to the controller BAT−.',
      'Check the System summary: the bank should read 25.6 V, 200 Ah, 5.12 kWh. Do not change the battery specifications.',
    ],
    allowed: ['pv', 'mppt', 'bat'],
    prerequisites: ['controllers-batteries'],
    starter: () => ({
      nodes: [
        node('pv1', 'pv', 40, 40),
        node('pv2', 'pv', 40, 220),
        node('cc1', 'mppt', 360, 120),
        node('bat1', 'bat', 660, 20, SMALL_BAT),
        node('bat2', 'bat', 660, 180, SMALL_BAT),
        node('bat3', 'bat', 900, 20, SMALL_BAT),
        node('bat4', 'bat', 900, 180, SMALL_BAT),
      ],
      wires: [wire('w1', 'pv1', 'p', 'cc1', 'pvp', 6), wire('w2', 'pv1', 'n', 'pv2', 'p', 6), wire('w3', 'pv2', 'n', 'cc1', 'pvn', 6)],
    }),
    criteria: [
      { id: 'bank-voltage', label: 'Battery bank at 25.6 V on the controller', test: (c) => !!c.v.sys.bank && Math.abs(c.v.sys.bank.nomV - 25.6) < 0.01 },
      { id: 'bank-capacity', label: 'Bank capacity 200 Ah (all four batteries, 2S2P)', test: (c) => !!c.v.sys.bank && c.v.sys.bank.members.length === 4 && Math.abs(c.v.sys.bank.ah - 200) < 0.01 },
      { id: 'balanced', label: 'Parallel strings matched (no BAT findings)', test: (c) => !rulePrefix(c, 'BAT') },
      specsKept('specs-kept', 'Battery specifications unchanged', () => practice.find((t) => t.id === 'practice-battery-bank')!.starter().nodes.filter((n) => n.type === 'bat'), ['nomV', 'ah']),
      noCritical,
    ],
  },
  {
    // §8.1 #7
    id: 'practice-inverter',
    kind: 'practice',
    lessonId: 'inverters-protection',
    title: 'Connect and load the inverter',
    goal: 'Wire the inverter’s DC input and AC output, then keep the load within its 3,000 W rating.',
    instructions: [
      'Connect the DC breaker LOAD to inverter DC+, and battery B− to inverter DC−.',
      'Connect inverter L and N to the distribution board L in and N in, and inverter PE to the grounding rod.',
      'Read RAT-003: the kettle, induction cooker, refrigerator and lighting together exceed the inverter’s continuous rating.',
      'Disconnect one of the two cooking appliances (delete both of its wires). Do not change the inverter rating.',
    ],
    allowed: [...OFF_GRID, 'kettle', 'induc'],
    prerequisites: ['controllers-batteries'],
    starter: () => {
      const base = cleanSystem()
      const nodes = base.nodes.concat([node('ld3', 'kettle', 1360, 410), node('ld4', 'induc', 1360, 560)])
      const wires = replaceWires(
        base.wires,
        ['w7', 'w8', 'w9', 'w10', 'w16'],
        [wire('w17', 'db1', 'l1', 'ld3', 'l', 2.5), wire('w18', 'db1', 'n1', 'ld3', 'n', 2.5), wire('w19', 'db1', 'l2', 'ld4', 'l', 2.5), wire('w20', 'db1', 'n2', 'ld4', 'n', 2.5)],
      )
      return { nodes, wires }
    },
    criteria: [
      { id: 'inv-dc', label: 'Inverter fed from the battery through the DC breaker', test: (c) => !!c.v.sys.inv && !!c.v.sys.invBreaker },
      loadsSupplied(['ld1', 'ld2'], 'LED lighting and refrigerator supplied by the inverter'),
      { id: 'no-overload', label: 'Connected load within the 3,000 W rating (RAT-003 cleared)', test: (c) => !!c.v.sys.inv && !has(c, 'RAT-003') && c.v.sys.inv.specs.ratedP === 3000 },
      { id: 'inv-earthed', label: 'Inverter PE earthed (GND-001 cleared)', test: (c) => !has(c, 'GND-001') },
      noCritical,
    ],
  },
  {
    // §8.1 #8 (DC side)
    id: 'practice-protection',
    kind: 'practice',
    lessonId: 'inverters-protection',
    title: 'Add DC protection and earthing',
    goal: 'Put the breaker between the battery and inverter, and earth the inverter.',
    instructions: [
      'Delete the wire from battery B+ straight to inverter DC+.',
      'Connect battery B+ to the breaker LINE, and the breaker LOAD to inverter DC+.',
      'Connect the inverter PE terminal to the grounding rod.',
      'Size the battery-to-inverter conductors for the expected current.',
    ],
    allowed: OFF_GRID,
    prerequisites: ['controllers-batteries'],
    starter: () => {
      const { nodes, wires } = cleanSystem()
      return { nodes, wires: replaceWires(wires, ['w6', 'w7', 'w16'], [wire('w6', 'bat1', 'p', 'inv1', 'dp', 50)]) }
    },
    criteria: [
      { id: 'breaker', label: 'DC breaker between battery and inverter (PRT-001 cleared)', test: (c) => !has(c, 'PRT-001') && !!c.v.sys.inv },
      { id: 'earthed', label: 'Inverter and board earthed (GND findings cleared)', test: (c) => !rulePrefix(c, 'GND') },
      { id: 'sized', label: 'No undersized conductors (RAT-004)', test: (c) => !has(c, 'RAT-004') },
      loadsSupplied(['ld1', 'ld2'], 'Both loads supplied by the inverter'),
      noCritical,
    ],
  },
  {
    // §8.1 #8 (AC side)
    id: 'practice-ac-protection',
    kind: 'practice',
    lessonId: 'ac-protection',
    title: 'Protect an outlet circuit',
    goal: 'Feed the outlet from a protected board circuit, earth it, and set a 30 mA RCD.',
    instructions: [
      'The outlet is wired straight from the inverter output, so no breaker or RCD protects it (PRT-004).',
      'Delete the two wires from the inverter to the outlet. Connect the board’s L1 and N1 to the outlet L in and N in.',
      'Connect the outlet PE to the grounding rod or the board PE terminal (GND-003).',
      'Select the distribution board and set its RCD trip current to 30 mA, the rating used for protection of people.',
    ],
    allowed: [...OFF_GRID, 'outlet', 'fan'],
    prerequisites: ['inverters-protection'],
    starter: () => {
      const base = cleanSystem()
      const nodes = base.nodes.map((n) => (n.id === 'db1' ? { ...n, specs: { ...n.specs, rcd: 300 } } : n)).concat([node('out1', 'outlet', 1360, 420), node('ld3', 'fan', 1640, 420)])
      const wires = base.wires.concat([wire('w17', 'inv1', 'l', 'out1', 'l', 2.5), wire('w18', 'inv1', 'n', 'out1', 'n', 2.5), wire('w19', 'out1', 'l1', 'ld3', 'l', 2.5), wire('w20', 'out1', 'n1', 'ld3', 'n', 2.5)])
      return { nodes, wires }
    },
    criteria: [
      { id: 'board-circuit', label: 'Outlet fed from a board circuit (PRT-004 cleared)', test: (c) => !has(c, 'PRT-004') && c.v.sys.outletBoard.out1 === 'db1' },
      { id: 'outlet-pe', label: 'Outlet PE earthed (GND-003 cleared)', test: (c) => !has(c, 'GND-003') },
      { id: 'rcd-30', label: 'Board RCD trips at 30 mA or less', test: (c) => (c.nodes.find((n) => n.id === 'db1')?.specs.rcd ?? Infinity) <= 30 },
      { id: 'fan-protected', label: 'Fan supplied through the outlet and protected by the board RCD', test: (c) => c.v.sys.boardOf.ld3 === 'db1' && c.v.sys.acSupplied.some((l) => l.id === 'ld3') },
      noCritical,
    ],
  },
  {
    // §8.1 #9
    id: 'practice-grounding',
    kind: 'practice',
    lessonId: 'grounding-bonding',
    title: 'Earth and bond the system',
    goal: 'Correct a PE wiring mistake and connect every protective earth terminal.',
    instructions: [
      'Read the Validation tab. TRM-002 marks a PE terminal wired to a current-carrying terminal: delete that wire.',
      'Connect the inverter PE to the grounding rod.',
      'Connect the distribution board PE (its earth bar) to the grounding rod.',
      'Bond the PE terminals of the PV module frames, the charge controller and the battery enclosure to the same earthing system (BND-001).',
    ],
    allowed: [...OFF_GRID, 'pebar'],
    prerequisites: ['inverters-protection'],
    starter: () => {
      const { nodes, wires } = cleanSystem()
      return { nodes, wires: replaceWires(wires, ['w11', 'w16'], [wire('w16', 'inv1', 'pe', 'db1', 'n', 6)]) }
    },
    criteria: [
      { id: 'no-trm', label: 'No PE terminal on a current-carrying terminal (TRM-002 cleared)', test: (c) => !has(c, 'TRM-002') },
      earthed,
      { id: 'bonded', label: 'PV frames, controller and battery bonded to earth (BND-001 cleared)', test: (c) => !has(c, 'BND-001') },
      loadsSupplied(['ld1', 'ld2'], 'Both loads still supplied'),
      noCritical,
    ],
  },
  {
    // §8.1 #10
    id: 'practice-analyze-system',
    kind: 'practice',
    lessonId: 'diagrams-datasheets',
    title: 'Analyze a complete system',
    goal: 'This system runs, but the validator lists warnings. Analyze each one and resolve them.',
    instructions: [
      'Run the simulation and read the System summary: PV string, bank, inverter and loads.',
      'Open the Validation tab. For each warning, select the component or wire it names and read the explanation.',
      'Resolve every warning by changing the wiring or the settings of the controller or breaker. The battery and the loads must stay as they are.',
      'Press Check, then answer a question about how the system works.',
    ],
    allowed: OFF_GRID,
    prerequisites: ['system-types', 'battery-configurations'],
    starter: () => {
      const { nodes, wires } = cleanSystem()
      const edits: Record<string, Spec> = { bat1: { maxC: 50 }, dcb1: { maxV: 12 } }
      return {
        nodes: nodes.map((n) => (edits[n.id] ? { ...n, specs: { ...n.specs, ...edits[n.id] } } : n)),
        wires: replaceWires(wires, ['w11'], []),
      }
    },
    criteria: [
      noWarnings,
      stringOf(2),
      loadsSupplied(['ld1', 'ld2'], 'Both loads supplied'),
      specsKept('kept', 'Battery and load ratings unchanged', () => practice.find((t) => t.id === 'practice-analyze-system')!.starter().nodes.filter((n) => n.type === 'bat' || n.id.startsWith('ld')), ['p', 'on', 'off', 'nomV', 'ah', 'maxC', 'maxD']),
    ],
    diagnosis: {
      question: 'At the inverter’s full 3,000 W output, about how much current flows in the battery-to-inverter cables?',
      options: ['About 13 A, the same as on the AC side', 'About 134 A, because the battery side is only 24 V', 'About 1.3 A', 'No current; the breaker carries it'],
      answer: 1,
    },
  },
  {
    // Level 3 configuration practice
    id: 'practice-grid-tied',
    kind: 'practice',
    lessonId: 'system-types',
    title: 'Connect a grid-tied system to the grid',
    goal: 'Connect the utility grid through the net meter so the grid-tied inverter can run.',
    instructions: [
      'The grid-tied inverter and the loads are wired to the board, but the grid is not connected, so the inverter cannot start (AC-002).',
      'Connect the utility grid L and N to the net meter’s Grid L and Grid N.',
      'Connect the net meter’s Load L and Load N to the distribution board L in and N in.',
      'Run the simulation: by day the inverter exports surplus through the meter; at night the house imports.',
    ],
    allowed: ['pv', 'gti', 'acdb', 'nm', 'grid', 'gnd', 'led', 'fridge', 'tv', 'fan'],
    prerequisites: ['ac-protection'],
    starter: () => {
      const { nodes, wires } = gridTiedProject()
      const grid = new Set(['grid1', 'nm1'])
      return { nodes, wires: wires.filter((w) => !grid.has(w.a.n) && !grid.has(w.b.n)) }
    },
    criteria: [
      { id: 'gti-grid', label: 'Grid-tied inverter connected to the grid (AC-002 cleared)', test: (c) => !has(c, 'AC-002') && c.v.sys.ac.gtis.length > 0 },
      { id: 'net-meter', label: 'Net meter between the grid and the installation (NM-001 cleared)', test: (c) => c.v.sys.ac.grids.length > 0 && !has(c, 'NM-001') },
      { id: 'loads-ac', label: 'All four loads supplied', test: (c) => ['ld1', 'ld2', 'ld3', 'ld4'].every((id) => c.v.sys.acSupplied.some((l) => l.id === id)) },
      noCritical,
    ],
  },
  {
    // Level 4 cable sizing practice
    id: 'practice-cable-sizing',
    kind: 'practice',
    lessonId: 'protection-cable-sizing',
    title: 'Size the cables',
    goal: 'Two conductors fail the ampacity or voltage-drop check. Choose sizes that pass.',
    instructions: [
      'Select each wire with a warning and read its Ratings stage in the inspector.',
      'The battery-to-inverter negative is too small for the inverter’s full-load current (RAT-004). Choose a larger conductor.',
      'The 25 m cable from the first module to the controller loses too much voltage (RAT-007). Choose a larger conductor; the equipment cannot move, so keep the cable lengths.',
      'Pick the smallest size that passes each check.',
    ],
    allowed: OFF_GRID,
    prerequisites: ['cables-connectors'],
    starter: () => {
      const { nodes, wires } = cleanSystem()
      return { nodes, wires: replaceWires(wires, ['w1', 'w8'], [wire('w1', 'pv1', 'p', 'cc1', 'pvp', 2.5, 25), wire('w8', 'bat1', 'n', 'inv1', 'dn', 16)]) }
    },
    criteria: [
      { id: 'ampacity', label: 'No undersized conductors (RAT-004)', test: (c) => !has(c, 'RAT-004') },
      { id: 'drop', label: 'Voltage drop within 3% on every conductor (RAT-007)', test: (c) => !has(c, 'RAT-007') },
      {
        id: 'lengths-kept',
        label: 'PV cable run still 25 m',
        test: (c) => c.wires.some((w) => [w.a, w.b].some((e) => e.n === 'cc1' && e.t === 'pvp') && (w.length ?? 0) >= 25),
      },
      loadsSupplied(['ld1', 'ld2'], 'Both loads supplied'),
      noCritical,
    ],
  },
  {
    // Level 5 multiple MPPT practice
    id: 'practice-two-mppt',
    kind: 'practice',
    lessonId: 'mppt-hybrid',
    title: 'Two trackers for two roof faces',
    goal: 'Give the west-facing modules their own MPPT controller, charging the same battery.',
    instructions: [
      'The top two modules face east and already feed the first controller. The bottom two face west.',
      'Wire the west modules in series to the second controller’s PV input.',
      'Connect the second controller’s BAT+ and BAT− to the same battery as the first.',
      'Each controller is limited to 50 A of charge current so that together they stay within the battery’s 100 A limit.',
    ],
    allowed: ['pv', 'mppt', 'bat'],
    prerequisites: ['series-parallel', 'battery-configurations'],
    starter: () => ({
      nodes: [
        node('pv1', 'pv', 40, 20),
        node('pv2', 'pv', 40, 170),
        node('pv3', 'pv', 40, 360),
        node('pv4', 'pv', 40, 510),
        node('cc1', 'mppt', 360, 90, { maxI: 50 }),
        node('cc2', 'mppt', 360, 430, { maxI: 50 }),
        node('bat1', 'bat', 680, 260),
      ],
      wires: [wire('w1', 'pv1', 'p', 'cc1', 'pvp', 6), wire('w2', 'pv1', 'n', 'pv2', 'p', 6), wire('w3', 'pv2', 'n', 'cc1', 'pvn', 6), wire('w4', 'cc1', 'bp', 'bat1', 'p', 16), wire('w5', 'cc1', 'bn', 'bat1', 'n', 16)],
    }),
    criteria: [
      { id: 'cc1-string', label: 'First controller: one 2-module string (east)', test: (c) => matchString(controllerStrings(c, 'cc1').strings, ['pv1', 'pv2']) },
      { id: 'cc2-string', label: 'Second controller: one 2-module string (west)', test: (c) => matchString(controllerStrings(c, 'cc2').strings, ['pv3', 'pv4']) },
      { id: 'same-bank', label: 'Both controllers charge the same battery', test: (c) => sameMembers(controllerStrings(c, 'cc1').bank?.members, controllerStrings(c, 'cc2').bank?.members) },
      { id: 'charge-limit', label: 'Combined charge current within the battery limit', test: (c) => combinedChargeOk(c) },
      noCritical,
    ],
  },
]

const matchString = (strings: LabNode[][], ids: string[]) => strings.length === 1 && strings[0].length === ids.length && ids.every((id) => strings[0].some((n) => n.id === id))

function combinedChargeOk(c: TaskContext) {
  const ccs = c.nodes.filter((n) => n.type === 'mppt' || n.type === 'pwm')
  const bank = c.v.sys.bank
  return !!bank && ccs.reduce((a, n) => a + n.specs.maxI, 0) <= bank.maxC
}

// ---------------------------------------------------------------------------
// Challenges (PRD §8.2): build, fix, configure, support loads, troubleshoot

const challenges: Task[] = [
  {
    // §8.2 Challenge 1
    id: 'build-basic-system',
    kind: 'challenge',
    title: 'Build a basic off-grid solar system',
    goal: 'Starting from just two loads, build a complete off-grid system that supplies them for three days.',
    instructions: [
      'Only the LED lighting and the refrigerator are placed. Add every other component from the library.',
      'Build the DC side: a PV string, an MPPT controller, a 24 V battery, a DC breaker and the inverter.',
      'Build the AC side: inverter to an AC distribution board, the board circuits to both loads, and earth everything.',
      'Run the simulation, then press Check solution. The system must run three days at 85% sky clearness with the battery never below 20%.',
    ],
    expectedOutcome:
      'A validated off-grid system with no critical or warning findings: a PV array within the controller’s limits, a 24 V LiFePO4 battery, a DC breaker between battery and inverter, an earthed distribution board feeding both loads, and enough PV to keep the battery above 20% over three days. Load ratings stay as given.',
    allowed: OFF_GRID,
    prerequisites: ['controllers-batteries', 'inverters-protection'],
    starter: () => ({ nodes: [node('ld1', 'led', 1360, 90), node('ld2', 'fridge', 1360, 250)], wires: [] }),
    criteria: [
      { id: 'pv-charging', label: 'PV array charging a battery through a charge controller, within its limits', test: (c) => c.v.sys.ok && !!c.v.sys.bank },
      { id: 'inverter', label: 'Inverter fed from the battery through a DC breaker', test: (c) => !!c.v.sys.inv && !!c.v.sys.invBreaker },
      { id: 'board', label: 'Both loads supplied through a distribution board', test: (c) => ['ld1', 'ld2'].every((id) => c.v.sys.supplied.some((l) => l.id === id) && !!c.v.sys.boardOf[id]) },
      specsKept('loads-kept', 'Load ratings and schedules unchanged', () => challenges.find((t) => t.id === 'build-basic-system')!.starter().nodes, ['p', 'on', 'off']),
      noWarnings,
      { id: 'no-shutdown', label: 'No inverter shutdown or overload over three days', test: (c) => !c.run().lvd && !c.run().overload, deferred: true },
      { id: 'reserve', label: 'Battery never below 20% over three days', test: (c) => c.run().minSoc >= 20, deferred: true },
    ],
    diagnosis: {
      question: 'Why does the DC breaker sit between the battery and the inverter?',
      options: [
        'The battery can deliver a very large fault current, so the cable to the inverter needs overcurrent protection close to the battery',
        'It converts the battery voltage to 230 V',
        'It stops the PV array charging at night',
        'It measures the battery state of charge',
      ],
      answer: 0,
    },
  },
  {
    // §8.2 Challenge 2
    id: 'fix-connections',
    kind: 'challenge',
    title: 'Fix the incorrect connections',
    goal: 'This system has intentional wiring faults. Find and correct every one.',
    instructions: [
      'Run validation and read each critical finding.',
      'Select a faulted wire to see which validation stage fails and why.',
      'Rewire the faults without removing any component.',
      'Press Check when the system validates cleanly and both loads are supplied.',
    ],
    expectedOutcome: 'The original off-grid system with every critical finding cleared: correct DC polarity at the inverter, line and neutral correct at the lighting, both loads supplied and the 2-module string intact.',
    allowed: OFF_GRID,
    prerequisites: ['dc-polarity'],
    starter: () => {
      const { nodes, wires } = cleanSystem()
      return {
        nodes,
        wires: replaceWires(
          wires,
          ['w7', 'w8', 'w12', 'w13'],
          [wire('w7', 'dcb1', 'o', 'inv1', 'dn', 25), wire('w8', 'bat1', 'n', 'inv1', 'dp', 50), wire('w12', 'db1', 'l1', 'ld1', 'n', 2.5), wire('w13', 'db1', 'n1', 'ld1', 'l', 2.5)],
        ),
      }
    },
    criteria: [
      noCritical,
      { id: 'inverter-fed', label: 'Inverter fed from the battery through the breaker', test: (c) => !!c.v.sys.inv && !has(c, 'PRT-001') && !has(c, 'TOP-003') },
      loadsSupplied(['ld1', 'ld2'], 'LED lighting and refrigerator supplied'),
      stringOf(2),
    ],
    diagnosis: {
      question: 'Which faults were in the starting system?',
      options: [
        'Reversed DC polarity at the inverter, and line/neutral swapped at the LED lighting',
        'An undersized PV cable and a missing grounding rod',
        'PV string voltage above the controller limit',
        'The battery capacity was too small for the loads',
      ],
      answer: 0,
    },
  },
  {
    // §8.2 Challenge 3
    id: 'configure-battery-bank',
    kind: 'challenge',
    title: 'Configure a battery bank',
    goal: 'Build a 24 V bank of at least 7.5 kWh from 12.8 V 100 Ah batteries, using no more than needed.',
    instructions: [
      'Eight 12.8 V, 100 Ah batteries are available. The controller and inverter need a 24 V (25.6 V) bank.',
      'The bank must store at least 7.5 kWh, but use no more batteries than that needs. Spare batteries may stay unconnected.',
      'Connect the bank to the controller BAT+/BAT−, and to the inverter through the DC breaker (bank + to breaker LINE, bank − to inverter DC−).',
      'Do not change the battery specifications or add batteries. Press Check solution when the system validates.',
    ],
    expectedOutcome:
      'A 2S3P bank: three parallel strings of two batteries in series, giving 25.6 V, 300 Ah and 7.68 kWh, connected to both the controller and the inverter (through the breaker) with no BAT, RAT-002 or RAT-008 findings, and both loads supplied.',
    allowed: OFF_GRID,
    prerequisites: ['battery-configurations'],
    starter: () => {
      const base = cleanSystem()
      const bats = Array.from({ length: 8 }, (_, i) => node(`bat${i + 1}`, 'bat', 300 + (i % 4) * 170, i < 4 ? 520 : 680, SMALL_BAT))
      const nodes = base.nodes.filter((n) => n.id !== 'bat1').concat(bats)
      const wires = base.wires.filter((w) => w.a.n !== 'bat1' && w.b.n !== 'bat1')
      return { nodes, wires }
    },
    criteria: [
      { id: 'voltage', label: 'Controller and inverter share one 25.6 V bank', test: (c) => !!c.v.sys.bank && Math.abs(c.v.sys.bank.nomV - 25.6) < 0.01 && sameMembers(c.v.sys.bank.members, c.v.sys.invBank?.members) },
      { id: 'energy', label: 'Bank stores at least 7.5 kWh', test: (c) => (c.v.sys.bank?.kwh ?? 0) >= 7.5 - 1e-9 },
      { id: 'no-excess', label: 'No more batteries than needed (bank at most 8 kWh)', test: (c) => !!c.v.sys.bank && c.v.sys.bank.kwh <= 8 },
      { id: 'balanced', label: 'Strings matched and complete (no BAT or TOP-005 findings)', test: (c) => !rulePrefix(c, 'BAT') && !has(c, 'TOP-005') },
      {
        id: 'specs-kept',
        label: 'Only the eight given batteries, with unchanged specifications',
        test: (c) => {
          const bats = c.nodes.filter((n) => n.type === 'bat')
          return bats.length <= 8 && bats.every((b) => /^bat[1-8]$/.test(b.id) && b.specs.nomV === SMALL_BAT.nomV && b.specs.ah === SMALL_BAT.ah && b.specs.maxC === SMALL_BAT.maxC && b.specs.maxD === SMALL_BAT.maxD)
        },
      },
      { id: 'currents', label: 'Bank current limits respected (no RAT-006 or RAT-008)', test: (c) => !has(c, 'RAT-006') && !has(c, 'RAT-008') },
      loadsSupplied(['ld1', 'ld2'], 'Both loads supplied'),
      noCritical,
    ],
    diagnosis: {
      question: 'Why is 2S3P the right layout for this bank?',
      options: [
        'Two in series give the 24 V system voltage, and three strings give 7.68 kWh, the smallest bank of at least 7.5 kWh',
        'Three in series give 38.4 V, which suits a 24 V inverter',
        'Six in parallel give a 76.8 V bank',
        'Parallel strings are needed only to raise the voltage',
      ],
      answer: 0,
    },
  },
  {
    // §8.2 Challenge 4
    id: 'support-loads',
    kind: 'challenge',
    title: 'Support the daily load profile',
    goal: 'The battery drains a little more every day. Make the system sustainable over three days.',
    instructions: [
      'Run the simulation at ×12 for a few days and watch the state of charge fall.',
      'Keep all four loads connected, and do not change their ratings or schedules.',
      'Change the system so it runs three days at 85% sky clearness with the battery never below 20%.',
      'Press Check to run the three-day test.',
    ],
    expectedOutcome: 'All four loads supplied with unchanged ratings and schedules, no critical findings, and a three-day run at 85% sky clearness with no inverter shutdown and the battery never below 20%, for example by adding PV within the controller’s limits.',
    allowed: [...OFF_GRID, 'fan', 'tv'],
    prerequisites: ['controllers-batteries', 'inverters-protection'],
    starter: () => {
      const base = cleanSystem()
      const nodes = base.nodes.concat([node('ld3', 'fan', 1360, 410), node('ld4', 'tv', 1360, 560)])
      const wires = base.wires.concat([
        wire('w17', 'db1', 'l2', 'ld3', 'l', 2.5),
        wire('w18', 'db1', 'n2', 'ld3', 'n', 2.5),
        wire('w19', 'db1', 'l1', 'ld4', 'l', 2.5),
        wire('w20', 'db1', 'n1', 'ld4', 'n', 2.5),
      ])
      return { nodes, wires }
    },
    criteria: [
      loadsSupplied(['ld1', 'ld2', 'ld3', 'ld4'], 'All four loads supplied'),
      { id: 'loads-unchanged', label: 'Load ratings and schedules unchanged', test: (c) => loadsUnchanged(c.nodes) },
      noCritical,
      { id: 'no-shutdown', label: 'No inverter shutdown or overload over three days', test: (c) => !c.run().lvd && !c.run().overload, deferred: true },
      { id: 'reserve', label: 'Battery never below 20% over three days', test: (c) => c.run().minSoc >= 20, deferred: true },
    ],
    diagnosis: {
      question: 'Which change makes this system sustainable?',
      options: ['Adding PV capacity so daily generation covers daily consumption', 'A larger inverter', 'Thicker AC cables', 'A higher-rated DC breaker'],
      answer: 0,
    },
  },
  {
    // §8.2 Challenge 5 (and variants below)
    id: 'battery-not-charging',
    kind: 'challenge',
    title: 'Troubleshoot: the battery is not charging',
    goal: 'In full sun the PV array produces nothing. Find out why and fix it.',
    instructions: [
      'Run the simulation. Note the PV generation reading.',
      'Check the Validation tab and the PV module terminals for open connections.',
      'Restore a complete two-module series string to the controller.',
      'Press Check when the array produces power.',
    ],
    expectedOutcome: 'A complete two-module series string from controller PV+ back to controller PV−, so the array charges the battery, with no critical findings.',
    allowed: OFF_GRID,
    prerequisites: ['series-parallel'],
    starter: () => {
      const { nodes, wires } = cleanSystem()
      return { nodes, wires: replaceWires(wires, ['w3'], []) }
    },
    criteria: [
      stringOf(2),
      { id: 'generating', label: 'PV circuit complete, so the array can generate', test: (c) => c.v.sys.ok },
      noCritical,
    ],
    diagnosis: {
      question: 'Why was the battery not charging?',
      options: ['The PV string was an open circuit: the last module’s PV− was not connected', 'The battery was already full', 'The inverter was overloaded', 'The sky clearness was set to zero'],
      answer: 0,
    },
  },
  {
    id: 'controller-overvoltage',
    kind: 'challenge',
    title: 'Troubleshoot: controller over-voltage',
    goal: 'Four modules in series exceed the controller’s input limit. Reconfigure the array.',
    instructions: [
      'Read RAT-001 in the Validation tab and compare the string Voc to the 150 V limit.',
      'Keep all four modules, but rearrange them so no string exceeds 150 V.',
      'Parallel strings must have the same number of modules.',
      'Press Check when the simulation is no longer blocked.',
    ],
    expectedOutcome: 'All four modules rearranged as two matched 2-module strings in parallel (2S2P, Voc 99 V), so RAT-001 and RAT-005 are cleared.',
    allowed: OFF_GRID,
    prerequisites: ['series-parallel'],
    starter: () => {
      const base = cleanSystem()
      const nodes = base.nodes.concat([node('pv3', 'pv', 40, 360), node('pv4', 'pv', 40, 520)])
      const wires = replaceWires(base.wires, ['w3'], [wire('w3', 'pv2', 'n', 'pv3', 'p', 6), wire('w17', 'pv3', 'n', 'pv4', 'p', 6), wire('w18', 'pv4', 'n', 'cc1', 'pvn', 6)])
      return { nodes, wires }
    },
    criteria: [
      { id: 'under-limit', label: 'No string exceeds the controller’s 150 V input (RAT-001 cleared)', test: (c) => !has(c, 'RAT-001') },
      { id: 'all-modules', label: 'All four modules in complete strings', test: (c) => c.v.sys.strings.reduce((a, s) => a + s.length, 0) === 4 },
      { id: 'matched', label: 'Parallel strings are matched (no RAT-005)', test: (c) => !has(c, 'RAT-005') },
      noCritical,
    ],
    diagnosis: {
      question: 'Why was the simulation blocked?',
      options: [
        'Four modules in series give a string Voc of 198 V, above the controller’s 150 V maximum',
        'The battery voltage did not match the inverter',
        'The DC breaker was rated too low',
        'PV modules cannot be connected in series',
      ],
      answer: 0,
    },
  },
]

function loadsUnchanged(nodes: LabNode[]) {
  const ref = Object.fromEntries(challenges.find((t) => t.id === 'support-loads')!.starter().nodes.filter((n) => n.id.startsWith('ld')).map((n) => [n.id, n]))
  return Object.values(ref).every((r) => {
    const n = nodes.find((x) => x.id === r.id)
    return !!n && n.type === r.type && n.specs.p === r.specs.p && n.specs.on === r.specs.on && n.specs.off === r.specs.off
  })
}

// ---------------------------------------------------------------------------
// Fault-diagnosis challenges (P2): hidden faults found with measurements, fixed with repairs.

const noFault = (kind: FaultKind, label: string): Criterion => ({ id: `no-${kind}`, label, test: (c) => !c.faults.some((f) => f.kind === kind) })

challenges.push(
  {
    id: 'failed-module',
    kind: 'challenge',
    title: 'Troubleshoot: one string is dead',
    goal: 'The 2S2P array produces only about half its expected power. Find the faulty module and fix it.',
    instructions: [
      'Run the simulation at noon and compare PV generation with what four 400 W modules should give at the shown irradiance.',
      'Select each PV module and read its Measurements: open-circuit voltage and short-circuit current.',
      'A module that reads 0 V in daylight has failed open. Use Inspect and repair on that module only.',
      'Press Check solution when the array produces its full output.',
    ],
    expectedOutcome: 'The failed module found by measurement and repaired, so both 2-module strings produce and the array delivers at least 90% of its expected noon output.',
    allowed: OFF_GRID,
    prerequisites: ['series-parallel'],
    starter: () => {
      const base = cleanSystem()
      const nodes = base.nodes.concat([node('pv3', 'pv', 40, 360), node('pv4', 'pv', 40, 520)])
      const wires = base.wires.concat([wire('w17', 'pv3', 'p', 'cc1', 'pvp', 6), wire('w18', 'pv3', 'n', 'pv4', 'p', 6), wire('w19', 'pv4', 'n', 'cc1', 'pvn', 6)])
      return { nodes, wires, faults: [{ id: 'hf-module', kind: 'module-open', target: 'pv4', hidden: true }] }
    },
    criteria: [
      noFault('module-open', 'No failed module remains in the array'),
      stringOf(2, 2),
      {
        id: 'full-output',
        label: 'Array delivers at least 90% of its fault-free output at noon',
        test: (c) => {
          const noon = { ...freshSim(), t: 12 * 60, started: true }
          const healthy = compute(noon, c.v, 85, []).ppv
          return healthy > 0 && compute(noon, c.v, 85, c.faults).ppv >= 0.9 * healthy
        },
      },
      noCritical,
    ],
    diagnosis: {
      question: 'What was wrong with the array?',
      options: [
        'One module had failed open, so its whole series string produced nothing',
        'Every module was partly shaded',
        'The controller’s PV input voltage limit was exceeded',
        'The battery was full, so charging stopped',
      ],
      answer: 0,
    },
  },
  {
    id: 'rcd-trips',
    kind: 'challenge',
    title: 'Troubleshoot: the lights go out every evening',
    goal: 'Every evening all AC loads switch off at once. Find the cause and fix it.',
    instructions: [
      'Run the simulation into the evening and watch the event log when the loads go off.',
      'Select the AC distribution board and read its Measurements. Note what has tripped.',
      'Test each appliance’s insulation resistance in Measurements. A failing appliance reads well below 1 MΩ.',
      'Repair the faulty appliance, reset the RCD, then press Check solution.',
    ],
    expectedOutcome: 'The appliance with failed insulation found and repaired, the RCD reset, all three loads supplied, and no RCD trips over a three-day run.',
    allowed: [...OFF_GRID, 'tv'],
    prerequisites: ['ac-protection'],
    starter: () => {
      const base = cleanSystem()
      const nodes = base.nodes.concat([node('ld3', 'tv', 1360, 410)])
      const wires = base.wires.concat([wire('w17', 'db1', 'l1', 'ld3', 'l', 2.5), wire('w18', 'db1', 'n1', 'ld3', 'n', 2.5)])
      return { nodes, wires, faults: [{ id: 'hf-leak', kind: 'ground-fault', target: 'ld3', startAt: 19 * 60, hidden: true }] }
    },
    criteria: [
      noFault('ground-fault', 'No appliance with earth leakage remains'),
      loadsSupplied(['ld1', 'ld2', 'ld3'], 'All three loads supplied by the inverter'),
      noCritical,
      { id: 'no-trips', label: 'No RCD trips over three days', test: (c) => c.run().rcdTrips === 0, deferred: true },
    ],
    diagnosis: {
      question: 'Why did the loads switch off every evening?',
      options: [
        'The television had failed insulation; when it switched on at 19:00, earth leakage tripped the RCD',
        'The inverter was overloaded by the evening loads',
        'The battery reached its low-voltage cut-off',
        'The grounding rod was disconnected',
      ],
      answer: 0,
    },
  },
)

export const TASKS: Task[] = [...practice, ...challenges]
export const CHALLENGES = challenges
export const taskById = (id: string) => TASKS.find((t) => t.id === id)

export interface Evaluation {
  results: { id: string; label: string; met: boolean }[]
  met: number
  total: number
  passed: boolean
}

/** Cheap checks only (no multi-day run) for the live checklist; full checks on Check. */
export function evaluate(task: Task, nodes: LabNode[], wires: Wire[], opts: { full: boolean; faults?: readonly Fault[] }): Evaluation {
  const faults = opts.faults ?? []
  let cached: RunSummary | undefined
  const ctx: TaskContext = { nodes, wires, faults, v: validate(nodes, wires), run: () => (cached ??= simulateDays(nodes, wires, 3, 85, faults)) }
  const results = task.criteria.map((c) => ({ id: c.id, label: c.label, met: c.deferred && !opts.full ? false : c.test(ctx) }))
  const met = results.filter((r) => r.met).length
  return { results, met, total: results.length, passed: met === results.length }
}

/** Points per part of the challenge score (PRD §8.3: correctness, completion, understanding). */
export const SCORE_PARTS = { correctness: 60, understanding: 20, completion: 20 } as const

/**
 * Score out of 100 (PRD §8.3), deterministic for the same inputs:
 * - correctness: 60 × the fraction of criteria met, always counted;
 * - understanding: 20 for a correct diagnosis, counted whether or not the check passed
 *   (a challenge without a diagnosis question gives these points only on a pass);
 * - completion: 20 when every criterion is met, minus 5 for each earlier failed check.
 */
export function score(ev: Evaluation, diagnosisCorrect: boolean | null, previousFailures: number) {
  const correctness = Math.round((SCORE_PARTS.correctness * ev.met) / ev.total)
  const understanding = diagnosisCorrect === null ? (ev.passed ? SCORE_PARTS.understanding : 0) : diagnosisCorrect ? SCORE_PARTS.understanding : 0
  const completion = ev.passed ? Math.max(0, SCORE_PARTS.completion - 5 * previousFailures) : 0
  return correctness + understanding + completion
}
