export type TerminalType = 'dc+' | 'dc-' | 'dc' | 'ac-l' | 'ac-n' | 'pe'

/** [id, label, electrical type] */
export type TerminalDef = readonly [id: string, label: string, type: TerminalType]

/** [key, label, unit, default value] */
export type SpecDef = readonly [key: string, label: string, unit: string, value: number]

export type ComponentType =
  | 'pv'
  | 'mppt'
  | 'pwm'
  | 'bat'
  | 'dcb'
  | 'inv'
  | 'acdb'
  | 'outlet'
  | 'gnd'
  | 'led'
  | 'fan'
  | 'fridge'
  | 'tv'
  | 'gti'
  | 'hyb'
  | 'grid'
  | 'nm'
  | 'gen'
  | 'ats'
  | 'acw'
  | 'acs'
  | 'pc'
  | 'laptop'
  | 'router'
  | 'rice'
  | 'kettle'
  | 'micro'
  | 'induc'
  | 'wash'
  | 'iron'
  | 'pump'
  // Solar connectors, protection, distribution, measurement (PRD §4.1 B, F, G, H, I, J, E)
  | 'mc4'
  | 'ybr'
  | 'cbx'
  | 'fuse'
  | 'iso'
  | 'dspd'
  | 'mcb'
  | 'mccb'
  | 'rccb'
  | 'aspd'
  | 'acsw'
  | 'dbus'
  | 'pebar'
  | 'dcm'
  | 'acm'
  | 'mi'
  // PV module variants (PRD §4.1 A) and battery chemistries (PRD §4.1 D, §6.3)
  | 'pvpoly'
  | 'pvbif'
  | 'pvflex'
  | 'pvport'
  | 'batfla'
  | 'batagm'
  | 'batgel'
  | 'batnmc'

/** Catalog data written in catalog.ts; the PRD §4.2 descriptive fields come from catalog-meta.ts. */
export interface BaseComponentDef {
  code: string
  name: string
  cat: string
  model: string
  ver: number
  /** Terminals drawn on the left edge (right edge at 180°, top at 90°, bottom at 270°). */
  L: readonly TerminalDef[]
  R: readonly TerminalDef[]
  /** Terminals bonded inside the component, e.g. a busbar: [first, ...others]. */
  bus?: readonly (readonly string[])[]
  /**
   * Inline switched paths: bonded like `bus` only while the component conducts (the `closed`
   * spec is not 0 and, at run time, no blown-fuse or trip fault). Fuses, isolators, breakers.
   */
  sw?: readonly (readonly string[])[]
  specs: readonly SpecDef[]
  doc: string
}

/** PRD §4.2 descriptive fields every component carries. */
export interface ComponentMeta {
  /** One-sentence description. */
  desc: string
  /** Manufacturer; 'Generic (example)' for generic parts. Real brands come only from datasheet profiles. */
  maker: string
  /** Human-readable connection constraints. */
  constraints: readonly string[]
  /** 2D symbol id. */
  symbol: string
  /** 3D model reference (the lab-3d renderer key). */
  model3d: string
  /** Supported configurations, e.g. series / parallel. */
  configs: readonly string[]
}

/** Component definition (PRD §4.2). The catalog key is the component id. */
export interface ComponentDef extends BaseComponentDef, ComponentMeta {}

export type Rotation = 0 | 90 | 180 | 270

export interface LabNode {
  id: string
  type: ComponentType
  x: number
  y: number
  /** Clockwise rotation on the 2D sheet in degrees; absent means 0. Old projects' `flip` became 180. */
  rot?: Rotation
  specs: Record<string, number>
  /** Spec version the instance was created with. */
  ver: number
  /** Equipment profile the specs came from (engine/profiles.ts); absent for custom specs. */
  profile?: string
}

export interface TermRef {
  n: string
  t: string
}

export type WireColor = 'auto' | 'red' | 'black' | 'brown' | 'blue' | 'gy'

export interface Wire {
  id: string
  a: TermRef
  b: TermRef
  color: WireColor
  /** Conductor cross-section in mm², key of AMPACITY. */
  gauge: string
  /** One-way cable run in metres; DEFAULT_WIRE_LENGTH when absent. */
  length?: number
}

export type Severity = 'critical' | 'warning' | 'info'

export interface IssueTarget {
  node?: string
  wire?: string
}

export interface Issue {
  sev: Severity
  rule: string
  msg: string
  fix: string
  target: IssueTarget
  /** Validation stage (1 terminal … 6 protection, 7 information), from the rule registry. */
  stage?: number
}
