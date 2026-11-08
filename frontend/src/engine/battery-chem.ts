/**
 * Battery chemistries (PRD §4.1D, §6.3). Illustrative, typical values for teaching: they are not
 * a specific manufacturer's data. Always use the battery datasheet for a real design.
 *
 * Voltages are per cell; a bank's cell count is its nominal voltage ÷ the cell's nominal voltage.
 * The open-circuit voltage (OCV) curve is a resting-voltage curve; the simulation shows it as the
 * battery voltage and ignores the sag under load and the rise while charging.
 */
import type { ComponentType, LabNode } from './types'

export type Chemistry = 'lfp' | 'nmc' | 'fla' | 'agm' | 'gel'
export type ChemistryFamily = 'lithium' | 'lead-acid'

export interface ChemistryDef {
  id: Chemistry
  label: string
  family: ChemistryFamily
  /** Nominal cell voltage, V. */
  cellV: number
  /** Resting cell voltage by state of charge: [SOC %, V] in ascending SOC. */
  ocv: readonly (readonly [number, number])[]
  /** Energy stored per energy delivered to the terminals while charging (round-trip efficiency). */
  chargeEff: number
  /** Recommended minimum SOC (the depth-of-discharge limit for a long life), %. */
  minSoc: number
  /** A battery management system that disconnects the battery on its own. Lead-acid has none. */
  bms: boolean
  /** BMS low cut-off, %. Only for chemistries with a BMS. */
  cutoffSoc: number
  /** Absorption (bulk) and float charge voltage per cell, V. Float 0 = no float stage. */
  absorbV: number
  floatV: number
  /** Charging notes shown to the learner. */
  chargeNote: string
}

export const CHEMISTRIES: Record<Chemistry, ChemistryDef> = {
  lfp: {
    id: 'lfp',
    label: 'LiFePO4 (lithium iron phosphate)',
    family: 'lithium',
    cellV: 3.2,
    ocv: [[0, 2.9], [5, 3.05], [10, 3.12], [20, 3.2], [30, 3.24], [50, 3.27], [70, 3.3], [90, 3.33], [100, 3.4]],
    chargeEff: 0.95,
    minSoc: 10,
    bms: true,
    cutoffSoc: 5,
    absorbV: 3.55,
    floatV: 3.375,
    chargeNote: 'Charge to 3.50–3.65 V per cell. No equalisation. Float is optional; the BMS protects each cell.',
  },
  nmc: {
    id: 'nmc',
    label: 'Li-ion NMC (nickel manganese cobalt)',
    family: 'lithium',
    cellV: 3.7,
    ocv: [[0, 3.3], [5, 3.45], [10, 3.52], [20, 3.6], [40, 3.68], [60, 3.78], [80, 3.95], [90, 4.05], [100, 4.15]],
    chargeEff: 0.93,
    minSoc: 20,
    bms: true,
    cutoffSoc: 5,
    absorbV: 4.1,
    floatV: 0,
    chargeNote: 'Charge to 4.10–4.20 V per cell, never above. No float and no equalisation. Keep it out of high heat.',
  },
  fla: {
    id: 'fla',
    label: 'Flooded lead-acid',
    family: 'lead-acid',
    cellV: 2,
    ocv: [[0, 1.967], [25, 2.0], [50, 2.033], [75, 2.067], [100, 2.117]],
    chargeEff: 0.8,
    minSoc: 50,
    bms: false,
    cutoffSoc: 0,
    absorbV: 2.45,
    floatV: 2.25,
    chargeNote: 'Absorption 2.40–2.45 V per cell, float 2.25 V. Equalise periodically at about 2.55 V. Top up with distilled water and ventilate (hydrogen).',
  },
  agm: {
    id: 'agm',
    label: 'AGM sealed lead-acid (VRLA)',
    family: 'lead-acid',
    cellV: 2,
    ocv: [[0, 1.967], [25, 2.008], [50, 2.042], [75, 2.083], [100, 2.142]],
    chargeEff: 0.85,
    minSoc: 50,
    bms: false,
    cutoffSoc: 0,
    absorbV: 2.43,
    floatV: 2.27,
    chargeNote: 'Absorption 2.40–2.45 V per cell, float 2.25–2.30 V. Do not equalise unless the maker allows it. Sealed: never open it.',
  },
  gel: {
    id: 'gel',
    label: 'Gel lead-acid (VRLA)',
    family: 'lead-acid',
    cellV: 2,
    ocv: [[0, 1.967], [25, 2.008], [50, 2.042], [75, 2.083], [100, 2.142]],
    chargeEff: 0.83,
    minSoc: 50,
    bms: false,
    cutoffSoc: 0,
    absorbV: 2.37,
    floatV: 2.25,
    chargeNote: 'Absorption 2.35–2.40 V per cell, lower than AGM; float 2.25 V. Never equalise: over-voltage dries the gel.',
  },
}

/** Battery component types and their chemistry. `bat` stays LiFePO4 for saved-project compatibility. */
export const CHEM_OF: Partial<Record<ComponentType, Chemistry>> = {
  bat: 'lfp',
  batnmc: 'nmc',
  batfla: 'fla',
  batagm: 'agm',
  batgel: 'gel',
}

export const chemistryOf = (n: Pick<LabNode, 'type'>): ChemistryDef => CHEMISTRIES[CHEM_OF[n.type] ?? 'lfp']

/** Resting cell voltage at a state of charge (linear between curve points). */
export function cellOcv(chem: ChemistryDef, soc: number) {
  const c = chem.ocv
  const s = Math.max(0, Math.min(100, soc))
  for (let i = 1; i < c.length; i++) {
    if (s <= c[i][0]) {
      const [s0, v0] = c[i - 1]
      const [s1, v1] = c[i]
      return v0 + ((v1 - v0) * (s - s0)) / (s1 - s0)
    }
  }
  return c[c.length - 1][1]
}

/** Inverse of cellOcv: the state of charge at a resting cell voltage. */
export function socAtCellV(chem: ChemistryDef, v: number) {
  const c = chem.ocv
  if (v <= c[0][1]) return 0
  for (let i = 1; i < c.length; i++) {
    if (v <= c[i][1]) {
      const [s0, v0] = c[i - 1]
      const [s1, v1] = c[i]
      return s0 + ((s1 - s0) * (v - v0)) / (v1 - v0)
    }
  }
  return 100
}

/** Cells in series for a bank (or a battery) of nominal voltage `nomV`. */
export const cellCount = (chem: ChemistryDef, nomV: number) => Math.max(1, Math.round(nomV / chem.cellV))

/** Resting bank voltage at a state of charge. */
export const bankOcv = (chem: ChemistryDef, nomV: number, soc: number) => cellCount(chem, nomV) * cellOcv(chem, soc)

/** State of charge of a bank at a resting voltage. */
export const bankSocAt = (chem: ChemistryDef, nomV: number, v: number) => socAtCellV(chem, v / cellCount(chem, nomV))

/** True when two chemistries may never share one bank (different family or different lithium chemistry). */
export const incompatibleChemistries = (a: ChemistryDef, b: ChemistryDef) => a.family !== b.family || (a.family === 'lithium' && a.id !== b.id)
